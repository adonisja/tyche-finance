# Budget API Reference

**Version:** 0.4.0  
**Base URL:** https://841dg6itk5.execute-api.us-east-1.amazonaws.com  
**Status:** ✅ Deployed (January 17, 2025)

## Overview

Complete REST API for budget and spending management. All endpoints require Cognito JWT authentication and support multi-tenant isolation.

---

## Table of Contents

- [Authentication](#authentication)
- [Monthly Budgets](#monthly-budgets)
- [Budget Categories](#budget-categories)
- [Transactions](#transactions)
- [Spending Analytics](#spending-analytics)
- [Error Handling](#error-handling)

---

## Authentication

All endpoints require Cognito JWT token in the `Authorization` header:

```http
Authorization: Bearer <JWT_TOKEN>
```

The JWT must contain:
- `sub` - User ID (Cognito user identifier)
- `cognito:groups` - User's group membership (Users, DevTeam, Admins)

**User Isolation:** All data is automatically isolated by `tenantId` extracted from the user's token.

---

## Monthly Budgets

### List All Budgets

Get all budgets for the authenticated user.

**Endpoint:** `GET /v1/budgets`

**Query Parameters:**
- `includeArchived` (optional) - Include archived budgets (default: false)

**Response:**
```json
{
  "budgets": [
    {
      "id": "budget-123",
      "userId": "user-456",
      "tenantId": "tenant-789",
      "month": "2025-01",
      "totalIncome": 8500.00,
      "incomeBreakdown": {
        "salary": 7000.00,
        "bonuses": 1000.00,
        "sideIncome": 500.00
      },
      "totalPlannedExpenses": 6200.00,
      "totalActualExpenses": 5850.25,
      "debtPaymentBudget": 800.00,
      "savingsBudget": 1000.00,
      "discretionaryIncome": 2300.00,
      "availableForDebtPayoff": 1500.00,
      "status": "active",
      "rolloverBalance": 150.00,
      "createdAt": "2025-01-01T00:00:00Z",
      "updatedAt": "2025-01-15T14:30:00Z"
    }
  ]
}
```

---

### Get Budget by Month

Get budget for a specific month.

**Endpoint:** `GET /v1/budgets/:month`

**Path Parameters:**
- `month` - Month in YYYY-MM format (e.g., "2025-01")

**Response:**
```json
{
  "budget": {
    "id": "budget-123",
    "month": "2025-01",
    "totalIncome": 8500.00,
    ...
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid month format
- `404 Not Found` - Budget not found for specified month

---

### Create Budget

Create a new monthly budget.

**Endpoint:** `POST /v1/budgets`

**Request Body:**
```json
{
  "month": "2025-01",
  "totalIncome": 8500.00,
  "incomeBreakdown": {
    "salary": 7000.00,
    "bonuses": 1000.00,
    "sideIncome": 500.00,
    "investments": 0,
    "other": 0
  },
  "totalPlannedExpenses": 6200.00,
  "debtPaymentBudget": 800.00,
  "savingsBudget": 1000.00,
  "rolloverBalance": 0
}
```

**Response:** `201 Created`
```json
{
  "budget": {
    "id": "budget-123",
    "month": "2025-01",
    "discretionaryIncome": 2300.00,
    "availableForDebtPayoff": 1500.00,
    ...
  }
}
```

**Key Fields:**
- `discretionaryIncome` - Calculated as: `totalIncome - totalPlannedExpenses`
- `availableForDebtPayoff` - Calculated as: `discretionaryIncome - debtPaymentBudget`

**Error Responses:**
- `400 Bad Request` - Invalid data or budget already exists for month

---

### Update Budget

Update an existing monthly budget.

**Endpoint:** `PUT /v1/budgets/:month`

**Request Body:** (all fields optional)
```json
{
  "totalIncome": 9000.00,
  "totalPlannedExpenses": 6500.00,
  "debtPaymentBudget": 1000.00,
  "savingsBudget": 1200.00,
  "status": "active"
}
```

**Response:**
```json
{
  "budget": {
    "id": "budget-123",
    "month": "2025-01",
    "totalIncome": 9000.00,
    "discretionaryIncome": 2500.00,
    "availableForDebtPayoff": 1500.00,
    ...
  }
}
```

**Note:** `discretionaryIncome` and `availableForDebtPayoff` are automatically recalculated.

---

### Delete Budget

Archive a monthly budget (soft delete).

**Endpoint:** `DELETE /v1/budgets/:month`

**Response:**
```json
{
  "message": "Budget archived"
}
```

**Note:** Budgets are archived (status = "archived"), not permanently deleted.

---

## Budget Categories

### List Categories

Get all budget categories for the authenticated user.

**Endpoint:** `GET /v1/categories`

**Response:**
```json
{
  "categories": [
    {
      "id": "cat-123",
      "userId": "user-456",
      "tenantId": "tenant-789",
      "categoryType": "groceries",
      "customName": "Weekly Shopping",
      "monthlyBudget": 600.00,
      "color": "#10B981",
      "icon": "shopping-cart",
      "isEssential": true,
      "notes": "Includes Trader Joe's and Costco",
      "createdAt": "2024-12-15T10:00:00Z",
      "updatedAt": "2025-01-05T09:00:00Z"
    }
  ]
}
```

---

### Create Category

Create a new budget category.

**Endpoint:** `POST /v1/categories`

**Request Body:**
```json
{
  "categoryType": "groceries",
  "customName": "Weekly Shopping",
  "monthlyBudget": 600.00,
  "isEssential": true,
  "color": "#10B981",
  "icon": "shopping-cart",
  "notes": "Optional notes"
}
```

**Category Types:**
- `income`, `housing`, `utilities`, `transportation`, `groceries`, `dining`
- `shopping`, `entertainment`, `healthcare`, `insurance`, `debt_payments`
- `savings`, `investments`, `education`, `personal_care`, `subscriptions`
- `gifts`, `travel`, `pets`, `childcare`, `miscellaneous`, `other`

**Response:** `201 Created`

---

### Update Category

Update an existing budget category.

**Endpoint:** `PUT /v1/categories/:id`

**Request Body:** (all fields optional)
```json
{
  "customName": "Grocery Budget",
  "monthlyBudget": 650.00,
  "color": "#059669",
  "isEssential": true
}
```

**Response:** Updated category object

---

### Delete Category

Delete a budget category.

**Endpoint:** `DELETE /v1/categories/:id`

**Response:**
```json
{
  "message": "Category deleted"
}
```

---

## Transactions

### List Transactions

Get transactions with optional filtering.

**Endpoint:** `GET /v1/transactions`

**Query Parameters:**
- `month` (optional) - Filter by month (YYYY-MM)
- `category` (optional) - Filter by category type

**Examples:**
- `/v1/transactions` - All transactions
- `/v1/transactions?month=2025-01` - January 2025 transactions
- `/v1/transactions?month=2025-01&category=groceries` - January groceries

**Response:**
```json
{
  "transactions": [
    {
      "id": "txn-123",
      "userId": "user-456",
      "tenantId": "tenant-789",
      "date": "2025-01-15T18:30:00Z",
      "description": "Whole Foods Market",
      "amount": -87.42,
      "currency": "USD",
      "category": "groceries",
      "categoryId": "cat-789",
      "isRecurring": false,
      "source": "credit_card",
      "cardId": "card-111",
      "isIncome": false,
      "isEssential": true,
      "tags": ["grocery", "organic"],
      "notes": "Weekly grocery run",
      "location": "Whole Foods - Downtown",
      "receiptUrl": "https://s3.../receipt-555.jpg",
      "status": "cleared",
      "isExcludedFromBudget": false,
      "createdAt": "2025-01-15T18:35:00Z",
      "updatedAt": "2025-01-15T18:35:00Z"
    }
  ]
}
```

---

### Create Transaction

Create a new transaction.

**Endpoint:** `POST /v1/transactions`

**Request Body:**
```json
{
  "date": "2025-01-15T18:30:00Z",
  "description": "Whole Foods Market",
  "amount": -87.42,
  "category": "groceries",
  "categoryId": "cat-789",
  "source": "credit_card",
  "cardId": "card-111",
  "isIncome": false,
  "isEssential": true,
  "tags": ["grocery", "organic"],
  "notes": "Optional notes",
  "location": "Optional location"
}
```

**Required Fields:**
- `date` - ISO date string
- `description` - Transaction description/merchant
- `amount` - Negative for expenses, positive for income
- `category` - Category type (see category types above)
- `isIncome` - Boolean (true for income, false for expenses)
- `isEssential` - Boolean (true for essential, false for discretionary)

**Optional Fields:**
- `categoryId` - Link to specific BudgetCategory
- `source` - "credit_card", "manual", "import", or "auto"
- `cardId` - Link to credit card if source is "credit_card"
- `tags` - Array of tags for organization
- `notes` - User notes
- `location` - Transaction location
- `receiptUrl` - Link to receipt image
- `status` - "pending", "cleared", or "reconciled" (default: "cleared")

**Response:** `201 Created` with transaction object

**Note:** Creating a transaction triggers analytics recalculation for the month (planned feature).

---

### Update Transaction

Update an existing transaction.

**Endpoint:** `PUT /v1/transactions/:id`

**Request Body:** (all fields optional)
```json
{
  "description": "Whole Foods - Updated",
  "amount": -92.18,
  "category": "groceries",
  "isEssential": true,
  "tags": ["grocery", "organic", "produce"],
  "notes": "Updated notes"
}
```

**Response:** Updated transaction object

---

### Delete Transaction

Delete a transaction.

**Endpoint:** `DELETE /v1/transactions/:id`

**Response:**
```json
{
  "message": "Transaction deleted"
}
```

---

## Spending Analytics

### Get Analytics

Get pre-calculated spending analytics for a month.

**Endpoint:** `GET /v1/spending/analytics/:month`

**Path Parameters:**
- `month` - Month in YYYY-MM format

**Response:**
```json
{
  "analytics": {
    "id": "analytics-123",
    "userId": "user-456",
    "tenantId": "tenant-789",
    "period": "2025-01",
    "spendingByCategory": {
      "groceries": {
        "budgeted": 600.00,
        "actual": 542.18,
        "difference": 57.82,
        "percentOfBudget": 90.36,
        "percentOfTotal": 9.27,
        "transactionCount": 8
      },
      "dining": {
        "budgeted": 400.00,
        "actual": 478.52,
        "difference": -78.52,
        "percentOfBudget": 119.63,
        "percentOfTotal": 8.18,
        "transactionCount": 15
      }
    },
    "totalBudgeted": 6200.00,
    "totalSpent": 5850.25,
    "totalIncome": 8500.00,
    "netIncome": 2649.75,
    "topCategories": ["housing", "transportation", "groceries"],
    "overspentCategories": ["dining", "entertainment"],
    "underspentCategories": ["groceries", "utilities"],
    "largestTransactions": [
      {
        "id": "txn-001",
        "date": "2025-01-01",
        "description": "Rent Payment",
        "amount": -2200.00,
        "category": "housing"
      }
    ],
    "averageDailySpending": 188.72,
    "projectedMonthlySpending": 5850.25,
    "potentialSavings": 350.00,
    "createdAt": "2025-02-01T00:00:00Z"
  }
}
```

**Note:** If analytics don't exist for the month, they are automatically generated.

---

### Generate Analytics

Manually trigger analytics generation/regeneration.

**Endpoint:** `POST /v1/spending/analytics/:month/generate`

**Response:** Analytics object (same as GET endpoint)

**Use Cases:**
- Force recalculation after bulk transaction updates
- Update analytics mid-month to see current trends
- Regenerate if data was corrupted

---

## Error Handling

### Standard Error Response

All errors return this format:

```json
{
  "success": false,
  "message": "Error description"
}
```

### HTTP Status Codes

- `200 OK` - Successful GET request
- `201 Created` - Successful POST request (resource created)
- `400 Bad Request` - Invalid request data or missing required fields
- `401 Unauthorized` - Missing or invalid JWT token
- `403 Forbidden` - Valid token but insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server-side error

### Common Error Messages

**400 Bad Request:**
- "User ID required"
- "Valid month required (format: YYYY-MM)"
- "categoryType required"
- "Valid monthlyBudget required"
- "Budget already exists for 2025-01"

**404 Not Found:**
- "Budget not found for 2025-01"
- "Transaction not found"
- "Category not found"

**500 Internal Server Error:**
- "Failed to fetch budget"
- "Failed to create transaction"
- "Failed to generate analytics"

---

## Rate Limiting

**Current Limits:** None (development environment)

**Production Limits (Planned):**
- 100 requests per minute per user
- 1000 requests per hour per user
- Burst capacity: 200 requests

---

## Examples

### Complete Budget Creation Flow

**1. Create Monthly Budget**
```bash
curl -X POST https://841dg6itk5.execute-api.us-east-1.amazonaws.com/v1/budgets \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "month": "2025-01",
    "totalIncome": 8500.00,
    "totalPlannedExpenses": 6200.00,
    "debtPaymentBudget": 800.00,
    "savingsBudget": 1000.00
  }'
```

**2. Create Budget Categories**
```bash
curl -X POST https://841dg6itk5.execute-api.us-east-1.amazonaws.com/v1/categories \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "categoryType": "groceries",
    "monthlyBudget": 600.00,
    "isEssential": true
  }'
```

**3. Add Transactions**
```bash
curl -X POST https://841dg6itk5.execute-api.us-east-1.amazonaws.com/v1/transactions \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-01-15T10:00:00Z",
    "description": "Whole Foods",
    "amount": -87.42,
    "category": "groceries",
    "isIncome": false,
    "isEssential": true
  }'
```

**4. Get Spending Analytics**
```bash
curl https://841dg6itk5.execute-api.us-east-1.amazonaws.com/v1/spending/analytics/2025-01 \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

---

## Implementation Status

| Endpoint | Status | Notes |
|----------|--------|-------|
| GET /v1/budgets | ✅ Deployed | List all budgets |
| POST /v1/budgets | ✅ Deployed | Create budget |
| GET /v1/budgets/:month | ✅ Deployed | Get specific budget |
| PUT /v1/budgets/:month | ✅ Deployed | Update budget |
| DELETE /v1/budgets/:month | ✅ Deployed | Archive budget |
| GET /v1/categories | ✅ Deployed | List categories |
| POST /v1/categories | ✅ Deployed | Create category |
| PUT /v1/categories/:id | ✅ Deployed | Update category |
| DELETE /v1/categories/:id | ✅ Deployed | Delete category |
| GET /v1/transactions | ✅ Deployed | List/filter transactions |
| POST /v1/transactions | ✅ Deployed | Create transaction |
| PUT /v1/transactions/:id | ✅ Deployed | Update transaction |
| DELETE /v1/transactions/:id | ✅ Deployed | Delete transaction |
| GET /v1/spending/analytics/:month | ✅ Deployed | Get analytics |
| POST /v1/spending/analytics/:month/generate | ✅ Deployed | Generate analytics |

**Total Endpoints:** 15  
**Deployment Status:** ✅ All deployed (January 17, 2025)

---

## Next Steps

1. **Frontend Integration** - Build UI pages to consume these APIs
2. **AI Integration** - Update `get_user_context` tool to fetch budget data
3. **Automatic Analytics** - Trigger analytics recalculation on transaction create/update/delete
4. **Recurring Transactions** - Implement recurring transaction templates
5. **Budget Goals** - Add budget goal tracking endpoints
6. **Batch Operations** - Add bulk transaction import
7. **CSV Export** - Export transactions and analytics to CSV

---

**Last Updated:** January 17, 2025  
**API Version:** 0.4.0  
**Documentation:** Complete ✅
