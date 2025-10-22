/**
 * Advanced Analytics Handlers
 * 
 * Track user financial improvement over time, feature effectiveness,
 * and strategy performance. Provides insights for users and admins.
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { authorize } from '../middleware/authorize';
import { ok, forbidden, badRequest, notFound } from '../utils';
import { auditLog } from '../utils/audit';
import { 
  createTenantKey, 
  putItem, 
  getItem, 
  queryItems, 
  queryByIndex,
  generateId,
  timestamp 
} from '../utils/db';

import type { 
  FinancialHealthSnapshot, 
  FinancialGoal, 
  UserBehaviorAnalytics,
  CreditCardAccount 
} from '@tyche/types';

// --- AgentKit Integration ---
import { createAgent } from '@tyche/ai';

const USERS_TABLE = process.env.USERS_TABLE || 'tyche-users';
const CARDS_TABLE = process.env.CREDIT_CARDS_TABLE || 'tyche-credit-cards';
const SNAPSHOTS_TABLE = process.env.SNAPSHOTS_TABLE || 'tyche-financial-snapshots';
const GOALS_TABLE = process.env.GOALS_TABLE || 'tyche-goals';
const ANALYTICS_TABLE = process.env.ANALYTICS_TABLE || 'tyche-user-analytics';

/**
 * POST /v1/analytics/snapshot
 * Create a financial health snapshot for the authenticated user
 * 
 * Captures current debt metrics, payment behavior, and progress indicators.
 * Called automatically on key events (payment logged, card updated, etc.)
 * or manually by user.
 */
export async function createFinancialSnapshot(
  event: APIGatewayProxyEventV2,
  userId?: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await authorize(event, 'user');
  
  if (!auth.authorized) {
    return forbidden(auth.reason);
  }
  
  const { context } = auth;
  const targetUserId = userId || context!.userId;

  try {
    // Get user's credit cards
    const cardsPK = createTenantKey(context!.tenantId, 'USER', targetUserId);
    const cards = await queryItems(CARDS_TABLE, cardsPK, {
      sortKeyCondition: 'begins_with(SK, :skPrefix)',
      expressionAttributeValues: { ':skPrefix': 'CARD#' }
    });
    
    if (!cards || cards.length === 0) {
      return badRequest('No credit cards found. Add cards first.');
    }

    // Calculate debt metrics
    const totalDebt = cards.reduce((sum, card) => sum + (card.balance || 0), 0);
    const totalCreditLimit = cards.reduce((sum, card) => sum + (card.limit || 0), 0);
    const creditUtilization = totalCreditLimit > 0 ? totalDebt / totalCreditLimit : 0;
    
    // Calculate weighted average APR
    const totalWeightedAPR = cards.reduce(
      (sum, card) => sum + (card.balance || 0) * (card.apr || 0),
      0
    );
    const averageAPR = totalDebt > 0 ? totalWeightedAPR / totalDebt : 0;
    
    const monthlyMinimumPayment = cards.reduce(
      (sum, card) => sum + (card.minPayment || 0),
      0
    );

    // Get previous snapshot for comparison
    const snapshotsPK = createTenantKey(context!.tenantId, 'USER', targetUserId);
    const previousSnapshots = await queryItems(SNAPSHOTS_TABLE, snapshotsPK, {
      sortKeyCondition: 'begins_with(SK, :skPrefix)',
      expressionAttributeValues: { ':skPrefix': 'SNAPSHOT#' }
    });
    const lastSnapshot = previousSnapshots?.[0]; // Most recent

    let debtReductionFromLastMonth = undefined;
    let debtReductionPercentage = undefined;

    if (lastSnapshot && lastSnapshot.totalDebt) {
      debtReductionFromLastMonth = lastSnapshot.totalDebt - totalDebt;
      debtReductionPercentage = lastSnapshot.totalDebt > 0
        ? (debtReductionFromLastMonth / lastSnapshot.totalDebt) * 100
        : 0;
    }

    // Create snapshot
    const snapshotId = generateId();
    const now = timestamp();
    
    const snapshot: FinancialHealthSnapshot = {
      id: snapshotId,
      userId: targetUserId,
      tenantId: context!.tenantId,
      timestamp: now,
      totalDebt,
      totalCreditLimit,
      creditUtilization,
      averageAPR,
      numberOfCards: cards.length,
      monthlyMinimumPayment,
      debtReductionFromLastMonth,
      debtReductionPercentage,
      hasActiveGoal: false, // TODO: Check goals table
      snapshotType: 'manual',
      createdAt: now
    };

    // Save snapshot
    const pk = createTenantKey(context!.tenantId, 'USER', targetUserId);
    const sk = `SNAPSHOT#${now}#${snapshotId}`;
    await putItem(SNAPSHOTS_TABLE, {
      PK: pk,
      SK: sk,
      ...snapshot
    });

    // Log action
    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'create_financial_snapshot',
      resource: 'snapshots',
      resourceId: snapshotId,
      success: true
    });

    return ok({
      message: 'Financial snapshot created successfully',
      snapshot
    });
  } catch (error) {
    console.error('[CreateFinancialSnapshot] Error:', error);
    
    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'create_financial_snapshot',
      resource: 'snapshots',
      success: false,
      errorMessage: String(error)
    });
    
    return badRequest('Failed to create financial snapshot');
  }
}

