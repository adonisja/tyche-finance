/**
 * Budget Management Handlers
 * 
 * Comprehensive API handlers for budget and spending management:
 * - Monthly budget CRUD operations
 * - Budget category management
 * - Transaction tracking and categorization
 * - Spending analytics and insights
 * - Recurring transaction templates
 * - Budget goals with progress tracking
 * 
 * 🎯 Purpose: Enable users to create budgets and track spending for personalized debt payoff recommendations
 * 📊 Analytics: Pre-calculated insights for fast dashboard loading
 * 🔒 Security: Multi-tenant isolation, user-level authorization
 */

import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { 
  MonthlyBudget, 
  BudgetCategory, 
  TransactionRecord, 
  SpendingAnalytics,
  RecurringTransaction,
  BudgetGoal,
  BudgetCategoryType 
} from '@tyche/types';
import { ok, created, badRequest, notFound, serverError } from '../utils';
import { parseBody } from '../utils';
import { 
  createTenantKey, 
  generateId, 
  timestamp,
  putItem, 
  getItem, 
  queryItems, 
  updateItem, 
  deleteItem 
} from '../utils/db';
import { authorize } from '../middleware/authorize';

// Environment variables
const BUDGETS_TABLE = process.env.BUDGETS_TABLE || 'tyche-budgets';
const TRANSACTION_DETAILS_TABLE = process.env.TRANSACTION_DETAILS_TABLE || 'tyche-transaction-details';
const SPENDING_ANALYTICS_TABLE = process.env.SPENDING_ANALYTICS_TABLE || 'tyche-spending-analytics';
const BUDGET_GOALS_TABLE = process.env.BUDGET_GOALS_TABLE || 'tyche-budget-goals';

// ========================================
// MONTHLY BUDGET OPERATIONS
// ========================================

/**
 * Get monthly budget for a specific month
 * GET /v1/budgets/:month
 * 
 * @param month - Format: YYYY-MM (e.g., "2025-01")
 * @returns MonthlyBudget with all categories and calculated totals
 */
export async function getBudget(event: APIGatewayProxyEventV2, userId?: string) {
  if (!userId) {
    return badRequest('User ID required');
  }

  const month = event.pathParameters?.month;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return badRequest('Valid month required (format: YYYY-MM)');
  }

  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return badRequest('Authorization required');
  }

  const { tenantId } = auth.context;

  try {
    const pk = createTenantKey(tenantId, 'USER', userId);
    const sk = `BUDGET#${month}`;

    const budget = await getItem(BUDGETS_TABLE, pk, sk);

    if (!budget) {
      return notFound(`Budget not found for ${month}`);
    }

    console.log(`[GetBudget] userId=${userId} month=${month} found`);
    return ok({ budget });
  } catch (error) {
    console.error('[GetBudget] Error:', error);
    return serverError('Failed to fetch budget');
  }
}

/**
 * Create new monthly budget
 * POST /v1/budgets
 * 
 * Body: {
 *   month: string,              // YYYY-MM
 *   totalIncome: number,
 *   incomeBreakdown: { ... },
 *   debtPaymentBudget: number,
 *   savingsBudget: number
 * }
 */
