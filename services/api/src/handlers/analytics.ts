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

import { getEffectiveUserContext } from '../middleware/impersonate';

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
  // Use impersonation-aware context
  const effective = getEffectiveUserContext(event);
  if (!effective) {
    return forbidden('Authorization context required');
  }
  const effectiveUserId = effective.effectiveUserId;
  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return forbidden(auth.reason);
  }
  const { context } = auth;
  const tenantId = context.tenantId;

  try {
    // Get user's credit cards
  const cardsPK = createTenantKey(tenantId, 'USER', effectiveUserId);
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
  const snapshotsPK = createTenantKey(tenantId, 'USER', effectiveUserId);
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
      userId: effectiveUserId,
      tenantId,
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
  const pk = createTenantKey(tenantId, 'USER', effectiveUserId);
    const sk = `SNAPSHOT#${now}#${snapshotId}`;
    await putItem(SNAPSHOTS_TABLE, {
      PK: pk,
      SK: sk,
      ...snapshot
    });

    // Log action
    await auditLog({
  tenantId,
  userId: context.userId,
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
  // Use impersonation-aware context
  const effective = getEffectiveUserContext(event);
  if (!effective) {
    return forbidden('Authorization context required');
  }
  const effectiveUserId = effective.effectiveUserId;
  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return forbidden(auth.reason);
  }
  const { context } = auth;
  const tenantId = context.tenantId;
  const { limit = '30', startDate, endDate } = event.queryStringParameters || {};

  try {
    // Query snapshots
  const pk = createTenantKey(tenantId, 'USER', effectiveUserId);
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
  tenantId,
  userId: context.userId,
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
  // Use impersonation-aware context
  const effective = getEffectiveUserContext(event);
  if (!effective) {
    return forbidden('Authorization context required');
  }
  const effectiveUserId = effective.effectiveUserId;
  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return forbidden(auth.reason);
  }
  const { context } = auth;
  const tenantId = context.tenantId;

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
      userId: effectiveUserId,
      tenantId,
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
  const pk = createTenantKey(tenantId, 'USER', effectiveUserId);
    const sk = `GOAL#${now}#${goalId}`;
    await putItem(GOALS_TABLE, {
      PK: pk,
      SK: sk,
      ...goal
    });

    await auditLog({
  tenantId,
  userId: context.userId,
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
  // Use impersonation-aware context
  const effective = getEffectiveUserContext(event);
  if (!effective) {
    return forbidden('Authorization context required');
  }
  const effectiveUserId = effective.effectiveUserId;
  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return forbidden(auth.reason);
  }
  const { context } = auth;
  const tenantId = context.tenantId;
  const { status } = event.queryStringParameters || {};

  try {
  const pk = createTenantKey(tenantId, 'USER', effectiveUserId);
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
  tenantId,
  userId: context.userId,
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
  // Use impersonation-aware context
  const effective = getEffectiveUserContext(event);
  if (!effective) {
    return forbidden('Authorization context required');
  }
  const effectiveUserId = effective.effectiveUserId;
  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return forbidden(auth.reason);
  }
  const { context } = auth;
  const tenantId = context.tenantId;
  const goalId = event.pathParameters?.goalId;

  if (!goalId) {
    return badRequest('Goal ID is required');
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { currentAmount, status, progress, isOnTrack } = body;

    // Get existing goal
  const pk = createTenantKey(tenantId, 'USER', effectiveUserId);
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
  tenantId,
  userId: context.userId,
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
  // Use impersonation-aware context
  const effective = getEffectiveUserContext(event);
  if (!effective) {
    return forbidden('Authorization context required');
  }
  const effectiveUserId = effective.effectiveUserId;
  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return forbidden(auth.reason);
  }
  const { context } = auth;
  const tenantId = context.tenantId;

  try {
    // Get snapshots
    const snapshotsPK = createTenantKey(tenantId, 'USER', effectiveUserId);
    const snapshots = await queryItems(SNAPSHOTS_TABLE, snapshotsPK, {
      sortKeyCondition: 'begins_with(SK, :skPrefix)',
      expressionAttributeValues: { ':skPrefix': 'SNAPSHOT#' }
    });
    
    // Get goals
    const goalsPK = createTenantKey(tenantId, 'USER', effectiveUserId);
    const goals = await queryItems(GOALS_TABLE, goalsPK, {
      sortKeyCondition: 'begins_with(SK, :skPrefix)',
      expressionAttributeValues: { ':skPrefix': 'GOAL#' }
    });

    // Get user's budgets
    const budgetsPK = createTenantKey(tenantId, 'USER', effectiveUserId);
    const budgets = await queryItems(
      process.env.BUDGETS_TABLE || 'tyche-budgets',
      budgetsPK,
      {
        sortKeyCondition: 'begins_with(SK, :skPrefix)',
        expressionAttributeValues: { ':skPrefix': 'BUDGET#' }
      }
    );

    // Get spending analytics if available
    const analyticsItems = await queryItems(
      process.env.SPENDING_ANALYTICS_TABLE || 'tyche-spending-analytics',
      budgetsPK,
      {
        sortKeyCondition: 'begins_with(SK, :skPrefix)',
        expressionAttributeValues: { ':skPrefix': 'ANALYTICS#' }
      }
    );

    // Parse and structure budget data
    const budgetData = (budgets || [])
      .sort((a, b) => (b.month || '').localeCompare(a.month || '')) // Most recent first
      .map(b => {
        // Defensive parsing: handle cases where categories might be stored as a string
        let categories = b.categories;
        if (categories && typeof categories === 'string') {
          try {
            categories = JSON.parse(categories);
          } catch (err) {
            console.error('[GetProgressReport] Failed to parse categories string:', err);
            categories = [];
          }
        }
        if (!Array.isArray(categories)) {
          categories = [];
        }

        // Calculate actualDiscretionaryIncome if not present (for backwards compatibility)
        const actualIncome = b.totalActualIncome || 0;
        const actualExpenses = b.totalActualExpenses || 0;
        const actualDiscretionary = b.actualDiscretionaryIncome ?? (actualIncome - actualExpenses);

        // Calculate suggested amounts if not present
        const suggestedCC = b.suggestedCreditCardPayment ?? (actualDiscretionary > 0 ? Math.floor(actualDiscretionary * 0.5) : 0);
        const suggestedSavings = b.suggestedSavings ?? Math.max(0, actualDiscretionary - suggestedCC);

        console.log(`[Analytics] Budget ${b.month}: actualIncome=${actualIncome}, actualExpenses=${actualExpenses}, actualDiscretionary=${actualDiscretionary}, suggestedCC=${suggestedCC}, suggestedSavings=${suggestedSavings}`);

        return {
          month: b.month,
          totalIncome: b.totalIncome || 0,
          totalActualIncome: actualIncome,
          totalPlannedExpenses: b.totalPlannedExpenses || 0,
          totalActualExpenses: actualExpenses,
          categories,
          discretionaryIncome: b.discretionaryIncome || 0,
          actualDiscretionaryIncome: actualDiscretionary,
          suggestedCreditCardPayment: suggestedCC,
          suggestedSavings: suggestedSavings,
          availableForDebtPayoff: b.availableForDebtPayoff || 0,
          incomeBreakdown: b.incomeBreakdown || {},
          debtPaymentBudget: b.debtPaymentBudget || 0,
          savingsBudget: b.savingsBudget || 0,
          status: b.status || 'active',
          createdAt: b.createdAt,
          updatedAt: b.updatedAt
        };
      });

    // Parse spending analytics
    const spendingData = (analyticsItems || [])
      .sort((a, b) => (b.period || '').localeCompare(a.period || '')) // Most recent first
      .map(item => ({
        period: item.period,
        spendingByCategory: item.spendingByCategory || {},
        totalBudgeted: item.totalBudgeted || 0,
        totalSpent: item.totalSpent || 0,
        totalIncome: item.totalIncome || 0,
        netIncome: item.netIncome || 0,
        topCategories: item.topCategories || [],
        overspentCategories: item.overspentCategories || [],
        underspentCategories: item.underspentCategories || []
      }));

    // Sort snapshots by date
    const sortedSnapshots = (snapshots || []).sort((a, b) => 
      a.timestamp.localeCompare(b.timestamp)
    );


    // --- AgentKit Analytics (DISABLED - will be re-enabled as cached/on-demand feature) ---
    // AI insights should be:
    // 1. Generated only when requested (not on every page load)
    // 2. Cached in the database for reuse
    // 3. Include actual budget and spending data (not just empty snapshots)
    // 4. Triggered by user action or scheduled job
    //
    // For now, we return null to avoid unnecessary AI API calls and costs
    let agentkitResult = null;

    // TODO: Implement proper AI insights:
    // - Add a separate endpoint: POST /v1/analytics/generate-insights
    // - Store insights in tyche-user-analytics table with TTL
    // - Include budget data, spending patterns, and actual financial metrics
    // - Only regenerate when user explicitly requests or data changes significantly

    const report = {
      summary: {
        totalSnapshots: sortedSnapshots.length,
        firstSnapshotDate: sortedSnapshots[0]?.timestamp,
        latestSnapshotDate: sortedSnapshots[sortedSnapshots.length - 1]?.timestamp,
        activeGoals: (goals || []).filter(g => g.status === 'active').length,
        completedGoals: (goals || []).filter(g => g.status === 'completed').length,
        totalBudgets: budgetData.length,
        latestBudgetMonth: budgetData[0]?.month
      },
      trends: calculateTrends(sortedSnapshots),
      goals: goals || [],
      milestones: calculateMilestones(sortedSnapshots),
      projections: calculateProjections(sortedSnapshots),
      // Budget and spending data
      budgets: budgetData,
      spendingAnalytics: spendingData,
      agentkit: agentkitResult // New: AgentKit-powered analytics summary
    };

    await auditLog({
  tenantId,
  userId: context.userId,
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
  // Use impersonation-aware context
  const effective = getEffectiveUserContext(event);
  if (!effective) {
    return forbidden('Authorization context required');
  }
  const effectiveUserId = effective.effectiveUserId;
  const auth = await authorize(event, 'dev');
  if (!auth.authorized || !auth.context) {
    return forbidden(auth.reason);
  }
  const { context } = auth;
  const tenantId = context.tenantId;

  try {
    // Get all users in tenant
    const users = await queryByIndex(
      USERS_TABLE,
      'RoleIndex',
      'tenantId',
      context!.tenantId
    );


    // --- AgentKit Analytics ---
  const agent = createAgent({ userId: effectiveUserId });
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
  tenantId,
  userId: context.userId,
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

/**
 * POST /v1/analytics/insights/generate
 * Generate AI-powered financial insights for user (on-demand, with caching)
 *
 * This endpoint:
 * 1. Checks for cached insights (valid for 24 hours)
 * 2. If stale/missing, gathers comprehensive financial data
 * 3. Generates AI insights with actual budget, spending, debt data
 * 4. Caches results in DynamoDB with TTL
 * 5. Returns insights to display on analytics page
 */
export async function generateAIInsights(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const effective = getEffectiveUserContext(event);
  if (!effective) {
    return forbidden('Authorization context required');
  }
  const effectiveUserId = effective.effectiveUserId;

  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return forbidden(auth.reason);
  }
  const { context } = auth;
  const tenantId = context.tenantId;

  try {
    const pk = createTenantKey(tenantId, 'USER', effectiveUserId);
    const insightsSK = `INSIGHTS#LATEST`;

    // 1. Check cache first (valid for 24 hours)
    const cached = await getItem(ANALYTICS_TABLE, pk, insightsSK);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    if (cached && isFresh(cached, maxAge)) {
      console.log('[GenerateAIInsights] Returning cached insights');
      return ok({
        insights: cached.insights,
        cached: true,
        generatedAt: cached.generatedAt
      });
    }

    console.log('[GenerateAIInsights] Generating new insights for user:', effectiveUserId);

    // 2. Gather comprehensive financial data
    const [budgets, transactions, snapshots, goals, cards] = await Promise.all([
      queryItems(process.env.BUDGETS_TABLE || 'tyche-budgets', pk, {
        sortKeyCondition: 'begins_with(SK, :skPrefix)',
        expressionAttributeValues: { ':skPrefix': 'BUDGET#' }
      }),
      queryItems(process.env.TRANSACTIONS_TABLE || 'tyche-transactions', pk, {
        sortKeyCondition: 'begins_with(SK, :skPrefix)',
        expressionAttributeValues: { ':skPrefix': 'TX#' },
        limit: 100 // Last 100 transactions
      }),
      queryItems(SNAPSHOTS_TABLE, pk, {
        sortKeyCondition: 'begins_with(SK, :skPrefix)',
        expressionAttributeValues: { ':skPrefix': 'SNAPSHOT#' }
      }),
      queryItems(GOALS_TABLE, pk, {
        sortKeyCondition: 'begins_with(SK, :skPrefix)',
        expressionAttributeValues: { ':skPrefix': 'GOAL#' }
      }),
      queryItems(process.env.CREDIT_CARDS_TABLE || 'tyche-credit-cards', pk, {
        sortKeyCondition: 'begins_with(SK, :skPrefix)',
        expressionAttributeValues: { ':skPrefix': 'CARD#' }
      })
    ]);

    // 3. Build comprehensive analysis prompt
    const prompt = buildFinancialAnalysisPrompt({
      budgets,
      transactions,
      snapshots,
      goals,
      cards,
      userId: effectiveUserId
    });

    // 4. Generate AI insights
    const agent = createAgent({ userId: effectiveUserId });
    let insights: string;

    try {
      insights = await agent.chat(prompt);
    } catch (err: any) {
      console.error('[GenerateAIInsights] AI generation failed:', err);
      return badRequest(`Failed to generate insights: ${err.message}`);
    }

    // 5. Cache insights with 24-hour TTL
    const now = timestamp();
    await putItem(ANALYTICS_TABLE, {
      PK: pk,
      SK: insightsSK,
      itemType: 'AI_INSIGHTS',
      insights,
      generatedAt: now,
      ttl: ttl24Hours(),
      dataVersion: {
        budgetsCount: budgets?.length || 0,
        transactionsCount: transactions?.length || 0,
        snapshotsCount: snapshots?.length || 0,
        goalsCount: goals?.length || 0
      }
    });

    // 6. Audit log
    await auditLog({
      tenantId,
      userId: context.userId,
      role: context.role,
      action: 'generate_ai_insights',
      resource: 'analytics',
      success: true
    });

    console.log('[GenerateAIInsights] Successfully generated and cached insights');

    return ok({
      insights,
      cached: false,
      generatedAt: now
    });

  } catch (error) {
    console.error('[GenerateAIInsights] Error:', error);

    await auditLog({
      tenantId: context.tenantId,
      userId: context.userId,
      role: context.role,
      action: 'generate_ai_insights',
      resource: 'analytics',
      success: false,
      errorMessage: String(error)
    });

    return badRequest('Failed to generate AI insights');
  }
}

/**
 * Build a comprehensive financial analysis prompt for AI
 */
function buildFinancialAnalysisPrompt(data: {
  budgets: any[];
  transactions: any[];
  snapshots: any[];
  goals: any[];
  cards: any[];
  userId: string;
}): import('@tyche/ai').ChatMessage[] {
  const { budgets, transactions, snapshots, goals, cards } = data;

  // Process budgets
  const latestBudget = budgets?.[0];
  const budgetSummary = latestBudget ? {
    month: latestBudget.month,
    totalIncome: latestBudget.totalIncome,
    totalActualIncome: latestBudget.totalActualIncome || 0,
    totalPlannedExpenses: latestBudget.totalPlannedExpenses,
    totalActualExpenses: latestBudget.totalActualExpenses || 0,
    discretionaryIncome: latestBudget.discretionaryIncome,
    actualDiscretionaryIncome: latestBudget.actualDiscretionaryIncome || (latestBudget.totalActualIncome || 0) - (latestBudget.totalActualExpenses || 0),
    suggestedCreditCardPayment: latestBudget.suggestedCreditCardPayment || 0,
    suggestedSavings: latestBudget.suggestedSavings || 0,
    topCategories: (latestBudget.categories || [])
      .filter((c: any) => c.monthlyBudget > 0)
      .sort((a: any, b: any) => b.monthlyBudget - a.monthlyBudget)
      .slice(0, 5)
      .map((c: any) => ({ category: c.categoryType, budget: c.monthlyBudget }))
  } : null;

  // Process transactions
  const recentTransactions = (transactions || [])
    .slice(0, 20)
    .map((t: any) => ({
      date: t.date,
      amount: t.amount,
      category: t.category,
      description: t.description,
      isIncome: t.isIncome
    }));

  // Process debt snapshots
  const latestSnapshot = snapshots?.sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp)
  )[0];

  const debtProgress = snapshots && snapshots.length > 1 ? {
    current: latestSnapshot,
    trend: snapshots.length > 1 ?
      latestSnapshot.totalDebt - snapshots[snapshots.length - 1].totalDebt : 0
  } : null;

  // Process credit cards
  const cardsSummary = {
    totalCards: cards?.length || 0,
    totalDebt: cards?.reduce((sum, c) => sum + (c.balance || 0), 0) || 0,
    totalLimit: cards?.reduce((sum, c) => sum + (c.limit || 0), 0) || 0,
    avgAPR: cards && cards.length > 0 ?
      cards.reduce((sum, c) => sum + (c.apr || 0), 0) / cards.length : 0
  };

  // Calculate proactive alerts (Feature #4)
  const now = new Date();
  const currentDay = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgress = currentDay / daysInMonth;

  // Calculate days since last transaction
  const sortedTransactions = (transactions || []).sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const lastTransactionDate = sortedTransactions[0]?.date;
  const daysSinceLastTransaction = lastTransactionDate ?
    Math.floor((now.getTime() - new Date(lastTransactionDate).getTime()) / (1000 * 60 * 60 * 24)) : 999;

  // Calculate spending pace and proactive alerts by category
  const categoryAlerts: any[] = [];
  if (latestBudget?.categories) {
    const categoriesArray = Array.isArray(latestBudget.categories) ? latestBudget.categories : [];

    for (const cat of categoriesArray) {
      const budgeted = cat.monthlyBudget || 0;
      const spent = cat.actualSpent || 0;

      if (budgeted > 0) {
        const expectedSpendingByNow = budgeted * monthProgress;
        const projectedMonthEnd = monthProgress > 0 ? (spent / monthProgress) : spent;
        const projectedOverspend = projectedMonthEnd - budgeted;

        if (projectedOverspend > 0 && projectedOverspend > budgeted * 0.1) {
          categoryAlerts.push({
            category: cat.categoryType,
            budgeted: budgeted,
            spent: spent,
            projected: Math.round(projectedMonthEnd),
            overspend: Math.round(projectedOverspend),
            severity: projectedOverspend > budgeted * 0.25 ? 'HIGH' : 'MEDIUM'
          });
        }
      }
    }
  }

  // Check discretionary income alert
  const discretionaryAlert = budgetSummary &&
    budgetSummary.actualDiscretionaryIncome > budgetSummary.discretionaryIncome * 1.2 ? {
      type: 'POSITIVE',
      amount: budgetSummary.actualDiscretionaryIncome - budgetSummary.discretionaryIncome,
      message: 'Your actual discretionary income is higher than expected!'
    } : null;

  // Process goals with velocity calculations (Feature #6)
  const activeGoals = (goals || [])
    .filter(g => g.status === 'active')
    .map(g => {
      const createdAt = g.createdAt ? new Date(g.createdAt) : now;
      const targetDate = g.targetDate ? new Date(g.targetDate) : now;
      const monthsSinceStart = Math.max((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24 * 30), 0.1);
      const progressPerMonth = (g.progress || 0) / monthsSinceStart;
      const remainingProgress = 1 - (g.progress || 0);
      const monthsToCompletion = progressPerMonth > 0 ? remainingProgress / progressPerMonth : 999;
      const projectedDate = new Date(now.getTime() + monthsToCompletion * 30 * 24 * 60 * 60 * 1000);
      const isOnTrack = projectedDate <= targetDate;

      return {
        type: g.type,
        title: g.title,
        progress: g.progress || 0,
        currentValue: g.currentValue || 0,
        targetValue: g.targetValue || 0,
        targetDate: g.targetDate,
        progressPerMonth: (progressPerMonth * 100).toFixed(1),
        monthsToCompletion: Math.ceil(monthsToCompletion),
        projectedDate: projectedDate.toISOString().split('T')[0],
        status: isOnTrack ? 'ON TRACK ✅' : 'BEHIND SCHEDULE ⚠️'
      };
    });

  // Build the prompt
  const systemPrompt = `You are a personal financial advisor speaking directly to your client. Analyze their financial situation and provide personalized advice.

TONE & STYLE:
- Speak directly to the user using "you" and "your" (second person)
- Be supportive, encouraging, and professional
- Frame insights as personal advice: "You're doing well with..." not "The user is doing well with..."
- Use "I recommend..." or "Consider..." when making suggestions
- Be conversational but professional - like a trusted financial advisor
- CELEBRATE WINS! When they're doing well, acknowledge it enthusiastically

FOCUS AREAS:
1. **Proactive Alerts** ⚠️ - Immediately flag overspending risks and opportunities
2. **Discretionary Income Analysis** - Explain the variance between their expected and actual discretionary income
3. **Spending patterns** - Highlight where they're staying on budget or overspending
4. **Debt management** - Evaluate the suggested credit card payment and recommend adjustments
5. **Savings opportunities** - Assess suggested savings and identify ways to increase it
6. **Financial goals** - Track progress velocity and project completion dates
7. **Behavioral coaching** - Celebrate successes and encourage positive financial habits
8. **Risk factors** - Alert them to financial risks, overspending trends, or concerns

IMPORTANT ENHANCEMENTS:
- START with proactive alerts - catch problems before they happen
- For goals, always mention: "At your current pace, you'll reach [goal] in X months"
- Celebrate wins: categories under budget, positive discretionary variance, goal progress
- Be specific with timelines and dollar amounts

Provide specific, actionable advice about how to allocate their discretionary income. Use dollar amounts and percentages to be concrete.

Be concise, supportive, and actionable. Use bullet points and clear sections.`;

  const userPrompt = `Analyze this user's financial situation and provide insights:

## 🚨 PROACTIVE ALERTS (Feature #4)
### Spending Pace Warnings
${categoryAlerts.length > 0 ? categoryAlerts.map(alert =>
  `⚠️ **${alert.severity}**: You're on track to overspend in **${alert.category}** by **$${alert.overspend}**
  - Budgeted: $${alert.budgeted}
  - Spent so far: $${alert.spent} (${Math.round(alert.spent / alert.budgeted * 100)}% of budget)
  - Projected month-end: $${alert.projected}`
).join('\n\n') : '✅ No overspending alerts - you\'re staying within budget!'}

${discretionaryAlert ? `💰 **OPPORTUNITY**: ${discretionaryAlert.message}
- Surplus: $${Math.round(discretionaryAlert.amount)}
- Recommend allocating this to debt payment or savings` : ''}

${daysSinceLastTransaction > 7 ? `📝 **TRACKING REMINDER**: It's been ${daysSinceLastTransaction} days since your last transaction entry. Staying current helps with accuracy!` : ''}

### Current Month Progress
- Days into month: ${currentDay} of ${daysInMonth} (${Math.round(monthProgress * 100)}% complete)

---

## Budget (${budgetSummary?.month || 'N/A'})
### Income Analysis
- Planned Monthly Income: $${budgetSummary?.totalIncome?.toLocaleString() || 0}
- Actual Income Received: $${budgetSummary?.totalActualIncome?.toLocaleString() || 0}
- Income Variance: ${budgetSummary?.totalActualIncome && budgetSummary?.totalIncome ?
    ((budgetSummary.totalActualIncome - budgetSummary.totalIncome) / budgetSummary.totalIncome * 100).toFixed(1) : 0}%

### Expense Analysis
- Planned Expenses: $${budgetSummary?.totalPlannedExpenses?.toLocaleString() || 0}
- Actual Expenses: $${budgetSummary?.totalActualExpenses?.toLocaleString() || 0}
- Spending Variance: ${budgetSummary?.totalActualExpenses && budgetSummary?.totalPlannedExpenses ?
    ((budgetSummary.totalActualExpenses - budgetSummary.totalPlannedExpenses) / budgetSummary.totalPlannedExpenses * 100).toFixed(1) : 0}%

### Discretionary Income Analysis (IMPORTANT)
- **Expected Discretionary Income**: $${budgetSummary?.discretionaryIncome?.toLocaleString() || 0} (Planned Income - Planned Expenses)
- **Actual Discretionary Income**: $${budgetSummary?.actualDiscretionaryIncome?.toLocaleString() || 0} (Actual Income - Actual Expenses)
- **Variance**: ${budgetSummary?.actualDiscretionaryIncome && budgetSummary?.discretionaryIncome ?
    ((budgetSummary.actualDiscretionaryIncome - budgetSummary.discretionaryIncome) / budgetSummary.discretionaryIncome * 100).toFixed(1) : 0}%

### AI-Suggested Allocations
- **Suggested Credit Card Payment**: $${budgetSummary?.suggestedCreditCardPayment?.toLocaleString() || 0} (${budgetSummary?.actualDiscretionaryIncome ?
    (budgetSummary.suggestedCreditCardPayment / budgetSummary.actualDiscretionaryIncome * 100).toFixed(0) : 0}% of actual discretionary)
- **Suggested Savings**: $${budgetSummary?.suggestedSavings?.toLocaleString() || 0} (${budgetSummary?.actualDiscretionaryIncome ?
    (budgetSummary.suggestedSavings / budgetSummary.actualDiscretionaryIncome * 100).toFixed(0) : 0}% of actual discretionary)

Top Spending Categories:
${budgetSummary?.topCategories?.map((c: any) => `- ${c.category}: $${c.budget}`).join('\n') || 'No data'}

## Credit Card Debt
- Total Cards: ${cardsSummary.totalCards}
- Total Debt: $${cardsSummary.totalDebt?.toLocaleString()}
- Total Credit Limit: $${cardsSummary.totalLimit?.toLocaleString()}
- Credit Utilization: ${cardsSummary.totalLimit > 0 ?
    ((cardsSummary.totalDebt / cardsSummary.totalLimit) * 100).toFixed(1) : 0}%
- Average APR: ${cardsSummary.avgAPR?.toFixed(2)}%

${debtProgress ? `## Debt Progress
- Current Debt: $${debtProgress.current.totalDebt?.toLocaleString()}
- Change: ${debtProgress.trend > 0 ? '+' : ''}$${debtProgress.trend?.toLocaleString()}
- Credit Utilization: ${(debtProgress.current.creditUtilization * 100).toFixed(1)}%` : ''}

## Recent Transactions (Last 20)
${recentTransactions.length > 0 ?
  recentTransactions.map(t =>
    `- ${t.date}: ${t.isIncome ? '+' : '-'}$${t.amount} - ${t.category} (${t.description})`
  ).join('\n') : 'No recent transactions'}

## 🎯 Financial Goals (Feature #6 - With Velocity Tracking)
${activeGoals.length > 0 ?
  activeGoals.map(g =>
    `### ${g.title} (${g.type})
- Current Progress: ${(g.progress * 100).toFixed(0)}% (${g.currentValue ? `$${g.currentValue.toLocaleString()}` : 'N/A'} of ${g.targetValue ? `$${g.targetValue.toLocaleString()}` : 'N/A'})
- Target Date: ${g.targetDate}
- Progress Velocity: ${g.progressPerMonth}% per month
- **Projected Completion: ${g.projectedDate}** (in ${g.monthsToCompletion} months)
- Status: ${g.status}
- ${g.status.includes('ON TRACK') ? '✅ Keep up the great work!' : '⚠️ Consider increasing efforts to meet your deadline'}`
  ).join('\n\n') : 'No active goals set'}

---

## 📊 YOUR ANALYSIS STRUCTURE:

### 1. 🎉 WINS THIS MONTH (Feature #7 - Behavioral Coaching)
**Celebrate specific achievements with dollar amounts:**
- Categories where they're UNDER budget
- If actual discretionary > expected discretionary (surplus amount)
- Any debt reduction from previous snapshot
- Goals making positive progress
- Consistent transaction tracking (if applicable)

**Use enthusiastic language:** "Amazing work!", "You're crushing it!", "Keep this up!"

### 2. ⚠️ PROACTIVE ACTIONS NEEDED (Feature #4 - Based on Alerts Above)
**Reference the specific alerts and provide actionable steps:**
- For overspending categories: specific reduction suggestions
- For discretionary surplus: exact allocation recommendations
- For tracking gaps: encourage consistency

### 3. 💰 DISCRETIONARY INCOME INSIGHTS
- Analyze the variance between Expected ($${budgetSummary?.discretionaryIncome || 0}) and Actual ($${budgetSummary?.actualDiscretionaryIncome || 0})
- Explain what caused the difference (higher/lower income? More/less spending?)
- Evaluate if the suggested allocations (CC payment: $${budgetSummary?.suggestedCreditCardPayment || 0}, Savings: $${budgetSummary?.suggestedSavings || 0}) are appropriate

### 4. 📈 SPENDING PATTERNS
- Compare actual vs planned spending
- Identify concerning patterns or positive trends
- Highlight categories where they're over/under budget

### 5. 💳 DEBT MANAGEMENT STRATEGY
- Evaluate the suggested credit card payment amount
- Recommend if they should pay more/less based on their debt situation
- Calculate potential interest savings from suggested payment vs minimum

### 6. 🎯 GOAL PROGRESS INSIGHTS (Feature #6)
**For each goal, provide specific guidance:**
- Acknowledge if they're ON TRACK or BEHIND
- If behind: "To meet your ${budgetSummary?.month} deadline, increase your monthly contribution by $X"
- If on track: "At your current pace of X% per month, you'll reach this goal in Y months"

### 7. 🌟 BEHAVIORAL COACHING (Feature #7)
**End on a positive note:**
- Identify one key success streak (e.g., "3 weeks under budget in groceries")
- Suggest ONE specific behavior change based on their data
- Provide encouragement tied to their progress

Format as markdown with clear sections, bullet points, and emojis. Be specific with dollar amounts and percentages.`;

  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
}

// Update imports at the top of the file to include new functions
import { ttl24Hours, isFresh } from '../utils/db';
