# Budget & Spending Management - DynamoDB Schema

**Created:** January 17, 2025  
**Status:** Design Phase  
**Related:** ARCHITECTURE.md, MULTI_TENANCY.md

## Overview

This document defines the DynamoDB table schemas for budget and spending management features. The design follows our existing multi-tenant single-table pattern with strong consistency, GSIs for flexible querying, and partition key design for optimal performance.

## Design Principles

1. **Multi-Tenancy:** All data isolated by `tenantId` to support future multi-org features
2. **Single-Table Design:** Related entities in one table with composite keys for efficient access patterns
3. **Time-Series Data:** Monthly budgets and transactions organized for time-range queries
4. **Aggregation-Friendly:** Pre-calculated totals to minimize compute during queries
5. **GSI Strategy:** Secondary indexes for common query patterns (by category, by date range, by merchant)

---

## Table 1: tyche-budgets

**Purpose:** Store monthly budgets, budget categories, and recurring transaction templates.

### Primary Key Structure

```
PK: TENANT#<tenantId>#USER#<userId>
SK: BUDGET#<YYYY-MM> | CATEGORY#<categoryId> | RECURRING#<recurringId>
```

### Item Types

#### 1. Monthly Budget Item

**PK:** `TENANT#abc123#USER#user-456`  
**SK:** `BUDGET#2025-01`

```typescript
{
  // Keys
  PK: "TENANT#abc123#USER#user-456",
  SK: "BUDGET#2025-01",
  
  // Type
  itemType: "MONTHLY_BUDGET",
  
  // Core Fields
  id: "budget-uuid-123",
  userId: "user-456",
  tenantId: "abc123",
  month: "2025-01",
  
  // Income
  totalIncome: 8500.00,
  incomeBreakdown: {
    salary: 7000.00,
    bonuses: 1000.00,
    sideIncome: 500.00,
    investments: 0,
    other: 0
  },
  
  // Expenses
  totalPlannedExpenses: 6200.00,
  totalActualExpenses: 5850.25,  // Calculated from transactions
  
  // Debt & Savings
  debtPaymentBudget: 800.00,     // Allocated for extra debt payments
  savingsBudget: 1000.00,
  
  // Available Funds
  discretionaryIncome: 2300.00,   // Income - essentials - minimums
  availableForDebtPayoff: 1500.00, // Funds available for extra payments
  
  // Status
  status: "active",               // draft | active | archived
  rolloverBalance: 150.00,        // Unspent from previous month
  
  // Metadata
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-15T14:30:00Z",
  
  // GSI Fields
  GSI1PK: "USER#user-456",
  GSI1SK: "BUDGET#2025-01"
}
```

#### 2. Budget Category Item

**PK:** `TENANT#abc123#USER#user-456`  
**SK:** `CATEGORY#cat-uuid-789`

```typescript
{
  // Keys
  PK: "TENANT#abc123#USER#user-456",
  SK: "CATEGORY#cat-uuid-789",
  
  // Type
  itemType: "BUDGET_CATEGORY",
  
  // Core Fields
  id: "cat-uuid-789",
  userId: "user-456",
  tenantId: "abc123",
  categoryType: "groceries",      // BudgetCategoryType enum
  customName: "Weekly Shopping",   // Optional custom name
  monthlyBudget: 600.00,
  
  // UI Settings
  color: "#10B981",               // Green
  icon: "shopping-cart",
  
  // Classification
  isEssential: true,
  
  // Notes
  notes: "Includes weekly trips to Trader Joe's and Costco",
  
  // Metadata
  createdAt: "2024-12-15T10:00:00Z",
  updatedAt: "2025-01-05T09:00:00Z",
  
  // GSI Fields
  GSI1PK: "USER#user-456",
  GSI1SK: "CATEGORY#groceries"
}
```

#### 3. Recurring Transaction Template

**PK:** `TENANT#abc123#USER#user-456`  
**SK:** `RECURRING#rec-uuid-321`