/**
 * GET /v1/analytics/snapshots
 * Get financial health snapshots for authenticated user
 * 
 * Query params:
 * - limit: Number of snapshots to return (default: 30)
 * - startDate: ISO date to filter from
 * - endDate: ISO date to filter to
 */
export async function getFinancialSnapshots(
  event: APIGatewayProxyEventV2,
  userId?: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await authorize(event, 'user');
  
  if (!auth.authorized) {
    return forbidden(auth.reason);
  }
  
  const { context } = auth;
  const targetUserId = userId || context!.userId;
  const { limit = '30', startDate, endDate } = event.queryStringParameters || {};

  try {
    // Query snapshots
    const pk = createTenantKey(context!.tenantId, 'USER', targetUserId);
    const snapshots = await queryItems(SNAPSHOTS_TABLE, pk, {
      sortKeyCondition: 'begins_with(SK, :skPrefix)',
      expressionAttributeValues: { ':skPrefix': 'SNAPSHOT#' }
    });

    // Filter by date if provided
    let filtered = snapshots || [];
    if (startDate) {
      filtered = filtered.filter(s => s.timestamp >= startDate);
    }
    if (endDate) {
      filtered = filtered.filter(s => s.timestamp <= endDate);
    }

    // Sort by timestamp descending (most recent first)
    filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // Apply limit
    const limited = filtered.slice(0, parseInt(limit, 10));

    // Calculate improvement metrics
    const improvement = calculateImprovement(limited);

    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'view_financial_snapshots',
      resource: 'snapshots',
      success: true
    });

    return ok({
      snapshots: limited,
      count: limited.length,
      improvement,
      period: {
        start: limited[limited.length - 1]?.timestamp,
        end: limited[0]?.timestamp
      }
    });
  } catch (error) {
    console.error('[GetFinancialSnapshots] Error:', error);
    return badRequest('Failed to fetch financial snapshots');
  }
}

/**
 * POST /v1/analytics/goal
 * Create a financial goal for the user
 */
export async function createFinancialGoal(
  event: APIGatewayProxyEventV2,
  userId?: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await authorize(event, 'user');
  
  if (!auth.authorized) {
    return forbidden(auth.reason);
  }
  
  const { context } = auth;
  const targetUserId = userId || context!.userId;

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      type = 'debt_payoff',
      title,
      description,
      targetAmount,
      targetDate,
      startingAmount,
      preferredStrategy,
      monthlyCommitment
    } = body;

    if (!title || !targetDate || startingAmount === undefined) {
      return badRequest('Missing required fields: title, targetDate, startingAmount');
    }

    const goalId = generateId();
    const now = timestamp();

    const goal: FinancialGoal = {
      id: goalId,
      userId: targetUserId,
      tenantId: context!.tenantId,
      type,
      title,
      description,
      targetAmount,
      targetDate,
      startingAmount,
      currentAmount: startingAmount,
      preferredStrategy,
      monthlyCommitment,
      status: 'active',
      progress: 0,
      isOnTrack: true,
      createdAt: now,
      updatedAt: now
    };

    // Save goal
    const pk = createTenantKey(context!.tenantId, 'USER', targetUserId);
    const sk = `GOAL#${now}#${goalId}`;
    await putItem(GOALS_TABLE, {
      PK: pk,
      SK: sk,
      ...goal
    });

    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'create_financial_goal',
      resource: 'goals',
      resourceId: goalId,
      details: { type, targetDate },
      success: true
    });

    return ok({
      message: 'Financial goal created successfully',
      goal
    });
  } catch (error) {
    console.error('[CreateFinancialGoal] Error:', error);
    return badRequest('Failed to create financial goal');
  }
}

