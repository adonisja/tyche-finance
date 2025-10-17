# Income & Expense Category Classification System

## Overview

The transaction entry form now dynamically adjusts based on transaction type (Income vs Expense), showing relevant category options for better financial tracking and analytics.

## System Design

### Two Transaction Tables

**Planned (Budget)**:
- Created in Budget Setup page (`/budget`)
- Represents your **financial plan** for the month
- Income breakdown: salary, bonuses, sideIncome, investments, other
- Expense allocations: 19 categories (groceries, dining, etc.)

**Actual (Transactions)**:
- Created in Spending Dashboard (`/spending`)
- Represents **what really happened**
- Income transactions: 9 detailed categories
- Expense transactions: 19 detailed categories

## Category Classifications

### Income Categories (9 types)

When adding income transactions, users can classify:

| Category | Emoji | Use Case | Examples |
|----------|-------|----------|----------|
| `other_income` | 💰 | Miscellaneous income | Garage sale, one-off earnings |
| `salary` | 💼 | Regular employment | Monthly paycheck, wages |
| `bonuses` | 🎉 | Performance bonuses | Year-end bonus, quarterly bonus |
| `side_income` | 💡 | Side hustles | Uber, Etsy shop, tutoring |
| `freelance` | 💻 | Contract work | Consulting, design projects |
| `investments` | 📈 | Investment returns | Dividends, capital gains, interest |
| `rental_income` | 🏘️ | Property rental | Apartment rent, Airbnb |
| `refunds` | 🔄 | Money returned | Tax refunds, product returns |
| `gifts_received` | 🎁 | Gifts | Birthday money, holiday gifts |

### Expense Categories (19 types)

When adding expense transactions, users can classify:

| Category | Emoji | Essential? | Examples |
|----------|-------|------------|----------|
| `miscellaneous` | 📦 | Varies | One-off purchases |
| `groceries` | 🛒 | Yes | Supermarket, food shopping |
| `dining` | 🍽️ | No | Restaurants, takeout, delivery |
| `transportation` | 🚗 | Yes | Gas, car payment, repairs, Uber |
| `utilities` | 💡 | Yes | Electric, water, gas, internet |
| `housing` | 🏠 | Yes | Rent, mortgage, HOA fees |
| `healthcare` | 🏥 | Yes | Doctor visits, prescriptions |
| `insurance` | 🛡️ | Yes | Health, auto, home, life |
| `entertainment` | 🎬 | No | Movies, concerts, hobbies |
| `shopping` | 🛍️ | No | Clothing, electronics, non-essentials |
| `personal_care` | 💅 | Varies | Haircuts, cosmetics, gym |
| `education` | 📚 | Yes | Tuition, books, courses |
| `childcare` | 👶 | Yes | Daycare, babysitting |
| `pets` | 🐕 | Varies | Pet food, vet visits, supplies |
| `gifts` | 🎁 | No | Birthday gifts, donations |
| `travel` | ✈️ | No | Flights, hotels, vacations |
| `subscriptions` | 📺 | Varies | Netflix, Spotify, apps |
| `debt_payments` | 💳 | Yes | Credit card payments, loans |
| `savings` | 💰 | Yes | Emergency fund, retirement |

## Dynamic Form Behavior

### When User Toggles to "Income" (💵):

**Category Dropdown Changes**:
```
Shows:
- 💰 Other Income (default)
- 💼 Salary
- 🎉 Bonuses
- 💡 Side Income
- 💻 Freelance
- 📈 Investments
- 🏘️ Rental Income
- 🔄 Refunds
- 🎁 Gifts Received
```

**"Essential" Checkbox**:
- Hidden (income is never "essential")

**Button Text**:
- Changes to "💵 Add Income" (green)

**Amount Display**:
- Shows as positive green number in transaction list

### When User Toggles to "Expense" (💸):

**Category Dropdown Changes**:
```
Shows:
- 📦 Miscellaneous (default)
- 🛒 Groceries
- 🍽️ Dining Out
- 🚗 Transportation
- ... (all 19 expense categories)
```

**"Essential" Checkbox**:
- Visible and checkable
- Helps distinguish needs vs wants

**Button Text**:
- Changes to "💸 Add Expense" (red)

**Amount Display**:
- Shows as negative red number in transaction list

## Implementation

### State Management

```typescript
const [transactionForm, setTransactionForm] = useState({
  date: new Date().toISOString().split('T')[0],
  description: '',
  amount: '',
  category: 'miscellaneous' as BudgetCategoryType,
  isIncome: false,
  isEssential: false,
  notes: '',
});
```

### Type Toggle Handler

```typescript
function handleTransactionTypeChange(isIncome: boolean) {
  setTransactionForm({
    ...transactionForm,
    isIncome,
    category: isIncome ? 'other_income' : 'miscellaneous',
    isEssential: false, // Reset essential for income
  });
}
```

### Dynamic Category Rendering

```tsx
<select value={transactionForm.category}>
  {transactionForm.isIncome ? (
    // Income Categories
    <>
      <option value="other_income">💰 Other Income</option>
      <option value="salary">💼 Salary</option>
      {/* ... more income options */}
    </>
  ) : (
    // Expense Categories
    <>
      <option value="miscellaneous">📦 Miscellaneous</option>
      <option value="groceries">🛒 Groceries</option>
      {/* ... more expense options */}
    </>
  )}
</select>
```

## Use Case Examples

### Example 1: Garage Sale Income

**User Action**:
1. Clicks "Add Transaction"
2. Toggles to "💵 Income"
3. Selects "💰 Other Income"
4. Description: "Garage sale - old jacket"
5. Amount: $10.00