```typescript
{
  // Keys
  PK: "TENANT#abc123#USER#user-456",
  SK: "RECURRING#rec-uuid-321",
  
  // Type
  itemType: "RECURRING_TRANSACTION",
  
  // Core Fields
  id: "rec-uuid-321",
  userId: "user-456",
  tenantId: "abc123",
  name: "Monthly Rent",
  amount: 2200.00,
  currency: "USD",
  category: "housing",
  
  // Recurrence Pattern
  frequency: "monthly",           // weekly | biweekly | monthly | quarterly | annually
  startDate: "2024-01-01",
  endDate: null,                  // No end date
  dayOfMonth: 1,                  // 1st of month
  dayOfWeek: null,                // N/A for monthly
  
  // Settings
  isIncome: false,
  isEssential: true,
  autoCreate: true,               // Auto-create transactions
  reminderDays: 3,                // Remind 3 days before
  
  // Status
  isActive: true,
  lastGenerated: "2025-01-01",
  nextDue: "2025-02-01",
  
  // Metadata
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
  
  // GSI Fields
  GSI1PK: "USER#user-456",
  GSI1SK: "RECURRING#2025-02-01"  // Next due date for queries
}
```

### Global Secondary Indexes

#### GSI1: User-Level Queries

**Purpose:** Query all budgets/categories/recurring items for a user across tenants (for admin views)

```
GSI1PK: USER#<userId>
GSI1SK: BUDGET#<YYYY-MM> | CATEGORY#<type> | RECURRING#<nextDue>
```

**Query Examples:**
- Get all budgets for a user: `GSI1PK = USER#user-456 AND begins_with(GSI1SK, "BUDGET#")`
- Get all categories for a user: `GSI1PK = USER#user-456 AND begins_with(GSI1SK, "CATEGORY#")`
- Get upcoming recurring transactions: `GSI1PK = USER#user-456 AND GSI1SK BETWEEN "RECURRING#2025-01" AND "RECURRING#2025-02"`

---

## Table 2: tyche-transactions

**Purpose:** Store all spending and income transactions with categorization.

### Primary Key Structure

```
PK: TENANT#<tenantId>#USER#<userId>
SK: TXN#<YYYY-MM-DD>#<timestamp>#<txnId>
```

**Sort Key Design:** Date-first allows efficient time-range queries (all Jan 2025 transactions)

### Item Type: Transaction Record

**PK:** `TENANT#abc123#USER#user-456`  
**SK:** `TXN#2025-01-15#1736952000000#txn-uuid-555`

```typescript
{
  // Keys
  PK: "TENANT#abc123#USER#user-456",
  SK: "TXN#2025-01-15#1736952000000#txn-uuid-555",
  
  // Type
  itemType: "TRANSACTION",
  
  // Core Fields
  id: "txn-uuid-555",
  userId: "user-456",
  tenantId: "abc123",
  date: "2025-01-15T18:30:00Z",
  description: "Whole Foods Market",
  amount: -87.42,                 // Negative for expenses, positive for income
  currency: "USD",
  
  // Categorization
  category: "groceries",          // BudgetCategoryType
  categoryId: "cat-uuid-789",     // Link to BudgetCategory
  isRecurring: false,
  recurringId: null,
  
  // Source
  source: "credit_card",          // credit_card | manual | import | auto
  cardId: "card-uuid-111",        // Link to CreditCardAccount
  accountId: null,
  
  // Classification
  isIncome: false,
  isEssential: true,
  tags: ["grocery", "organic"],
  
  // Details
  notes: "Weekly grocery run",
  location: "Whole Foods - Downtown",
  receiptUrl: "https://s3.../receipt-555.jpg",
  
  // Status
  status: "cleared",              // pending | cleared | reconciled
  isExcludedFromBudget: false,
  
  // Metadata
  createdAt: "2025-01-15T18:35:00Z",
  updatedAt: "2025-01-15T18:35:00Z",
  
  // GSI Fields
  GSI1PK: "BUDGET#2025-01#CATEGORY#groceries",
  GSI1SK: "TXN#2025-01-15#1736952000000",
  
  GSI2PK: "MERCHANT#Whole Foods Market",
  GSI2SK: "TXN#2025-01-15#1736952000000"
}
```