/**
 * GET /v1/analytics/goals
 * Get financial goals for authenticated user
 */
export async function getFinancialGoals(
  event: APIGatewayProxyEventV2,
  userId?: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await authorize(event, 'user');
  
  if (!auth.authorized) {
    return forbidden(auth.reason);
  }
  
  const { context } = auth;
  const targetUserId = userId || context!.userId;
  const { status } = event.queryStringParameters || {};

  try {
    const pk = createTenantKey(context!.tenantId, 'USER', targetUserId);
    const goals = await queryItems(GOALS_TABLE, pk, {
      sortKeyCondition: 'begins_with(SK, :skPrefix)',
      expressionAttributeValues: { ':skPrefix': 'GOAL#' }
    });

    let filtered = goals || [];
    if (status) {
      filtered = filtered.filter(g => g.status === status);
    }

    // Sort by createdAt descending
    filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'view_financial_goals',
      resource: 'goals',
      success: true
    });

    return ok({
      goals: filtered,
      count: filtered.length,
      active: filtered.filter(g => g.status === 'active').length,
      completed: filtered.filter(g => g.status === 'completed').length
    });
  } catch (error) {
    console.error('[GetFinancialGoals] Error:', error);
    return badRequest('Failed to fetch financial goals');
  }
}

/**
 * PUT /v1/analytics/goal/{goalId}
 * Update a financial goal
 */
export async function updateFinancialGoal(
  event: APIGatewayProxyEventV2,
  userId?: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await authorize(event, 'user');
  
  if (!auth.authorized) {
    return forbidden(auth.reason);
  }
  
  const { context } = auth;
  const targetUserId = userId || context!.userId;
  const goalId = event.pathParameters?.goalId;

  if (!goalId) {
    return badRequest('Goal ID is required');
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { currentAmount, status, progress, isOnTrack } = body;

    // Get existing goal
    const pk = createTenantKey(context!.tenantId, 'USER', targetUserId);
    const goals = await queryItems(GOALS_TABLE, pk, {
      sortKeyCondition: 'begins_with(SK, :skPrefix)',
      expressionAttributeValues: { ':skPrefix': 'GOAL#' }
    });
    const existingGoal = goals?.find(g => g.id === goalId);

    if (!existingGoal) {
      return notFound('Goal not found');
    }

    // Calculate progress if currentAmount changed
    let calculatedProgress = progress;
    if (currentAmount !== undefined && existingGoal.startingAmount && existingGoal.targetAmount) {
      const totalChange = Math.abs(existingGoal.targetAmount - existingGoal.startingAmount);
      const actualChange = Math.abs(currentAmount - existingGoal.startingAmount);
      calculatedProgress = totalChange > 0 ? Math.min(actualChange / totalChange, 1) : 0;
    }

    const updates = {
      currentAmount: currentAmount ?? existingGoal.currentAmount,
      status: status ?? existingGoal.status,
      progress: calculatedProgress ?? existingGoal.progress,
      isOnTrack: isOnTrack ?? existingGoal.isOnTrack,
      updatedAt: timestamp(),
      ...(status === 'completed' && !existingGoal.completedAt ? { completedAt: timestamp() } : {})
    };

    const updatedGoal = { ...existingGoal, ...updates };

    // Find the SK for this goal
    const sk = `GOAL#${existingGoal.createdAt}#${goalId}`;
    
    // Save updated goal (replace entire item)
    await putItem(GOALS_TABLE, {
      PK: pk,
      SK: sk,
      ...updatedGoal
    });

    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'update_financial_goal',
      resource: 'goals',
      resourceId: goalId,
      details: { updates },
      success: true
    });

    return ok({
      message: 'Financial goal updated successfully',
      goal: updatedGoal
    });
  } catch (error) {
    console.error('[UpdateFinancialGoal] Error:', error);
    return badRequest('Failed to update financial goal');
  }
}

/**
 * GET /v1/analytics/progress
 * Get comprehensive progress report for user
 * 
 * Shows debt reduction over time, goal progress, and improvement trends.
 */
