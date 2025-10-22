/**
 * Spending Dashboard Page
 * 
 * Shows actual spending vs budgeted amounts for the current month.
 * Features:
 * - Category progress bars (budgeted vs actual)
 * - Monthly spending chart (D3.js line chart)
 * - Transaction list with filtering
 * - Spending insights and trends
 * - Quick add transaction
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link, useParams, useSearchParams, useLocation } from 'react-router-dom';
import { fetchAuthSession } from 'aws-amplify/auth';
import * as d3 from 'd3';
import type { BudgetCategoryType } from '@tyche/types';
import './SpendingDashboard.css';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: BudgetCategoryType;
  isIncome: boolean;
  isEssential: boolean;
  tags?: string[];
  notes?: string;
}

interface CategorySpending {
  budgeted: number;
  actual: number;
  difference: number;
  percentOfBudget: number;
  percentOfTotal: number;
  transactionCount: number;
}

interface SpendingAnalytics {
  id: string;
  period: string;
  spendingByCategory: Record<string, CategorySpending>;
  totalBudgeted: number;
  totalSpent: number;
  totalIncome: number;
  netIncome: number;
  topCategories: string[];
  overspentCategories: string[];
  underspentCategories: string[];
  largestTransactions: Transaction[];
  averageDailySpending: number;
  projectedMonthlySpending: number;
  potentialSavings: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  // Expense Categories
  housing: '🏠 Housing',
  transportation: '🚗 Transportation',
  groceries: '🛒 Groceries',
  utilities: '💡 Utilities',
  healthcare: '🏥 Healthcare',
  insurance: '🛡️ Insurance',
  debt_payments: '💳 Debt Payments',
  savings: '💰 Savings',
  dining: '🍽️ Dining Out',
  entertainment: '🎬 Entertainment',
  shopping: '🛍️ Shopping',
  personal_care: '💅 Personal Care',
  education: '📚 Education',
  childcare: '👶 Childcare',
  pets: '🐕 Pets',
  gifts: '🎁 Gifts',
  travel: '✈️ Travel',
  subscriptions: '📺 Subscriptions',
  miscellaneous: '📦 Miscellaneous',
  
  // Income Categories
  income: '💵 Income',
  salary: '💼 Salary',
  bonuses: '🎉 Bonuses',
  side_income: '💡 Side Income',
  investments: '📈 Investments',
  other_income: '💰 Other Income',
  refunds: '🔄 Refunds',
  gifts_received: '🎁 Gifts Received',
  freelance: '💻 Freelance',
  rental_income: '🏘️ Rental Income',
};

export function SpendingDashboard() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentMonth = getCurrentMonth(); // LOCKED TO CURRENT MONTH
  const [analytics, setAnalytics] = useState<SpendingAnalytics | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  
  // Transaction form state
  const [transactionForm, setTransactionForm] = useState({
    date: new Date().toISOString().split('T')[0],
    description: '',
    amount: '',
    category: 'miscellaneous' as BudgetCategoryType,
    isIncome: false,
    isEssential: false,
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  // Check for addTransaction URL parameter
  useEffect(() => {
    if (searchParams.get('addTransaction') === 'true') {
      setShowAddTransaction(true);
      // Remove the parameter from URL
      searchParams.delete('addTransaction');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Update category when transaction type changes
  function handleTransactionTypeChange(isIncome: boolean) {
    setTransactionForm({
      ...transactionForm,
      isIncome,
      category: isIncome ? 'other_income' as BudgetCategoryType : 'miscellaneous' as BudgetCategoryType,
      isEssential: false, // Reset essential for income
    });
  }

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      if (!user) return;

      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Load analytics and transactions in parallel
      const [analyticsRes, transactionsRes] = await Promise.all([
        fetch(
          `https://841dg6itk5.execute-api.us-east-1.amazonaws.com/v1/spending/analytics/${currentMonth}`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        fetch(
          `https://841dg6itk5.execute-api.us-east-1.amazonaws.com/v1/transactions?month=${currentMonth}`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
      ]);

      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        setAnalytics(data.analytics);
      } else {
        console.warn('No analytics found for month:', currentMonth);
        setAnalytics(null);
      }

      if (transactionsRes.ok) {
        const data = await transactionsRes.json();
        setTransactions(data.transactions || []);
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error('Error loading spending data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load spending data');
    } finally {
      setLoading(false);
    }
  }

  function getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amount));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (!user) return;

      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Validate form
      if (!transactionForm.description.trim()) {
        throw new Error('Description is required');
      }
      if (!transactionForm.amount || parseFloat(transactionForm.amount) <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      // Create transaction payload
      const payload = {
        date: new Date(transactionForm.date).toISOString(),
        description: transactionForm.description.trim(),
        amount: parseFloat(transactionForm.amount),
        category: transactionForm.category, // Use the selected category for both income and expenses
        isIncome: transactionForm.isIncome,
        isEssential: transactionForm.isEssential,
        notes: transactionForm.notes.trim() || undefined,
      };

      const response = await fetch(
        'https://841dg6itk5.execute-api.us-east-1.amazonaws.com/v1/transactions',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add transaction');
      }

      // Success! Reset form and reload data
      setTransactionForm({
        date: new Date().toISOString().split('T')[0],
        description: '',
        amount: '',
        category: 'miscellaneous' as BudgetCategoryType,
        isIncome: false,
        isEssential: false,
        notes: '',
      });
      setShowAddTransaction(false);
      
      // Reload data to show new transaction
      await loadData();
      
    } catch (err) {
      console.error('Error adding transaction:', err);
      setError(err instanceof Error ? err.message : 'Failed to add transaction');
    } finally {
      setSaving(false);
    }
  }

  // Filter transactions by category
  const filteredTransactions = filterCategory === 'all'
    ? transactions
    : transactions.filter(t => t.category === filterCategory);

  // Sort transactions by date (newest first)
  const sortedTransactions = [...filteredTransactions].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Get categories with spending data
  const categorySpending = analytics?.spendingByCategory || {};
  const categories = Object.entries(categorySpending).filter(
    ([cat]) => cat !== 'income'
  );

  return (
    <div className="spending-dashboard-page">
      {/* Navigation Bar */}
      <nav className="dashboard-nav">
        <h1>💎 Tyche</h1>
        <div className="nav-links">
          <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>Dashboard</Link>
          <Link to="/cards" className={location.pathname === '/cards' ? 'active' : ''}>Cards</Link>
          <Link to="/budget" className={location.pathname === '/budget' ? 'active' : ''}>Budget</Link>
          <Link to="/spending" className={location.pathname.startsWith('/spending') ? 'active' : ''}>Spending</Link>
          <Link to="/chat" className={location.pathname === '/chat' ? 'active' : ''}>AI Chat</Link>
          <Link to="/analytics" className={location.pathname === '/analytics' ? 'active' : ''}>Analytics</Link>
        </div>
        <div className="nav-right">
          <span className="user-email">{user?.email}</span>
          <button onClick={logout} className="btn-logout">Logout</button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="spending-container">
        <header className="spending-header">
          <div>
            <h1>📊 Spending Dashboard</h1>
            <p>Track your actual spending vs budget</p>
            <div className="current-month-display">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
          <div className="header-actions">
            <button
              onClick={() => setShowAddTransaction(true)}
              className="btn-add-transaction"
            >
              + Add Transaction
            </button>
          </div>
        </header>

        {error && (
          <div className="alert alert-error">
            <span>❌</span>
            <p>{error}</p>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {loading ? (
          <div className="loading">Loading spending data...</div>
        ) : !analytics ? (
          <div className="empty-state">
            <h3>📭 No Data Yet</h3>
            <p>Create a budget and add transactions to see your spending analytics.</p>
            <div className="empty-actions">
              <Link to="/budget" className="btn-primary">Create Budget</Link>
              <button
                onClick={() => setShowAddTransaction(true)}
                className="btn-secondary"
              >
                Add Transaction
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Overview Cards */}
            <div className="overview-grid">
              <div className="overview-card">
                <div className="card-icon">💵</div>
                <div className="card-content">
                  <p className="card-label">Total Income</p>
                  <p className="card-value">{formatCurrency(analytics.totalIncome)}</p>
                </div>
              </div>

              <div className="overview-card">
                <div className="card-icon">💸</div>
                <div className="card-content">
                  <p className="card-label">Total Spent</p>
                  <p className="card-value">{formatCurrency(analytics.totalSpent)}</p>
                  <p className="card-subtext">
                    {((analytics.totalSpent / analytics.totalBudgeted) * 100).toFixed(1)}% of budget
                  </p>
                </div>
              </div>

              <div className="overview-card">
                <div className="card-icon">📊</div>
                <div className="card-content">
                  <p className="card-label">Budgeted</p>
                  <p className="card-value">{formatCurrency(analytics.totalBudgeted)}</p>
                  <p className="card-subtext">
                    {formatCurrency(analytics.totalBudgeted - analytics.totalSpent)} remaining
                  </p>
                </div>
              </div>

              <div className={`overview-card ${analytics.netIncome >= 0 ? 'positive' : 'negative'}`}>
                <div className="card-icon">💎</div>
                <div className="card-content">
                  <p className="card-label">Net Income</p>
                  <p className="card-value">{formatCurrency(analytics.netIncome)}</p>
                  <p className="card-subtext">
                    {analytics.netIncome >= 0 ? '✅ Under budget' : '⚠️ Over budget'}
                  </p>
                </div>
              </div>
            </div>

            {/* Spending Insights */}
            <div className="insights-section">
              <h3>💡 Spending Insights</h3>
              <div className="insights-grid">
                <div className="insight-card">
                  <span className="insight-icon">📈</span>
                  <div className="insight-content">
                    <p className="insight-label">Daily Average</p>
                    <p className="insight-value">{formatCurrency(analytics.averageDailySpending)}</p>
                  </div>
                </div>

                <div className="insight-card">
                  <span className="insight-icon">📅</span>
                  <div className="insight-content">
                    <p className="insight-label">Projected Month</p>
                    <p className="insight-value">{formatCurrency(analytics.projectedMonthlySpending)}</p>
                  </div>
                </div>

                <div className="insight-card">
                  <span className="insight-icon">💰</span>
                  <div className="insight-content">
                    <p className="insight-label">Potential Savings</p>
                    <p className="insight-value">{formatCurrency(analytics.potentialSavings)}</p>
                  </div>
                </div>

                <div className="insight-card">
                  <span className="insight-icon">📊</span>
                  <div className="insight-content">
                    <p className="insight-label">Transactions</p>
                    <p className="insight-value">{transactions.length}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Category Spending */}
            <div className="categories-section">
              <h3>📊 Spending by Category</h3>
              
              {analytics.overspentCategories.length > 0 && (
                <div className="alert alert-warning">
                  <span>⚠️</span>
                  <p>
                    <strong>Over budget:</strong> {analytics.overspentCategories.map(cat => 
                      CATEGORY_LABELS[cat] || cat
                    ).join(', ')}
                  </p>
                </div>
              )}

              <div className="categories-list">
                {categories.map(([category, data]) => {
                  const isOverBudget = data.actual > data.budgeted;
                  const percentage = (data.actual / data.budgeted) * 100;
                  
                  return (
                    <div key={category} className={`category-item ${isOverBudget ? 'over-budget' : ''}`}>
                      <div className="category-header">
                        <div className="category-info">
                          <span className="category-name">{CATEGORY_LABELS[category] || category}</span>
                          <span className="category-count">{data.transactionCount} transactions</span>
                        </div>
                        <div className="category-amounts">
                          <span className={`actual ${isOverBudget ? 'over' : 'under'}`}>
                            {formatCurrency(data.actual)}
                          </span>
                          <span className="budgeted">/ {formatCurrency(data.budgeted)}</span>
                        </div>
                      </div>
                      
                      <div className="category-progress">
                        <div
                          className={`progress-bar ${isOverBudget ? 'over' : 'under'}`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                        {percentage > 100 && (
                          <div
                            className="progress-bar-overflow"
                            style={{ width: `${Math.min(percentage - 100, 50)}%` }}
                          />
                        )}
                      </div>
                      
                      <div className="category-stats">
                        <span className="stat-item">
                          {percentage.toFixed(1)}% of budget
                        </span>
                        <span className="stat-item">
                          {isOverBudget 
                            ? `${formatCurrency(data.difference * -1)} over`
                            : `${formatCurrency(data.difference)} left`
                          }
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Transactions List */}
            <div className="transactions-section">
              <div className="section-header">
                <h3>📝 Recent Transactions</h3>
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="category-filter"
                >
                  <option value="all">All Categories</option>
                  {categories.map(([cat]) => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat] || cat}
                    </option>
                  ))}
                </select>
              </div>

              {sortedTransactions.length === 0 ? (
                <div className="empty-transactions">
                  <p>No transactions for this {filterCategory === 'all' ? 'month' : 'category'}</p>
                  <button
                    onClick={() => setShowAddTransaction(true)}
                    className="btn-secondary"
                  >
                    Add Your First Transaction
                  </button>
                </div>
              ) : (
                <div className="transactions-list">
                  {sortedTransactions.map(transaction => (
                    <div key={transaction.id} className="transaction-item">
                      <div className="transaction-icon">
                        {CATEGORY_LABELS[transaction.category]?.split(' ')[0] || '💵'}
                      </div>
                      <div className="transaction-details">
                        <p className="transaction-description">{transaction.description}</p>
                        <p className="transaction-meta">
                          {formatDate(transaction.date)} · {CATEGORY_LABELS[transaction.category] || transaction.category}
                          {transaction.isEssential && <span className="badge">Essential</span>}
                        </p>
                        {transaction.notes && (
                          <p className="transaction-notes">{transaction.notes}</p>
                        )}
                      </div>
                      <div className={`transaction-amount ${transaction.isIncome ? 'income' : 'expense'}`}>
                        {transaction.isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Add Transaction Modal */}
      {showAddTransaction && (
        <div className="modal-overlay" onClick={() => setShowAddTransaction(false)}>
          <div className="modal-content transaction-form" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>💰 Add Transaction</h3>
              <button 
                className="modal-close"
                onClick={() => setShowAddTransaction(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddTransaction}>
              {/* Transaction Type Toggle */}
              <div className="form-group">
                <label>Transaction Type</label>
                <div className="transaction-type-toggle">
                  <button
                    type="button"
                    className={!transactionForm.isIncome ? 'active expense' : ''}
                    onClick={() => handleTransactionTypeChange(false)}
                  >
                    💸 Expense
                  </button>
                  <button
                    type="button"
                    className={transactionForm.isIncome ? 'active income' : ''}
                    onClick={() => handleTransactionTypeChange(true)}
                  >
                    💵 Income
                  </button>
                </div>
              </div>

              {/* Date */}
              <div className="form-group">
                <label htmlFor="tx-date">Date</label>
                <input
                  type="date"
                  id="tx-date"
                  value={transactionForm.date}
                  onChange={e => setTransactionForm({ ...transactionForm, date: e.target.value })}
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              {/* Description */}
              <div className="form-group">
                <label htmlFor="tx-description">
                  Description <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="tx-description"
                  placeholder={transactionForm.isIncome ? "e.g., Garage sale - jacket" : "e.g., Grocery shopping"}
                  value={transactionForm.description}
                  onChange={e => setTransactionForm({ ...transactionForm, description: e.target.value })}
                  required
                />
              </div>

              {/* Amount */}
              <div className="form-group">
                <label htmlFor="tx-amount">
                  Amount <span className="required">*</span>
                </label>
                <div className="amount-input">
                  <span className="currency-symbol">$</span>
                  <input
                    type="number"
                    id="tx-amount"
                    placeholder="0.00"
                    step="0.01"
                    min="0.01"
                    value={transactionForm.amount}
                    onChange={e => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                    required
                  />
                </div>
              </div>

              {/* Category - Dynamic based on transaction type */}
              <div className="form-group">
                <label htmlFor="tx-category">Category</label>
                <select
                  id="tx-category"
                  value={transactionForm.category}
                  onChange={e => setTransactionForm({ ...transactionForm, category: e.target.value as BudgetCategoryType })}
                >
                  {transactionForm.isIncome ? (
                    // Income Categories
                    <>
                      <option value="other_income">💰 Other Income</option>
                      <option value="salary">💼 Salary</option>
                      <option value="bonuses">🎉 Bonuses</option>
                      <option value="side_income">💡 Side Income</option>
                      <option value="freelance">💻 Freelance</option>
                      <option value="investments">📈 Investments</option>
                      <option value="rental_income">🏘️ Rental Income</option>
                      <option value="refunds">🔄 Refunds</option>
                      <option value="gifts_received">🎁 Gifts Received</option>
                    </>
                  ) : (
                    // Expense Categories
                    <>
                      <option value="miscellaneous">📦 Miscellaneous</option>
                      <option value="groceries">🛒 Groceries</option>
                      <option value="dining">🍽️ Dining Out</option>
                      <option value="transportation">🚗 Transportation</option>
                      <option value="utilities">💡 Utilities</option>
                      <option value="housing">🏠 Housing</option>
                      <option value="healthcare">🏥 Healthcare</option>
                      <option value="insurance">🛡️ Insurance</option>
                      <option value="entertainment">🎬 Entertainment</option>
                      <option value="shopping">🛍️ Shopping</option>
                      <option value="personal_care">💅 Personal Care</option>
                      <option value="education">📚 Education</option>
                      <option value="childcare">👶 Childcare</option>
                      <option value="pets">🐕 Pets</option>
                      <option value="gifts">🎁 Gifts</option>
                      <option value="travel">✈️ Travel</option>
                      <option value="subscriptions">📺 Subscriptions</option>
                      <option value="debt_payments">💳 Debt Payments</option>
                      <option value="savings">💰 Savings</option>
                    </>
                  )}
                </select>
              </div>

              {/* Essential checkbox (only for expenses) */}
              {!transactionForm.isIncome && (
                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={transactionForm.isEssential}
                      onChange={e => setTransactionForm({ ...transactionForm, isEssential: e.target.checked })}
                    />
                    <span>This is an essential expense</span>
                  </label>
                </div>
              )}

              {/* Notes */}
              <div className="form-group">
                <label htmlFor="tx-notes">Notes (optional)</label>
                <textarea
                  id="tx-notes"
                  placeholder="Add any additional details..."
                  rows={3}
                  value={transactionForm.notes}
                  onChange={e => setTransactionForm({ ...transactionForm, notes: e.target.value })}
                />
              </div>

              {/* Form Actions */}
              <div className="form-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAddTransaction(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : transactionForm.isIncome ? '💵 Add Income' : '💸 Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