### Global Secondary Indexes

#### GSI1: Category-Level Queries

**Purpose:** Get all transactions for a specific budget month and category

```
GSI1PK: BUDGET#<YYYY-MM>#CATEGORY#<categoryType>
GSI1SK: TXN#<YYYY-MM-DD>#<timestamp>
```

**Query Examples:**
- All January 2025 grocery transactions: `GSI1PK = "BUDGET#2025-01#CATEGORY#groceries"`
- Calculate category spending: Sum all amounts where `GSI1PK = "BUDGET#2025-01#CATEGORY#groceries"`

#### GSI2: Merchant-Level Queries

**Purpose:** Find all transactions from a specific merchant (for pattern analysis)

```
GSI2PK: MERCHANT#<merchantName>
GSI2SK: TXN#<YYYY-MM-DD>#<timestamp>
```

**Query Examples:**
- All Whole Foods transactions: `GSI2PK = "MERCHANT#Whole Foods Market"`
- Merchant spending over time: Query + group by month

---

## Table 3: tyche-spending-analytics

**Purpose:** Store pre-calculated spending analytics for fast dashboard loading.

### Primary Key Structure

```
PK: TENANT#<tenantId>#USER#<userId>
SK: ANALYTICS#<YYYY-MM>
```

### Item Type: Spending Analytics

**PK:** `TENANT#abc123#USER#user-456`  
**SK:** `ANALYTICS#2025-01`

```typescript
{
  // Keys
  PK: "TENANT#abc123#USER#user-456",
  SK: "ANALYTICS#2025-01",
  
  // Type
  itemType: "SPENDING_ANALYTICS",
  
  // Core Fields
  id: "analytics-uuid-999",
  userId: "user-456",
  tenantId: "abc123",
  period: "2025-01",
  
  // Category Breakdown
  spendingByCategory: {
    groceries: {
      budgeted: 600.00,
      actual: 542.18,
      difference: 57.82,
      percentOfBudget: 90.36,
      percentOfTotal: 9.27,
      transactionCount: 8
    },
    dining: {
      budgeted: 400.00,
      actual: 478.52,
      difference: -78.52,
      percentOfBudget: 119.63,
      percentOfTotal: 8.18,
      transactionCount: 15
    },
    // ... all other categories
  },
  
  // Totals
  totalBudgeted: 6200.00,
  totalSpent: 5850.25,
  totalIncome: 8500.00,
  netIncome: 2649.75,
  
  // Insights
  topCategories: ["housing", "transportation", "groceries"],
  overspentCategories: ["dining", "entertainment"],
  underspentCategories: ["groceries", "utilities"],
  
  // Top Transactions
  largestTransactions: [
    {
      id: "txn-001",
      date: "2025-01-01",
      description: "Rent Payment",
      amount: -2200.00,
      category: "housing"
    },
    // ... top 10 transactions
  ],
  
  // Trends
  averageDailySpending: 188.72,
  projectedMonthlySpending: 5850.25,
  
  // Comparison to Previous Month
  comparisonToPreviousMonth: {
    spendingChange: -215.50,
    percentageChange: -3.55,
    categoriesIncreased: ["healthcare", "entertainment"],
    categoriesDecreased: ["dining", "shopping"]
  },
  
  // Recommendations (AI-generated)
  potentialSavings: 350.00,
  recommendedCuts: [
    {
      category: "dining",
      currentSpending: 478.52,
      recommendedSpending: 350.00,
      potentialSavings: 128.52,
      reasoning: "Overspent by 20%. Reducing takeout could save $128/month."
    },
    {
      category: "entertainment",
      currentSpending: 285.00,
      recommendedSpending: 200.00,
      potentialSavings: 85.00,
      reasoning: "Cut unused streaming subscriptions for $85/month savings."
    }
  ],
  
  // Metadata
  createdAt: "2025-02-01T00:00:00Z",
  calculatedAt: "2025-02-01T00:15:00Z",
  
  // GSI Fields
  GSI1PK: "USER#user-456",
  GSI1SK: "ANALYTICS#2025-01"
}
```

