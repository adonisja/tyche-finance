export type Currency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD' | 'JPY';

// User & Authorization Types
export type UserRole = 'user' | 'dev' | 'admin';

export interface User {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  permissions?: string[];
  isActive: boolean;
  isSuspended?: boolean;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
  preferences?: {
    currency: Currency;
    theme?: 'light' | 'dark';
    notifications?: boolean;
  };
}

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
  permissions: string[];
  groups?: string[]; // Cognito groups user belongs to (optional for backwards compatibility)
}

export interface Permission {
  resource: string;
  actions: Action[];
  scope: 'own' | 'tenant' | 'all';
}

export type Action = 'read' | 'write' | 'delete' | 'admin';

// Audit Log Types
export interface AuditLogEntry {
  tenantId: string;
  userId: string;
  role: UserRole;
  action: string;
  resource: string;
  resourceId?: string;
  targetUserId?: string;
  details?: Record<string, any>;
  timestamp: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
  impersonated?: boolean;
}

export interface Income {
  id: string;
  source: string;
  amount: number; // monthly amount in currency units
  currency: Currency;
  receivedOn?: string; // ISO date
}

export interface Expense {
  id: string;
  name: string;
  amount: number; // monthly amount
  category?: string;
  currency: Currency;
  paidOn?: string; // ISO date
  isDiscretionary?: boolean;
}

/**
 * Credit Card Account
 * 
 * 🔒 SECURITY: Never stores full card numbers (PCI DSS compliance)
 * - Only last 4 digits for identification
 * - Card network (Visa, Mastercard, etc.) for display
 * - No CVV, no expiration date, no full number
 * 
 * This prevents:
 * - Data breaches exposing sensitive financial info
 * - PCI compliance requirements (storing full numbers requires certification)
 * - Liability in case of system compromise
 */
export interface CreditCardAccount {
  id: string;
  name: string;                    // User-friendly name (e.g., "Chase Sapphire Preferred")
  network: CardNetwork;             // Card network (Visa, Mastercard, Discover, Amex)
  lastFourDigits: string;           // Last 4 digits only (e.g., "4532")
  issuer?: string;                  // Bank/issuer name (e.g., "Chase", "Capital One")
  limit: number;                    // Credit limit in currency units
  balance: number;                  // Current balance owed
  apr: number;                      // Annual Percentage Rate in decimal (e.g., 0.1999 for 19.99%)
  minPayment: number;               // Monthly minimum payment
  dueDayOfMonth: number;            // Payment due day (1-28 typically)
  promotionalAprEndsOn?: string;    // ISO date when promotional rate expires
  isActive?: boolean;               // Whether card is active/open
  currency?: Currency;              // Card currency (defaults to USD)
  createdAt?: string;               // When card was added to system
  updatedAt?: string;               // Last modification timestamp
}

/**
 * Card Network Types
 * 
 * Major payment networks for identification and display purposes.
 * Used to show appropriate logos/icons in UI.
 */
export type CardNetwork = 
  | 'Visa' 
  | 'Mastercard' 
  | 'American Express' 
  | 'Discover' 
  | 'Other';

export interface Transaction {
  id: string;
  date: string; // ISO date
  description: string;
  amount: number; // positive for income, negative for expense
  currency: Currency;
  accountId?: string;
  category?: string;
  tags?: string[];
}

export interface BudgetPlanItem {
  id: string;
  name: string;
  cost: number;
  priority: number; // 0-100
  category?: string;
}

export interface PayoffStrategyInput {
  cards: CreditCardAccount[];
  monthlyBudget: number; // amount available for debt repayment beyond minimums
}

export interface PayoffStep {
  monthIndex: number;
  allocations: Record<string, number>; // cardId -> amount paid this month
  balances: Record<string, number>; // end-of-month balances
  interestAccrued: Record<string, number>;
}

export interface PayoffPlanResult {
  totalInterest: number;
  monthsToDebtFree: number;
  steps: PayoffStep[];
}