**Result**:
```json
{
  "date": "2025-10-17",
  "description": "Garage sale - old jacket",
  "amount": 10.00,
  "category": "other_income",
  "isIncome": true,
  "isEssential": false
}
```

**Analytics Impact**:
- Total Income: +$10
- Category: Other Income +$10
- Can compare against planned "Other" income in budget

### Example 2: Freelance Project

**User Action**:
1. Toggles to "💵 Income"
2. Selects "💻 Freelance"
3. Description: "Logo design for ABC Corp"
4. Amount: $500.00

**Result**:
```json
{
  "category": "freelance",
  "isIncome": true,
  "amount": 500.00
}
```

**Analytics shows**: 
- Freelance income tracked separately
- Can see trends over time
- Compare to budgeted side income

### Example 3: Emergency Car Repair

**User Action**:
1. Leaves as "💸 Expense"
2. Selects "🚗 Transportation"
3. Description: "Tire blowout repair"
4. Amount: $120.00
5. Checks "Essential" ✓

**Result**:
```json
{
  "category": "transportation",
  "isIncome": false,
  "isEssential": true,
  "amount": 120.00
}
```

**Analytics shows**:
- Transportation budget impact
- Marked as essential expense
- Affects category progress bar

### Example 4: Concert Tickets (Discretionary)

**User Action**:
1. Expense type
2. Selects "🎬 Entertainment"
3. Description: "Concert tickets"
4. Amount: $200.00
5. Essential: unchecked

**Result**:
```json
{
  "category": "entertainment",
  "isIncome": false,
  "isEssential": false,
  "amount": 200.00
}
```

**Analytics shows**:
- Entertainment overspending alert (if over budget)
- Non-essential expense (potential cut if needed)

## Analytics & Reporting Benefits

### Income Breakdown
```
Total Income: $5,510
├── Salary: $5,000 (90.7%)
├── Freelance: $500 (9.1%)
└── Other Income: $10 (0.2%)
```

### Expense Breakdown
```
Total Expenses: $3,200
├── Housing: $1,200 (37.5%) ✅ Under budget
├── Groceries: $450 (14.1%) ✅ Under budget
├── Transportation: $320 (10.0%) ⚠️ Over budget
├── Dining: $280 (8.8%) ⚠️ Over budget
└── Entertainment: $200 (6.3%) ⚠️ Over budget
```

### Essential vs Discretionary
```
Essential Expenses: $2,400 (75%)
├── Housing: $1,200
├── Groceries: $450
├── Utilities: $150
├── Transportation: $320
└── Healthcare: $280

Discretionary Expenses: $800 (25%)
├── Dining: $280
├── Entertainment: $200
├── Shopping: $180
└── Subscriptions: $140
```

## AI Chat Integration

The AI can now provide more detailed advice:

**User**: "Where should I cut spending?"

**AI Response**:
```
Based on your transactions, I see you're over budget in:

🍽️ Dining ($280) - $80 over budget
• You had 12 dining transactions this month
• Average $23 per meal
• Suggestion: Meal prep 2-3 times per week

🎬 Entertainment ($200) - $50 over budget  
• Concert tickets were a big one-time expense
• Consider setting aside money in advance for events

✅ Your essential expenses are well-controlled!
```

## Backend Storage

### DynamoDB Transaction Record
```typescript
{
  PK: "USER#user123",
  SK: "TRANSACTION#2025-10-17#txn123",
  
  // Core fields
  date: "2025-10-17T14:30:00Z",
  description: "Garage sale - old jacket",
  amount: 10.00,
  
  // Classification
  category: "other_income",
  isIncome: true,
  isEssential: false,
  
  // Optional
  notes: "Old leather jacket from closet",
  tags: ["garage_sale", "clothing"],
  
  // Metadata
  createdAt: "2025-10-17T14:35:22Z",
  updatedAt: "2025-10-17T14:35:22Z"
}
```

### Query Patterns

**Get all income by category**:
```typescript
const incomeByCategory = transactions
  .filter(t => t.isIncome)
  .reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {});

// Result:
// {
//   salary: 5000,
//   freelance: 500,
//   other_income: 10
// }
```

**Get essential vs discretionary expenses**:
```typescript
const essential = transactions
  .filter(t => !t.isIncome && t.isEssential)
  .reduce((sum, t) => sum + t.amount, 0);

const discretionary = transactions
  .filter(t => !t.isIncome && !t.isEssential)
  .reduce((sum, t) => sum + t.amount, 0);
```

## Future Enhancements

### Phase 2: Auto-Categorization
- ML model learns from past transactions
- Suggests category based on description
- "Starbucks" → automatically suggests "Dining"
- "Whole Foods" → automatically suggests "Groceries"

### Phase 3: Budget Recommendations
- "You're spending a lot on dining"
- "Consider increasing transportation budget"
- "Your freelance income is growing - update your budget!"

### Phase 4: Income Goals
- Set income goals by category
- "Goal: $1,000/month in freelance income"
- Track progress toward goals

### Phase 5: Tax Planning
- Flag income categories for tax reporting
- Separate 1099 income (freelance) from W-2 (salary)
- Deductible expense tracking

## Summary

✅ **Dynamic Form**: Category dropdown changes based on Income/Expense toggle  
✅ **9 Income Categories**: Detailed tracking of income sources  
✅ **19 Expense Categories**: Comprehensive expense classification  
✅ **Essential Flag**: Distinguish needs vs wants for expenses  
✅ **Better Analytics**: More granular insights for AI and reporting  
✅ **Consistent System**: Aligns with Budget Setup income breakdown  

---

**Status**: ✅ Complete and deployed  
**Last Updated**: October 2025  
**Version**: 2.0.0