### Global Secondary Index

#### GSI1: User-Level Analytics Queries

```
GSI1PK: USER#<userId>
GSI1SK: ANALYTICS#<YYYY-MM>
```

**Query Examples:**
- Get all analytics for a user: `GSI1PK = USER#user-456`
- Get 6-month trend: `GSI1PK = USER#user-456 AND GSI1SK BETWEEN "ANALYTICS#2024-08" AND "ANALYTICS#2025-01"`

---

## Table 4: tyche-budget-goals

**Purpose:** Store budget-related financial goals (savings goals, spending reduction targets).

### Primary Key Structure

```
PK: TENANT#<tenantId>#USER#<userId>
SK: GOAL#<goalId>
```

### Item Type: Budget Goal

**PK:** `TENANT#abc123#USER#user-456`  
**SK:** `GOAL#goal-uuid-777`

```typescript
{
  // Keys
  PK: "TENANT#abc123#USER#user-456",
  SK: "GOAL#goal-uuid-777",
  
  // Type
  itemType: "BUDGET_GOAL",
  
  // Core Fields
  id: "goal-uuid-777",
  userId: "user-456",
  tenantId: "abc123",
  name: "Emergency Fund",
  description: "Save 6 months of expenses ($30,000)",
  targetAmount: 30000.00,
  currentAmount: 12500.00,
  currency: "USD",
  
  // Timeline
  targetDate: "2025-12-31",
  createdDate: "2024-06-01",
  
  // Category
  relatedCategory: "savings",
  
  // Progress
  percentComplete: 41.67,
  monthlyContribution: 1500.00,
  onTrack: true,
  
  // Status
  status: "active",               // active | completed | paused | cancelled
  priority: "high",               // low | medium | high
  
  // Milestones
  milestones: [
    {
      percentage: 25,
      amount: 7500.00,
      achieved: true,
      achievedDate: "2024-09-15"
    },
    {
      percentage: 50,
      amount: 15000.00,
      achieved: false,
      achievedDate: null
    },
    {
      percentage: 75,
      amount: 22500.00,
      achieved: false,
      achievedDate: null
    },
    {
      percentage: 100,
      amount: 30000.00,
      achieved: false,
      achievedDate: null
    }
  ],
  
  // Metadata
  createdAt: "2024-06-01T00:00:00Z",
  updatedAt: "2025-01-15T10:00:00Z",
  
  // GSI Fields
  GSI1PK: "USER#user-456",
  GSI1SK: "GOAL#active#2025-12-31"  // Status + target date for sorting
}
```

### Global Secondary Index

#### GSI1: User Goals with Status

```
GSI1PK: USER#<userId>
GSI1SK: GOAL#<status>#<targetDate>
```

**Query Examples:**
- All active goals: `GSI1PK = USER#user-456 AND begins_with(GSI1SK, "GOAL#active")`
- Active goals by deadline: `GSI1PK = USER#user-456 AND GSI1SK BETWEEN "GOAL#active#2025-01" AND "GOAL#active#2025-12"`

---

## Access Patterns

### Budget Management

| Access Pattern | Table | Key Condition | GSI |
|----------------|-------|---------------|-----|
| Get monthly budget for user | tyche-budgets | `PK = TENANT#...#USER#... AND SK = BUDGET#2025-01` | - |
| Get all budgets for user | tyche-budgets | `GSI1PK = USER#user-456 AND begins_with(GSI1SK, "BUDGET#")` | GSI1 |
| Get user's budget categories | tyche-budgets | `PK = TENANT#...#USER#... AND begins_with(SK, "CATEGORY#")` | - |
| Get recurring transactions | tyche-budgets | `PK = TENANT#...#USER#... AND begins_with(SK, "RECURRING#")` | - |
| Get upcoming recurring (next 30 days) | tyche-budgets | `GSI1PK = USER#user-456 AND GSI1SK BETWEEN "RECURRING#2025-01" AND "RECURRING#2025-02"` | GSI1 |