/**
 * Financial Health Snapshot
 * 
 * Captures a point-in-time view of a user's financial metrics.
 * Used for tracking improvement over time and generating insights.
 */
export interface FinancialHealthSnapshot {
  id: string;
  userId: string;
  tenantId: string;
  timestamp: string;                    // ISO timestamp when snapshot was taken
  
  // Debt Metrics
  totalDebt: number;                    // Sum of all credit card balances
  totalCreditLimit: number;             // Sum of all credit limits
  creditUtilization: number;            // totalDebt / totalCreditLimit (0-1)
  averageAPR: number;                   // Weighted average APR across cards
  numberOfCards: number;                // Active cards count
  
  // Payment Behavior
  monthlyMinimumPayment: number;        // Sum of all minimum payments
  actualPaymentAmount?: number;         // What user actually paid this month
  paymentToMinimumRatio?: number;       // actualPayment / monthlyMinimumPayment
  
  // Progress Indicators
  debtReductionFromLastMonth?: number;  // Change in total debt (negative = improvement)
  debtReductionPercentage?: number;     // Percentage change in debt
  projectedMonthsToDebtFree?: number;   // Based on current payment rate
  
  // Engagement Metrics
  activeStrategy?: 'avalanche' | 'snowball' | 'custom' | 'none';
  simulationsRunThisMonth?: number;     // How many payoff simulations run
  lastSimulationDate?: string;          // Most recent simulation
  aiChatInteractions?: number;          // AI conversations this period
  
  // Goals & Milestones
  hasActiveGoal: boolean;               // Whether user set a payoff goal
  goalTargetDate?: string;              // User's target debt-free date
  onTrackForGoal?: boolean;             // Whether current pace meets goal
  milestonesAchieved?: string[];        // e.g., ['paid_off_card', 'under_30_utilization']
  
  // Metadata
  snapshotType: 'daily' | 'weekly' | 'monthly' | 'milestone' | 'manual';
  createdAt: string;
}

/**
 * User Financial Goal
 * 
 * Represents a user's debt payoff or savings goal.
 */
export interface FinancialGoal {
  id: string;
  userId: string;
  tenantId: string;
  type: 'debt_payoff' | 'savings' | 'credit_score' | 'custom';
  title: string;
  description?: string;
  
  // Target Metrics
  targetAmount?: number;                // Target debt reduction or savings amount
  targetDate: string;                   // ISO date when goal should be achieved
  startingAmount: number;               // Initial debt/savings when goal created
  currentAmount?: number;               // Current progress
  
  // Strategy & Preferences
  preferredStrategy?: 'avalanche' | 'snowball' | 'custom';
  monthlyCommitment?: number;           // Amount committed per month
  
  // Status
  status: 'active' | 'completed' | 'abandoned' | 'paused';
  progress: number;                     // 0-1 (percentage complete)
  isOnTrack: boolean;                   // Based on timeline
  
  // Dates
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

/**
 * Strategy Performance Metrics
 * 
 * Aggregated data showing how different payoff strategies perform.
 */
export interface StrategyPerformance {
  strategy: 'avalanche' | 'snowball' | 'custom';
  
  // Usage Stats
  usersCount: number;                   // How many users use this strategy
  avgMonthsToComplete: number;          // Average time to debt freedom
  avgTotalInterestSaved: number;        // Average interest saved vs minimum payments
  
  // Success Metrics
  completionRate: number;               // % of users who complete (0-1)
  avgComplianceRate: number;            // % of months users stuck to plan
  avgDebtReductionPerMonth: number;     // Average monthly debt reduction
  
  // Comparison
  vsMinimumPayments: {
    timeSaved: number;                  // Months saved vs paying minimums
    interestSaved: number;              // Total interest saved
  };
}

/**
 * User Behavior Analytics
 * 
 * Tracks how users interact with the app and their financial habits.
 */
export interface UserBehaviorAnalytics {
  userId: string;
  tenantId: string;
  periodStart: string;                  // ISO date
  periodEnd: string;                    // ISO date
  