export async function createBudget(event: APIGatewayProxyEventV2, userId?: string) {
  if (!userId) {
    return badRequest('User ID required');
  }

  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return badRequest('Authorization required');
  }

  const { tenantId } = auth.context;
  const body = parseBody(event);

  // Validate required fields
  if (!body.month || !/^\d{4}-\d{2}$/.test(body.month)) {
    return badRequest('Valid month required (format: YYYY-MM)');
  }
  if (typeof body.totalIncome !== 'number' || body.totalIncome < 0) {
    return badRequest('Valid totalIncome required');
  }

  try {
    // Check if budget already exists for this month
    const pk = createTenantKey(tenantId, 'USER', userId);
    const sk = `BUDGET#${body.month}`;
    
    const existing = await getItem(BUDGETS_TABLE, pk, sk);
    if (existing) {
      return badRequest(`Budget already exists for ${body.month}`);
    }

    // Create budget item
    const budgetId = generateId('budget');
    const now = timestamp();

    const budget: MonthlyBudget = {
      id: budgetId,
      userId,
      tenantId,
      month: body.month,
      
      // Income
      totalIncome: body.totalIncome,
      incomeBreakdown: body.incomeBreakdown || {},
      
      // Expenses
      totalPlannedExpenses: body.totalPlannedExpenses || 0,
      totalActualExpenses: 0, // Will be calculated from transactions
      
      // Debt & Savings
      debtPaymentBudget: body.debtPaymentBudget || 0,
      savingsBudget: body.savingsBudget || 0,
      
      // Available Funds
      discretionaryIncome: body.totalIncome - (body.totalPlannedExpenses || 0),
      availableForDebtPayoff: body.totalIncome - (body.totalPlannedExpenses || 0) - (body.debtPaymentBudget || 0),
      
      // Status
      status: 'active',
      rolloverBalance: body.rolloverBalance || 0,
      
      createdAt: now,
      updatedAt: now,
    };

    // Store budget
    await putItem(BUDGETS_TABLE, {
      PK: pk,
      SK: sk,
      itemType: 'MONTHLY_BUDGET',
      GSI1PK: `USER#${userId}`,
      GSI1SK: `BUDGET#${body.month}`,
      ...budget,
    });

    console.log(`[CreateBudget] userId=${userId} month=${body.month} created`);
    return created({ budget });
  } catch (error) {
    console.error('[CreateBudget] Error:', error);
    return serverError('Failed to create budget');
  }
}

/**
 * Update monthly budget
 * PUT /v1/budgets/:month
 */
export async function updateBudget(event: APIGatewayProxyEventV2, userId?: string) {
  if (!userId) {
    return badRequest('User ID required');
  }

  const month = event.pathParameters?.month;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return badRequest('Valid month required (format: YYYY-MM)');
  }

  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return badRequest('Authorization required');
  }

  const { tenantId } = auth.context;
  const body = parseBody(event);

  try {
    const pk = createTenantKey(tenantId, 'USER', userId);
    const sk = `BUDGET#${month}`;

    // Verify budget exists
    const existing = await getItem(BUDGETS_TABLE, pk, sk);
    if (!existing) {
      return notFound(`Budget not found for ${month}`);
    }

    // Build update expression
    const updates: any = {
      updatedAt: timestamp(),
    };

    if (body.totalIncome !== undefined) updates.totalIncome = body.totalIncome;
    if (body.incomeBreakdown !== undefined) updates.incomeBreakdown = body.incomeBreakdown;
    if (body.totalPlannedExpenses !== undefined) updates.totalPlannedExpenses = body.totalPlannedExpenses;
    if (body.debtPaymentBudget !== undefined) updates.debtPaymentBudget = body.debtPaymentBudget;
    if (body.savingsBudget !== undefined) updates.savingsBudget = body.savingsBudget;
    if (body.status !== undefined) updates.status = body.status;

    // Recalculate available funds if income or expenses changed
    if (body.totalIncome !== undefined || body.totalPlannedExpenses !== undefined) {
      const income = body.totalIncome ?? existing.totalIncome;
      const expenses = body.totalPlannedExpenses ?? existing.totalPlannedExpenses;
      const debtBudget = body.debtPaymentBudget ?? existing.debtPaymentBudget;
      
      updates.discretionaryIncome = income - expenses;
      updates.availableForDebtPayoff = income - expenses - debtBudget;
    }

    await updateItem(BUDGETS_TABLE, pk, sk, updates);

    const updated = await getItem(BUDGETS_TABLE, pk, sk);

    console.log(`[UpdateBudget] userId=${userId} month=${month} updated`);
    return ok({ budget: updated });
  } catch (error) {
    console.error('[UpdateBudget] Error:', error);
    return serverError('Failed to update budget');
  }
}

/**
 * Delete/archive monthly budget
 * DELETE /v1/budgets/:month
 */