### Transaction Tracking

| Access Pattern | Table | Key Condition | GSI |
|----------------|-------|---------------|-----|
| Get transactions for month | tyche-transactions | `PK = TENANT#...#USER#... AND begins_with(SK, "TXN#2025-01")` | - |
| Get transactions for date range | tyche-transactions | `PK = TENANT#...#USER#... AND SK BETWEEN "TXN#2025-01-01" AND "TXN#2025-01-31"` | - |
| Get transactions by category (month) | tyche-transactions | `GSI1PK = BUDGET#2025-01#CATEGORY#groceries` | GSI1 |
| Get transactions by merchant | tyche-transactions | `GSI2PK = MERCHANT#Whole Foods Market` | GSI2 |
| Calculate category spending | tyche-transactions | Query GSI1 + sum amounts | GSI1 |

### Analytics & Insights

| Access Pattern | Table | Key Condition | GSI |
|----------------|-------|---------------|-----|
| Get analytics for month | tyche-spending-analytics | `PK = TENANT#...#USER#... AND SK = ANALYTICS#2025-01` | - |
| Get analytics trend (6 months) | tyche-spending-analytics | `GSI1PK = USER#user-456 AND GSI1SK BETWEEN "ANALYTICS#2024-08" AND "ANALYTICS#2025-01"` | GSI1 |

### Goals

| Access Pattern | Table | Key Condition | GSI |
|----------------|-------|---------------|-----|
| Get all goals for user | tyche-budget-goals | `PK = TENANT#...#USER#...` | - |
| Get active goals by deadline | tyche-budget-goals | `GSI1PK = USER#user-456 AND begins_with(GSI1SK, "GOAL#active")` | GSI1 |

---

## Data Flow & Calculations

### 1. Monthly Budget Creation
1. User creates monthly budget in UI
2. API creates `MONTHLY_BUDGET` item in `tyche-budgets`
3. API creates/updates `BUDGET_CATEGORY` items for each category
4. System calculates `discretionaryIncome` and `availableForDebtPayoff`

### 2. Transaction Recording
1. Transaction imported from credit card or manually entered
2. API creates `TRANSACTION` item in `tyche-transactions`
3. System updates `totalActualExpenses` in corresponding `MONTHLY_BUDGET`
4. Trigger: Lambda function updates spending analytics asynchronously

### 3. Spending Analytics Generation
1. End of month: Lambda function aggregates all transactions
2. Calculates spending by category, trends, comparisons
3. Generates AI recommendations for budget optimization
4. Stores results in `tyche-spending-analytics`

### 4. AI Integration
When user asks for debt payoff advice:
1. AI calls `get_user_context` tool
2. Backend queries:
   - Current month budget from `tyche-budgets`
   - Recent transactions from `tyche-transactions`
   - Latest analytics from `tyche-spending-analytics`
3. AI receives:
   - `availableForDebtPayoff` (exact amount for extra payments)
   - Spending patterns (potential areas to cut)
   - Budget adherence (overspent categories)
4. AI provides personalized recommendations based on real data

---

## Implementation Notes

### Table Creation (CDK)

Add to `tyche-stack.ts`:

```typescript
// Budget & Categories Table
const budgetsTable = new dynamodb.Table(this, 'BudgetsTable', {
  tableName: 'tyche-budgets',
  partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  pointInTimeRecovery: true,
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
});

budgetsTable.addGlobalSecondaryIndex({
  indexName: 'GSI1',
  partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});

// Transactions Table
const transactionsTable = new dynamodb.Table(this, 'TransactionsTable', {
  tableName: 'tyche-transactions',
  partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  pointInTimeRecovery: true,
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
});

transactionsTable.addGlobalSecondaryIndex({
  indexName: 'GSI1',
  partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});

transactionsTable.addGlobalSecondaryIndex({
  indexName: 'GSI2',
  partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});

// Spending Analytics Table
const analyticsTable = new dynamodb.Table(this, 'SpendingAnalyticsTable', {
  tableName: 'tyche-spending-analytics',
  partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  pointInTimeRecovery: true,
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
});

analyticsTable.addGlobalSecondaryIndex({
  indexName: 'GSI1',
  partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});

// Budget Goals Table
const goalsTable = new dynamodb.Table(this, 'BudgetGoalsTable', {
  tableName: 'tyche-budget-goals',
  partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  pointInTimeRecovery: true,
  encryption: dynamodb.TableEncryption.AWS_MANAGED,
});

goalsTable.addGlobalSecondaryIndex({
  indexName: 'GSI1',
  partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
  projectionType: dynamodb.ProjectionType.ALL,
});
```

### Cost Optimization

1. **On-Demand Pricing:** Good for variable traffic (development phase)
2. **Future:** Switch to provisioned capacity with auto-scaling in production
3. **TTL:** Consider adding TTL for old analytics (archive after 24 months)
4. **Sparse Indexes:** GSIs only have items with those attributes (saves storage)

### Data Consistency

1. **Strong Consistency:** All main queries use primary key (strongly consistent)
2. **Eventually Consistent:** GSI queries are eventually consistent (acceptable for dashboards)
3. **Optimistic Locking:** Use version numbers for concurrent updates to budgets

---

## Migration Strategy

### Phase 1: Create Tables (Week 1)
- Deploy new DynamoDB tables via CDK
- Set up IAM permissions for Lambda functions
- Test table creation in dev environment

### Phase 2: Seed Test Data (Week 1)
- Create sample budgets for test users
- Import sample transactions
- Generate test analytics

### Phase 3: Build API Handlers (Week 2)
- Budget CRUD operations
- Transaction CRUD operations
- Analytics calculation functions

### Phase 4: Frontend Integration (Week 2-3)
- Budget Setup page
- Spending Dashboard
- Transaction management

### Phase 5: AI Integration (Week 3)
- Update `get_user_context` to include budget data
- Add new AI tools for budget analysis
- Test personalized debt payoff recommendations

---

## Monitoring & Observability

### CloudWatch Metrics to Track

1. **Read/Write Capacity:**
   - Track consumed capacity units
   - Set alarms for throttling

2. **Item Counts:**
   - Monitor total items per table
   - Track growth rate

3. **Query Performance:**
   - Track query latency (P50, P95, P99)
   - Monitor GSI query patterns

4. **Data Quality:**
   - Track transactions without categories
   - Monitor budget vs actual spending deltas
   - Alert on analytics calculation failures

### Sample Alarms

```typescript
// High read throttle rate
new cloudwatch.Alarm(this, 'BudgetsTableReadThrottle', {
  metric: budgetsTable.metricConsumedReadCapacityUnits(),
  threshold: 80,
  evaluationPeriods: 2,
  alarmDescription: 'Budget table read throttling detected',
});
```

---

## Future Enhancements

1. **Smart Categorization:** ML-based auto-categorization of transactions
2. **Budget Templates:** Pre-built budget templates for common scenarios
3. **Shared Budgets:** Multi-user budgets for families/roommates
4. **Budget Forecasting:** Predict future spending based on historical patterns
5. **Integration with Banks:** Plaid/Yodlee integration for auto-import
6. **Receipt OCR:** Automatic receipt scanning and expense tracking
7. **Budget Challenges:** Gamification features (no-spend challenges, savings streaks)

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Overall system architecture
- [MULTI_TENANCY.md](./MULTI_TENANCY.md) - Multi-tenant design patterns
- [AWS_SETUP_GUIDE.md](./AWS_SETUP_GUIDE.md) - DynamoDB setup and permissions

---

**Next Steps:**
1. Review schema with team
2. Deploy tables to dev environment via CDK
3. Create utility functions for key construction
4. Build API handlers for budget CRUD operations
5. Test access patterns with sample data