  // Engagement Metrics
  daysActive: number;                   // Days user logged in during period
  totalSessions: number;                // Number of sessions
  avgSessionDuration: number;           // Average session length in seconds
  
  // Feature Usage
  featuresUsed: {
    payoffSimulator: number;            // Times run
    aiChat: number;                     // Conversations started
    cardManagement: number;             // CRUD operations on cards
    goalTracking: number;               // Times viewed goals
  };
  
  // Payment Patterns
  paymentsRecorded: number;             // Payments logged this period
  avgPaymentAmount: number;             // Average payment size
  paymentConsistency: number;           // 0-1 (how regularly they pay)
  
  // Content Preferences
  preferredAIModel?: string;            // Which AI model they use most
  preferredStrategy?: string;           // Most used payoff strategy
  notificationsEnabled: boolean;        // Push notification status
  
  // Outcomes
  debtReductionAchieved: number;        // Total debt reduced in period
  creditUtilizationImprovement: number; // Change in utilization (negative = better)
  goalsCompleted: number;               // Goals achieved in period
  
  createdAt: string;
}

/**
 * Cohort Analysis
 * 
 * Groups users by characteristics to identify patterns.
 */
export interface UserCohort {
  cohortId: string;
  name: string;
  description: string;
  
  // Cohort Definition
  criteria: {
    startingDebtRange?: { min: number; max: number };
    numberOfCards?: { min: number; max: number };
    creditUtilizationRange?: { min: number; max: number };
    joinedDateRange?: { start: string; end: string };
    strategy?: 'avalanche' | 'snowball' | 'custom';
  };
  
  // Cohort Metrics
  userCount: number;
  avgStartingDebt: number;
  avgCurrentDebt: number;
  avgDebtReduction: number;
  avgTimeToDebtFree: number;            // For completed users
  
  // Success Indicators
  completionRate: number;               // % who reached debt freedom
  retentionRate: number;                // % still active after 6 months
  avgComplianceRate: number;            // % following their plan
  
  createdAt: string;
  updatedAt: string;
}

/**
 * A/B Test Results
 * 
 * Track effectiveness of different features or strategies.
 */
export interface ABTestResult {
  testId: string;
  testName: string;
  description: string;
  
  // Test Configuration
  variants: {
    control: { description: string; userCount: number };
    treatment: { description: string; userCount: number };
  };
  
  startDate: string;
  endDate?: string;
  status: 'running' | 'completed' | 'paused';
  
  // Results
  metrics: {
    control: VariantMetrics;
    treatment: VariantMetrics;
  };
  
  // Statistical Significance
  pValue?: number;                      // Statistical significance
  confidenceLevel?: number;             // e.g., 0.95 for 95% confidence
  winner?: 'control' | 'treatment' | 'inconclusive';
  