export async function deleteBudget(event: APIGatewayProxyEventV2, userId?: string) {
  if (!userId) {
    return badRequest('User ID required');
  }

  const month = event.pathParameters?.month;
  if (!month) {
    return badRequest('Month required');
  }

  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return badRequest('Authorization required');
  }

  const { tenantId } = auth.context;

  try {
    const pk = createTenantKey(tenantId, 'USER', userId);
    const sk = `BUDGET#${month}`;

    // Archive instead of delete (soft delete)
    await updateItem(BUDGETS_TABLE, pk, sk, {
      status: 'archived',
      updatedAt: timestamp(),
    });

    console.log(`[DeleteBudget] userId=${userId} month=${month} archived`);
    return ok({ message: 'Budget archived' });
  } catch (error) {
    console.error('[DeleteBudget] Error:', error);
    return serverError('Failed to delete budget');
  }
}

/**
 * List all budgets for a user
 * GET /v1/budgets
 */
export async function listBudgets(event: APIGatewayProxyEventV2, userId?: string) {
  if (!userId) {
    return badRequest('User ID required');
  }

  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return badRequest('Authorization required');
  }

  const { tenantId } = auth.context;

  try {
    const pk = createTenantKey(tenantId, 'USER', userId);
    
    const items = await queryItems(BUDGETS_TABLE, pk, {
      sortKeyCondition: 'begins_with(SK, :prefix)',
      expressionAttributeValues: { ':prefix': 'BUDGET#' },
    });

    // Filter out archived budgets unless requested
    const includeArchived = event.queryStringParameters?.includeArchived === 'true';
    const budgets = includeArchived 
      ? items 
      : items.filter((b: any) => b.status !== 'archived');

    console.log(`[ListBudgets] userId=${userId} found=${budgets.length}`);
    return ok({ budgets });
  } catch (error) {
    console.error('[ListBudgets] Error:', error);
    return serverError('Failed to list budgets');
  }
}

// ========================================
// BUDGET CATEGORY OPERATIONS
// ========================================

/**
 * Get all budget categories for a user
 * GET /v1/categories
 */
export async function getCategories(event: APIGatewayProxyEventV2, userId?: string) {
  if (!userId) {
    return badRequest('User ID required');
  }

  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return badRequest('Authorization required');
  }

  const { tenantId } = auth.context;

  try {
    const pk = createTenantKey(tenantId, 'USER', userId);
    
    const categories = await queryItems(BUDGETS_TABLE, pk, {
      sortKeyCondition: 'begins_with(SK, :prefix)',
      expressionAttributeValues: { ':prefix': 'CATEGORY#' },
    });

    console.log(`[GetCategories] userId=${userId} found=${categories.length}`);
    return ok({ categories });
  } catch (error) {
    console.error('[GetCategories] Error:', error);
    return serverError('Failed to fetch categories');
  }
}

/**
 * Create new budget category
 * POST /v1/categories
 * 
 * Body: {
 *   categoryType: BudgetCategoryType,
 *   customName?: string,
 *   monthlyBudget: number,
 *   isEssential: boolean,
 *   color?: string,
 *   icon?: string
 * }
 */
export async function createCategory(event: APIGatewayProxyEventV2, userId?: string) {
  if (!userId) {
    return badRequest('User ID required');
  }

  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return badRequest('Authorization required');
  }

  const { tenantId } = auth.context;
  const body = parseBody(event);

  // Validate required fields
  if (!body.categoryType) {
    return badRequest('categoryType required');
  }
  if (typeof body.monthlyBudget !== 'number' || body.monthlyBudget < 0) {
    return badRequest('Valid monthlyBudget required');
  }
  if (typeof body.isEssential !== 'boolean') {
    return badRequest('isEssential required (boolean)');
  }

  try {
    const categoryId = generateId('cat');
    const now = timestamp();
    const pk = createTenantKey(tenantId, 'USER', userId);
    const sk = `CATEGORY#${categoryId}`;

    const category: BudgetCategory = {
      id: categoryId,
      userId,
      tenantId,
      categoryType: body.categoryType,
      customName: body.customName,
      monthlyBudget: body.monthlyBudget,
      color: body.color,
      icon: body.icon,
      isEssential: body.isEssential,
      notes: body.notes,
      createdAt: now,
      updatedAt: now,
    };

    await putItem(BUDGETS_TABLE, {
      PK: pk,
      SK: sk,
      itemType: 'BUDGET_CATEGORY',
      GSI1PK: `USER#${userId}`,
      GSI1SK: `CATEGORY#${body.categoryType}`,
      ...category,
    });

    console.log(`[CreateCategory] userId=${userId} type=${body.categoryType} created`);
    return created({ category });
  } catch (error) {
    console.error('[CreateCategory] Error:', error);
    return serverError('Failed to create category');
  }
}