/**
 * AgentKit Integration: getProgressReport now invokes AgentKit analytics tools for advanced computation.
 * - Loads user data as before
 * - Invokes AgentKit (OpenAI) for trend/insight generation
 * - Returns both legacy and AgentKit-powered analytics
 */
export async function getProgressReport(
  event: APIGatewayProxyEventV2,
  userId?: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await authorize(event, 'user');
  
  if (!auth.authorized) {
    return forbidden(auth.reason);
  }
  
  const { context } = auth;
  const targetUserId = userId || context!.userId;

  try {
    // Get snapshots
    const snapshotsPK = createTenantKey(context!.tenantId, 'USER', targetUserId);
    const snapshots = await queryItems(SNAPSHOTS_TABLE, snapshotsPK, {
      sortKeyCondition: 'begins_with(SK, :skPrefix)',
      expressionAttributeValues: { ':skPrefix': 'SNAPSHOT#' }
    });
    
    // Get goals
    const goalsPK = createTenantKey(context!.tenantId, 'USER', targetUserId);
    const goals = await queryItems(GOALS_TABLE, goalsPK, {
      sortKeyCondition: 'begins_with(SK, :skPrefix)',
      expressionAttributeValues: { ':skPrefix': 'GOAL#' }
    });

    // Sort snapshots by date
    const sortedSnapshots = (snapshots || []).sort((a, b) => 
      a.timestamp.localeCompare(b.timestamp)
    );


    // --- AgentKit Analytics ---
    const agent = createAgent({ userId: targetUserId });
    // Compose a natural language prompt for analytics
    const agentPrompt: import('@tyche/ai').ChatMessage[] = [
      { role: 'system', content: 'You are a financial analytics agent. Analyze the user\'s debt, goals, and trends.' },
      { role: 'user', content: `Here are the user\'s financial snapshots: ${JSON.stringify(sortedSnapshots)}.\nHere are the user\'s goals: ${JSON.stringify(goals)}.\nGenerate a summary of trends, risks, and actionable recommendations.` }
    ];
    let agentkitResult = null;
    try {
      agentkitResult = await agent.chat(agentPrompt);
    } catch (err) {
      console.error('[AgentKit] Analytics agent error:', err);
    }

    const report = {
      summary: {
        totalSnapshots: sortedSnapshots.length,
        firstSnapshotDate: sortedSnapshots[0]?.timestamp,
        latestSnapshotDate: sortedSnapshots[sortedSnapshots.length - 1]?.timestamp,
        activeGoals: (goals || []).filter(g => g.status === 'active').length,
        completedGoals: (goals || []).filter(g => g.status === 'completed').length
      },
      trends: calculateTrends(sortedSnapshots),
      goals: goals || [],
      milestones: calculateMilestones(sortedSnapshots),
      projections: calculateProjections(sortedSnapshots),
      agentkit: agentkitResult // New: AgentKit-powered analytics summary
    };

    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'view_progress_report',
      resource: 'analytics',
      success: true
    });

    return ok(report);
  } catch (error) {
    console.error('[GetProgressReport] Error:', error);
    return badRequest('Failed to generate progress report');
  }
}

/**
 * GET /v1/analytics/insights
 * Get AI-powered insights and recommendations
 * 
 * Admin/Dev only - for analyzing user patterns and strategy effectiveness
 */
/**
 * AgentKit Integration: getAnalyticsInsights now invokes AgentKit for cohort/strategy analysis.
 * - Loads user and snapshot data
 * - Invokes AgentKit for advanced insights
 * - Returns both legacy and AgentKit-powered insights
 */
export async function getAnalyticsInsights(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const auth = await authorize(event, 'dev');
  
  if (!auth.authorized) {
    return forbidden(auth.reason);
  }
  
  const { context } = auth;

  try {
    // Get all users in tenant
    const users = await queryByIndex(
      USERS_TABLE,
      'RoleIndex',
      'tenantId',
      context!.tenantId
    );


    // --- AgentKit Analytics ---
    const agent = createAgent({ userId: context!.userId });
    // Compose a prompt for cohort/strategy analysis
    const agentPrompt: import('@tyche/ai').ChatMessage[] = [
      { role: 'system', content: 'You are a financial analytics agent. Analyze user cohort, strategy effectiveness, and engagement.' },
      { role: 'user', content: `Here are all users: ${JSON.stringify(users)}.\nGenerate insights on strategy effectiveness, engagement, and success factors.` }
    ];
    let agentkitResult = null;
    try {
      agentkitResult = await agent.chat(agentPrompt);
    } catch (err) {
      console.error('[AgentKit] Analytics agent error:', err);
    }

    const insights = {
      userMetrics: {
        totalUsers: users.length,
        activeUsers: users.filter(u => u.isActive).length,
        avgTenureMonths: calculateAvgTenure(users)
      },
      strategyEffectiveness: {
        note: 'See agentkit for advanced analysis'
      },
      engagementPatterns: {
        note: 'See agentkit for advanced analysis'
      },
      successFactors: {
        note: 'See agentkit for advanced analysis'
      },
      agentkit: agentkitResult // New: AgentKit-powered insights
    };

    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'view_analytics_insights',
      resource: 'analytics',
      success: true
    });

    return ok(insights);
  } catch (error) {
    console.error('[GetAnalyticsInsights] Error:', error);
    return badRequest('Failed to generate analytics insights');
  }
}