  createdAt: string;
  updatedAt: string;
}

export interface VariantMetrics {
  userCount: number;
  avgDebtReduction: number;
  avgEngagementScore: number;           // Composite engagement metric
  completionRate: number;
  retentionRate: number;
  avgTimeToDebtFree?: number;
}

// ========================================
// BUDGET & SPENDING MANAGEMENT TYPES
// ========================================

/**
 * Budget Category Types
 * 
 * Standard budget categories for expense tracking and planning.
 * Based on common personal finance categorization systems.
 */
export type BudgetCategoryType = 
  | 'income'              // Salary, wages, bonuses, side income
  | 'housing'             // Rent, mortgage, property tax, HOA
  | 'utilities'           // Electric, gas, water, internet, phone
  | 'transportation'      // Car payment, gas, insurance, maintenance, public transit
  | 'groceries'           // Food shopping
  | 'dining'              // Restaurants, takeout, delivery
  | 'shopping'            // Clothing, electronics, household items
  | 'entertainment'       // Movies, concerts, streaming services, hobbies
  | 'healthcare'          // Insurance, copays, prescriptions, dental
  | 'insurance'           // Life, disability, renters/home insurance
  | 'debt_payments'       // Credit card minimums, loan payments
  | 'savings'             // Emergency fund, retirement contributions
  | 'investments'         // Brokerage, real estate, crypto
  | 'education'           // Tuition, courses, books
  | 'personal_care'       // Haircuts, gym, beauty products
  | 'subscriptions'       // Streaming, magazines, memberships
  | 'gifts'               // Birthdays, holidays, charity
  | 'travel'              // Vacations, flights, hotels
  | 'pets'                // Food, vet, supplies
  | 'childcare'           // Daycare, babysitting, child expenses
  | 'miscellaneous'       // Uncategorized expenses
  | 'other';              // Custom categories

/**
 * Budget Category Configuration
 * 
 * Defines how much a user plans to spend in each category per month.
 * Used for tracking actual vs budgeted spending.
 */
export interface BudgetCategory {
  id: string;
  userId: string;
  tenantId: string;
  categoryType: BudgetCategoryType;
  customName?: string;                  // Optional custom name (e.g., "Date Nights" for dining)
  monthlyBudget: number;                // Allocated amount per month
  color?: string;                       // Hex color for charts/UI
  icon?: string;                        // Icon identifier for UI
  isEssential: boolean;                 // Essential vs discretionary
  notes?: string;                       // User notes about this category
  createdAt: string;
  updatedAt: string;
}

/**
 * Monthly Budget Plan
 * 
 * The user's overall budget for a specific month.
 * Aggregates all income, expenses, and savings goals.
 */
export interface MonthlyBudget {
  id: string;
  userId: string;
  tenantId: string;
  month: string;                        // YYYY-MM format
  
  // Income
  totalIncome: number;                  // Sum of all income sources
  incomeBreakdown: {
    salary?: number;
    bonuses?: number;
    sideIncome?: number;
    investments?: number;
    other?: number;
  };
  
  // Expenses
  totalPlannedExpenses: number;         // Sum of all category budgets
  totalActualExpenses?: number;         // Sum of actual spending (calculated)
  
  // Debt & Savings
  debtPaymentBudget: number;            // Amount allocated for credit card/debt payments
  savingsBudget: number;                // Amount to save
  
  // Available Funds
  discretionaryIncome: number;          // Income - essentials - minimums
  availableForDebtPayoff: number;       // Funds that can go to extra debt payments
  
  // Status
  status: 'draft' | 'active' | 'archived';
  rolloverBalance?: number;             // Unspent funds from previous month
  
  createdAt: string;
  updatedAt: string;
}

/**
 * Transaction Record
 * 
 * Individual spending or income transaction.
 * Can be auto-imported from credit cards or manually entered.
 */
export interface TransactionRecord {
  id: string;
  userId: string;
  tenantId: string;
  
  // Transaction Details
  date: string;                         // ISO date
  description: string;                  // Merchant name or transaction description
  amount: number;                       // Positive for income, negative for expenses
  currency: Currency;
  
  // Categorization
  category: BudgetCategoryType;         // Assigned category
  categoryId?: string;                  // Link to specific BudgetCategory
  isRecurring: boolean;                 // Whether this is a recurring transaction
  
  // Source
  source: 'credit_card' | 'manual' | 'import' | 'auto';
  cardId?: string;                      // If from credit card, which card
  accountId?: string;                   // Bank account or source
  
  // Classification
  isIncome: boolean;                    // true for income, false for expense
  isEssential: boolean;                 // Essential vs discretionary
  tags?: string[];                      // Custom tags for organization
  
  // Notes & Metadata
  notes?: string;                       // User notes
  location?: string;                    // Transaction location
  receiptUrl?: string;                  // Link to receipt image
  
  // Status
  status: 'pending' | 'cleared' | 'reconciled';
  isExcludedFromBudget?: boolean;       // Exclude from budget tracking
  