/**
 * Update budget category
 * PUT /v1/categories/:id
 */
export async function updateCategory(event: APIGatewayProxyEventV2, userId?: string) {
  if (!userId) {
    return badRequest('User ID required');
  }

  const categoryId = event.pathParameters?.id;
  if (!categoryId) {
    return badRequest('Category ID required');
  }

  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return badRequest('Authorization required');
  }

  const { tenantId } = auth.context;
  const body = parseBody(event);

  try {
    const pk = createTenantKey(tenantId, 'USER', userId);
    const sk = `CATEGORY#${categoryId}`;

    const updates: any = {
      updatedAt: timestamp(),
    };

    if (body.customName !== undefined) updates.customName = body.customName;
    if (body.monthlyBudget !== undefined) updates.monthlyBudget = body.monthlyBudget;
    if (body.color !== undefined) updates.color = body.color;
    if (body.icon !== undefined) updates.icon = body.icon;
    if (body.isEssential !== undefined) updates.isEssential = body.isEssential;
    if (body.notes !== undefined) updates.notes = body.notes;

    await updateItem(BUDGETS_TABLE, pk, sk, updates);
    const updated = await getItem(BUDGETS_TABLE, pk, sk);

    console.log(`[UpdateCategory] userId=${userId} categoryId=${categoryId} updated`);
    return ok({ category: updated });
  } catch (error) {
    console.error('[UpdateCategory] Error:', error);
    return serverError('Failed to update category');
  }
}

/**
 * Delete budget category
 * DELETE /v1/categories/:id
 */
export async function deleteCategory(event: APIGatewayProxyEventV2, userId?: string) {
  if (!userId) {
    return badRequest('User ID required');
  }

  const categoryId = event.pathParameters?.id;
  if (!categoryId) {
    return badRequest('Category ID required');
  }

  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return badRequest('Authorization required');
  }

  const { tenantId } = auth.context;

  try {
    const pk = createTenantKey(tenantId, 'USER', userId);
    const sk = `CATEGORY#${categoryId}`;

    await deleteItem(BUDGETS_TABLE, pk, sk);

    console.log(`[DeleteCategory] userId=${userId} categoryId=${categoryId} deleted`);
    return ok({ message: 'Category deleted' });
  } catch (error) {
    console.error('[DeleteCategory] Error:', error);
    return serverError('Failed to delete category');
  }
}

// ========================================
// TRANSACTION OPERATIONS
// ========================================

/**
 * Get transactions for a month or date range
 * GET /v1/transactions?month=2025-01&category=groceries
 */
export async function getTransactions(event: APIGatewayProxyEventV2, userId?: string) {
  if (!userId) {
    return badRequest('User ID required');
  }

  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return badRequest('Authorization required');
  }

  const { tenantId } = auth.context;
  const month = event.queryStringParameters?.month;
  const category = event.queryStringParameters?.category;

  try {
    const pk = createTenantKey(tenantId, 'USER', userId);

    let transactions;
    
    if (month) {
      // Query by month
      transactions = await queryItems(TRANSACTION_DETAILS_TABLE, pk, {
        sortKeyCondition: 'begins_with(SK, :prefix)',
        expressionAttributeValues: { ':prefix': `TXN#${month}` },
      });
    } else {
      // Get all transactions
      transactions = await queryItems(TRANSACTION_DETAILS_TABLE, pk, {
        sortKeyCondition: 'begins_with(SK, :prefix)',
        expressionAttributeValues: { ':prefix': 'TXN#' },
      });
    }

    // Filter by category if provided
    if (category) {
      transactions = transactions.filter((t: any) => t.category === category);
    }

    console.log(`[GetTransactions] userId=${userId} month=${month} category=${category} found=${transactions.length}`);
    return ok({ transactions });
  } catch (error) {
    console.error('[GetTransactions] Error:', error);
    return serverError('Failed to fetch transactions');
  }
}