// Helper Functions

function calculateImprovement(snapshots: any[]) {
  if (snapshots.length < 2) {
    return null;
  }

  const latest = snapshots[0];
  const oldest = snapshots[snapshots.length - 1];

  return {
    debtChange: oldest.totalDebt - latest.totalDebt,
    debtChangePercentage: oldest.totalDebt > 0
      ? ((oldest.totalDebt - latest.totalDebt) / oldest.totalDebt) * 100
      : 0,
    utilizationChange: oldest.creditUtilization - latest.creditUtilization,
    daysTracked: Math.floor(
      (new Date(latest.timestamp).getTime() - new Date(oldest.timestamp).getTime()) / 
      (1000 * 60 * 60 * 24)
    )
  };
}

function calculateTrends(snapshots: any[]) {
  if (snapshots.length === 0) return null;

  const debtOverTime = snapshots.map(s => ({
    date: s.timestamp,
    totalDebt: s.totalDebt,
    creditUtilization: s.creditUtilization
  }));

  return {
    debtOverTime,
    averageMonthlyReduction: calculateAvgMonthlyReduction(snapshots),
    trend: snapshots.length > 1 && snapshots[0].totalDebt < snapshots[snapshots.length - 1].totalDebt
      ? 'improving'
      : 'stable'
  };
}

function calculateAvgMonthlyReduction(snapshots: any[]): number {
  if (snapshots.length < 2) return 0;

  let totalReduction = 0;
  let monthsCount = 0;

  for (let i = 1; i < snapshots.length; i++) {
    const reduction = snapshots[i - 1].totalDebt - snapshots[i].totalDebt;
    if (reduction > 0) {
      totalReduction += reduction;
      monthsCount++;
    }
  }

  return monthsCount > 0 ? totalReduction / monthsCount : 0;
}

function calculateMilestones(snapshots: any[]): string[] {
  if (snapshots.length === 0) return [];

  const milestones: string[] = [];
  const latest = snapshots[snapshots.length - 1];

  if (latest.creditUtilization < 0.3) {
    milestones.push('Under 30% credit utilization');
  }
  if (latest.creditUtilization < 0.1) {
    milestones.push('Under 10% credit utilization');
  }
  if (snapshots.length >= 30) {
    milestones.push('30 days of tracking');
  }
  if (snapshots.length >= 90) {
    milestones.push('90 days of tracking');
  }

  return milestones;
}

function calculateProjections(snapshots: any[]) {
  if (snapshots.length < 2) return null;

  const avgReduction = calculateAvgMonthlyReduction(snapshots);
  const currentDebt = snapshots[snapshots.length - 1]?.totalDebt || 0;

  if (avgReduction <= 0 || currentDebt <= 0) return null;

  const projectedMonthsToDebtFree = Math.ceil(currentDebt / avgReduction);
  const projectedDebtFreeDate = new Date();
  projectedDebtFreeDate.setMonth(projectedDebtFreeDate.getMonth() + projectedMonthsToDebtFree);

  return {
    projectedMonthsToDebtFree,
    projectedDebtFreeDate: projectedDebtFreeDate.toISOString(),
    basedOnAvgMonthlyReduction: avgReduction
  };
}

function calculateAvgTenure(users: any[]): number {
  if (users.length === 0) return 0;

  const now = new Date();
  const totalMonths = users.reduce((sum, user) => {
    const created = new Date(user.createdAt || now);
    const months = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return sum + months;
  }, 0);

  return totalMonths / users.length;
}