  createdAt: string;
  updatedAt: string;
}

/**
 * Spending Analytics
 * 
 * Aggregated insights about spending patterns for a time period.
 * Used for dashboards, charts, and AI recommendations.
 */
export interface SpendingAnalytics {
  id: string;
  userId: string;
  tenantId: string;
  period: string;                       // YYYY-MM or date range
  
  // Category Breakdown
  spendingByCategory: Record<BudgetCategoryType, {
    budgeted: number;
    actual: number;
    difference: number;
    percentOfBudget: number;            // actual / budgeted
    percentOfTotal: number;             // actual / totalSpending
    transactionCount: number;
  }>;
  
  // Totals
  totalBudgeted: number;
  totalSpent: number;
  totalIncome: number;
  netIncome: number;                    // income - expenses
  
  // Insights
  topCategories: string[];              // Categories with highest spending
  overspentCategories: string[];        // Categories over budget
  underspentCategories: string[];       // Categories under budget
  largestTransactions: TransactionRecord[];  // Top 5-10 transactions
  
  // Trends
  averageDailySpending: number;
  projectedMonthlySpending?: number;    // Based on current pace
  comparisonToPreviousMonth?: {
    spendingChange: number;             // Dollar change
    percentageChange: number;           // Percentage change
    categoriesIncreased: string[];
    categoriesDecreased: string[];
  };
  
  // Recommendations
  potentialSavings: number;             // Amount that could be saved by cutting discretionary
  recommendedCuts?: Array<{
    category: BudgetCategoryType;
    currentSpending: number;
    recommendedSpending: number;
    potentialSavings: number;
    reasoning: string;
  }>;
  
  createdAt: string;
}

/**
 * Recurring Transaction Template
 * 
 * Template for recurring income or expenses (e.g., rent, salary, subscriptions).
 * Used to auto-generate expected transactions and budget projections.
 */
export interface RecurringTransaction {
  id: string;
  userId: string;
  tenantId: string;
  
  // Template Details
  name: string;                         // e.g., "Monthly Rent", "Netflix Subscription"
  amount: number;
  currency: Currency;
  category: BudgetCategoryType;
  
  // Recurrence Pattern
  frequency: 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annually';
  startDate: string;                    // ISO date
  endDate?: string;                     // Optional end date
  dayOfMonth?: number;                  // For monthly (1-31)
  dayOfWeek?: number;                   // For weekly (0=Sunday, 6=Saturday)
  
  // Settings
  isIncome: boolean;
  isEssential: boolean;
  autoCreate: boolean;                  // Automatically create transactions
  reminderDays?: number;                // Days before to send reminder
  
  // Status
  isActive: boolean;
  lastGenerated?: string;               // Last transaction generation date
  nextDue?: string;                     // Next expected transaction date
  
  createdAt: string;
  updatedAt: string;
}

/**
 * Budget Goal
 * 
 * Financial goal tied to budgeting/spending (e.g., "Save $5000 for vacation").
 * Complements debt payoff goals.
 */
export interface BudgetGoal {
  id: string;
  userId: string;
  tenantId: string;
  
  // Goal Details
  name: string;                         // e.g., "Emergency Fund", "Europe Trip"
  description?: string;
  targetAmount: number;                 // Goal amount
  currentAmount: number;                // Current progress
  currency: Currency;
  
  // Timeline
  targetDate?: string;                  // ISO date
  createdDate: string;
  
  // Category Linked
  relatedCategory?: BudgetCategoryType; // e.g., 'savings', 'travel'
  
  // Progress
  percentComplete: number;              // currentAmount / targetAmount * 100
  monthlyContribution?: number;         // Suggested monthly contribution
  onTrack: boolean;                     // Whether pace meets target date
  
  // Status
  status: 'active' | 'completed' | 'paused' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  
  // Milestones
  milestones?: Array<{
    percentage: number;                 // e.g., 25, 50, 75, 100
    amount: number;
    achieved: boolean;
    achievedDate?: string;
  }>;
  
  createdAt: string;
  updatedAt: string;
}