/**
 * Create new transaction
 * POST /v1/transactions
 * 
 * Body: {
 *   date: string,               // ISO date
 *   description: string,
 *   amount: number,             // Negative for expenses, positive for income
 *   category: BudgetCategoryType,
 *   categoryId?: string,
 *   source: 'credit_card' | 'manual' | 'import' | 'auto',
 *   cardId?: string,
 *   isIncome: boolean,
 *   isEssential: boolean,
 *   tags?: string[]
 * }
 */
export async function createTransaction(event: APIGatewayProxyEventV2, userId?: string) {
  if (!userId) {
    return badRequest('User ID required');
  }

  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return badRequest('Authorization required');
  }

  const { tenantId } = auth.context;
  const body = parseBody(event);

  // Validate required fields
  if (!body.date) {
    return badRequest('date required');
  }
  if (!body.description) {
    return badRequest('description required');
  }
  if (typeof body.amount !== 'number') {
    return badRequest('Valid amount required');
  }
  if (!body.category) {
    return badRequest('category required');
  }
  if (typeof body.isIncome !== 'boolean') {
    return badRequest('isIncome required (boolean)');
  }
  if (typeof body.isEssential !== 'boolean') {
    return badRequest('isEssential required (boolean)');
  }

  try {
    const txnId = generateId('txn');
    const now = timestamp();
    const txnDate = new Date(body.date);
    const txnTimestamp = txnDate.getTime();
    const dateStr = txnDate.toISOString().split('T')[0]; // YYYY-MM-DD

    const pk = createTenantKey(tenantId, 'USER', userId);
    const sk = `TXN#${dateStr}#${txnTimestamp}#${txnId}`;

    const transaction: TransactionRecord = {
      id: txnId,
      userId,
      tenantId,
      date: body.date,
      description: body.description,
      amount: body.amount,
      currency: body.currency || 'USD',
      category: body.category,
      categoryId: body.categoryId,
      isRecurring: body.isRecurring || false,
      source: body.source || 'manual',
      cardId: body.cardId,
      accountId: body.accountId,
      isIncome: body.isIncome,
      isEssential: body.isEssential,
      tags: body.tags || [],
      notes: body.notes,
      location: body.location,
      receiptUrl: body.receiptUrl,
      status: body.status || 'cleared',
      isExcludedFromBudget: body.isExcludedFromBudget || false,
      createdAt: now,
      updatedAt: now,
    };

    // Extract month for GSI
    const month = dateStr.substring(0, 7); // YYYY-MM

    await putItem(TRANSACTION_DETAILS_TABLE, {
      PK: pk,
      SK: sk,
      itemType: 'TRANSACTION',
      GSI1PK: `BUDGET#${month}#CATEGORY#${body.category}`,
      GSI1SK: sk,
      GSI2PK: `MERCHANT#${body.description}`,
      GSI2SK: sk,
      ...transaction,
    });

    // TODO: Trigger analytics recalculation for the month

    console.log(`[CreateTransaction] userId=${userId} date=${dateStr} amount=${body.amount} created`);
    return created({ transaction });
  } catch (error) {
    console.error('[CreateTransaction] Error:', error);
    return serverError('Failed to create transaction');
  }
}

/**
 * Update transaction
 * PUT /v1/transactions/:id
 */
export async function updateTransaction(event: APIGatewayProxyEventV2, userId?: string) {
  if (!userId) {
    return badRequest('User ID required');
  }

  const txnId = event.pathParameters?.id;
  if (!txnId) {
    return badRequest('Transaction ID required');
  }

  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return badRequest('Authorization required');
  }

  const { tenantId } = auth.context;
  const body = parseBody(event);

  try {
    // Find the transaction (we need the full SK)
    const pk = createTenantKey(tenantId, 'USER', userId);
    
    const allTransactions = await queryItems(TRANSACTION_DETAILS_TABLE, pk, {
      sortKeyCondition: 'begins_with(SK, :prefix)',
      expressionAttributeValues: { ':prefix': 'TXN#' },
    });

    const existing = allTransactions.find((t: any) => t.id === txnId);
    if (!existing) {
      return notFound('Transaction not found');
    }

    const updates: any = {
      updatedAt: timestamp(),
    };

    if (body.description !== undefined) updates.description = body.description;
    if (body.amount !== undefined) updates.amount = body.amount;
    if (body.category !== undefined) updates.category = body.category;
    if (body.categoryId !== undefined) updates.categoryId = body.categoryId;
    if (body.isEssential !== undefined) updates.isEssential = body.isEssential;
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.notes !== undefined) updates.notes = body.notes;
    if (body.status !== undefined) updates.status = body.status;

    await updateItem(TRANSACTION_DETAILS_TABLE, pk, existing.SK, updates);
    const updated = await getItem(TRANSACTION_DETAILS_TABLE, pk, existing.SK);

    console.log(`[UpdateTransaction] userId=${userId} txnId=${txnId} updated`);
    return ok({ transaction: updated });
  } catch (error) {
    console.error('[UpdateTransaction] Error:', error);
    return serverError('Failed to update transaction');
  }
}

/**
 * Delete transaction
 * DELETE /v1/transactions/:id
 */
export async function deleteTransaction(event: APIGatewayProxyEventV2, userId?: string) {
  if (!userId) {
    return badRequest('User ID required');
  }

  const txnId = event.pathParameters?.id;
  if (!txnId) {
    return badRequest('Transaction ID required');
  }

  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return badRequest('Authorization required');
  }

  const { tenantId } = auth.context;

  try {
    // Find the transaction
    const pk = createTenantKey(tenantId, 'USER', userId);
    
    const allTransactions = await queryItems(TRANSACTION_DETAILS_TABLE, pk, {
      sortKeyCondition: 'begins_with(SK, :prefix)',
      expressionAttributeValues: { ':prefix': 'TXN#' },
    });

    const existing = allTransactions.find((t: any) => t.id === txnId);
    if (!existing) {
      return notFound('Transaction not found');
    }

    await deleteItem(TRANSACTION_DETAILS_TABLE, pk, existing.SK);

    console.log(`[DeleteTransaction] userId=${userId} txnId=${txnId} deleted`);
    return ok({ message: 'Transaction deleted' });
  } catch (error) {
    console.error('[DeleteTransaction] Error:', error);
    return serverError('Failed to delete transaction');
  }
}

// ========================================
// SPENDING ANALYTICS OPERATIONS
// ========================================

/**
 * Get spending analytics for a month
 * GET /v1/analytics/:month
 */
export async function getAnalytics(event: APIGatewayProxyEventV2, userId?: string) {
  if (!userId) {
    return badRequest('User ID required');
  }

  const month = event.pathParameters?.month;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return badRequest('Valid month required (format: YYYY-MM)');
  }

  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return badRequest('Authorization required');
  }

  const { tenantId } = auth.context;

  try {
    const pk = createTenantKey(tenantId, 'USER', userId);
    const sk = `ANALYTICS#${month}`;

    let analytics = await getItem(SPENDING_ANALYTICS_TABLE, pk, sk);

    // If analytics don't exist, generate them
    if (!analytics) {
      analytics = await generateAnalytics(userId, tenantId, month);
    }

    console.log(`[GetAnalytics] userId=${userId} month=${month} found`);
    return ok({ analytics });
  } catch (error) {
    console.error('[GetAnalytics] Error:', error);
    return serverError('Failed to fetch analytics');
  }
}

/**
 * Generate spending analytics for a month
 * POST /v1/analytics/:month/generate
 */
export async function generateAnalyticsHandler(event: APIGatewayProxyEventV2, userId?: string) {
  if (!userId) {
    return badRequest('User ID required');
  }

  const month = event.pathParameters?.month;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return badRequest('Valid month required (format: YYYY-MM)');
  }

  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return badRequest('Authorization required');
  }

  const { tenantId } = auth.context;

  try {
    const analytics = await generateAnalytics(userId, tenantId, month);

    console.log(`[GenerateAnalytics] userId=${userId} month=${month} generated`);
    return ok({ analytics });
  } catch (error) {
    console.error('[GenerateAnalytics] Error:', error);
    return serverError('Failed to generate analytics');
  }
}

/**
 * Helper function to generate analytics
 */
async function generateAnalytics(userId: string, tenantId: string, month: string): Promise<SpendingAnalytics> {
  const pk = createTenantKey(tenantId, 'USER', userId);
  
  // Get budget for the month
  const budgetSk = `BUDGET#${month}`;
  const budget = await getItem(BUDGETS_TABLE, pk, budgetSk);

  // Get all transactions for the month
  const transactions = await queryItems(TRANSACTION_DETAILS_TABLE, pk, {
    sortKeyCondition: 'begins_with(SK, :prefix)',
    expressionAttributeValues: { ':prefix': `TXN#${month}` },
  });

  // Calculate spending by category
  const spendingByCategory: any = {};
  let totalSpent = 0;
  let totalIncome = 0;

  transactions.forEach((txn: any) => {
    const amount = Math.abs(txn.amount);
    
    if (txn.isIncome) {
      totalIncome += amount;
    } else {
      totalSpent += amount;
      
      if (!spendingByCategory[txn.category]) {
        spendingByCategory[txn.category] = {
          budgeted: 0,
          actual: 0,
          difference: 0,
          percentOfBudget: 0,
          percentOfTotal: 0,
          transactionCount: 0,
        };
      }
      
      spendingByCategory[txn.category].actual += amount;
      spendingByCategory[txn.category].transactionCount += 1;
    }
  });

  // Calculate percentages
  Object.keys(spendingByCategory).forEach(category => {
    const cat = spendingByCategory[category];
    cat.percentOfTotal = totalSpent > 0 ? (cat.actual / totalSpent) * 100 : 0;
    if (cat.budgeted > 0) {
      cat.percentOfBudget = (cat.actual / cat.budgeted) * 100;
      cat.difference = cat.budgeted - cat.actual;
    }
  });

  // Find overspent and underspent categories
  const overspent = Object.keys(spendingByCategory).filter(
    cat => spendingByCategory[cat].difference < 0
  );
  const underspent = Object.keys(spendingByCategory).filter(
    cat => spendingByCategory[cat].difference > 0
  );

  // Find top categories by spending
  const topCategories = Object.entries(spendingByCategory)
    .sort((a: any, b: any) => b[1].actual - a[1].actual)
    .slice(0, 5)
    .map(([cat]) => cat);

  // Find largest transactions (keep full transaction records)
  const largestTransactions = transactions
    .filter((t: any) => !t.isIncome)
    .sort((a: any, b: any) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 10) as TransactionRecord[];

  const analyticsId = generateId('analytics');
  const now = timestamp();

  const analytics: SpendingAnalytics = {
    id: analyticsId,
    userId,
    tenantId,
    period: month,
    spendingByCategory,
    totalBudgeted: budget?.totalPlannedExpenses || 0,
    totalSpent,
    totalIncome,
    netIncome: totalIncome - totalSpent,
    topCategories,
    overspentCategories: overspent,
    underspentCategories: underspent,
    largestTransactions,
    averageDailySpending: totalSpent / 30, // Approximate
    projectedMonthlySpending: totalSpent,
    potentialSavings: overspent.reduce((sum, cat) => {
      return sum + Math.abs(spendingByCategory[cat].difference);
    }, 0),
    createdAt: now,
  };

  // Store analytics
  const sk = `ANALYTICS#${month}`;
  await putItem(SPENDING_ANALYTICS_TABLE, {
    PK: pk,
    SK: sk,
    itemType: 'SPENDING_ANALYTICS',
    GSI1PK: `USER#${userId}`,
    GSI1SK: sk,
    ...analytics,
  });

  return analytics;
}
