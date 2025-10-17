/**
 * Budget Setup Page
 * 
 * Interface for creating and managing monthly budgets.
 * Features:
 * - Monthly budget selection
 * - Income entry with breakdown
 * - Category allocation (21 standard categories)
 * - Visual pie chart of budget allocation
 * - Automatic calculation of discretionary income
 * - Real-time validation
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link, useLocation } from 'react-router-dom';
import { fetchAuthSession } from 'aws-amplify/auth';
import * as d3 from 'd3';
import type { MonthlyBudget, BudgetCategoryType } from '@tyche/types';
import './BudgetSetup.css';

// 21 standard budget categories from types
const BUDGET_CATEGORIES: { type: BudgetCategoryType; label: string; defaultPercent: number }[] = [
  { type: 'housing', label: '🏠 Housing', defaultPercent: 30 },
  { type: 'transportation', label: '🚗 Transportation', defaultPercent: 15 },
  { type: 'groceries', label: '🛒 Groceries', defaultPercent: 12 },
  { type: 'utilities', label: '💡 Utilities', defaultPercent: 5 },
  { type: 'healthcare', label: '🏥 Healthcare', defaultPercent: 5 },
  { type: 'insurance', label: '🛡️ Insurance', defaultPercent: 5 },
  { type: 'debt_payments', label: '💳 Debt Payments', defaultPercent: 10 },
  { type: 'savings', label: '💰 Savings', defaultPercent: 10 },
  { type: 'dining', label: '🍽️ Dining Out', defaultPercent: 5 },
  { type: 'entertainment', label: '🎬 Entertainment', defaultPercent: 3 },
  { type: 'shopping', label: '🛍️ Shopping', defaultPercent: 5 },
  { type: 'personal_care', label: '💅 Personal Care', defaultPercent: 2 },
  { type: 'education', label: '📚 Education', defaultPercent: 3 },
  { type: 'childcare', label: '👶 Childcare', defaultPercent: 0 },
  { type: 'pets', label: '🐕 Pets', defaultPercent: 2 },
  { type: 'gifts', label: '🎁 Gifts', defaultPercent: 2 },
  { type: 'travel', label: '✈️ Travel', defaultPercent: 3 },
  { type: 'subscriptions', label: '📺 Subscriptions', defaultPercent: 2 },
  { type: 'miscellaneous', label: '📦 Miscellaneous', defaultPercent: 3 },
  { type: 'income', label: '💵 Income', defaultPercent: 0 },
];

interface IncomeBreakdown {
  salary?: number;
  bonuses?: number;
  sideIncome?: number;
  investments?: number;
  other?: number;
}

interface CategoryAllocation {
  [key: string]: number; // category type -> allocated amount
}

export function BudgetSetupPage() {
  const { user, logout } = useAuth();
  const location = useLocation();
  
  // Budget state - LOCKED TO CURRENT MONTH
  const currentMonth = getCurrentMonth();
  const [totalIncome, setTotalIncome] = useState<string>('');
  const [incomeBreakdown, setIncomeBreakdown] = useState<IncomeBreakdown>({
    salary: 0,
    bonuses: 0,
    sideIncome: 0,
    investments: 0,
    other: 0,
  });
  const [categoryAllocations, setCategoryAllocations] = useState<CategoryAllocation>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [existingBudget, setExistingBudget] = useState<MonthlyBudget | null>(null);
  const [isEditWindowExpired, setIsEditWindowExpired] = useState(false);

  // Calculated values
  const totalIncomeNum = parseFloat(totalIncome) || 0;
  const totalAllocated = Object.values(categoryAllocations).reduce((sum, val) => sum + val, 0);
  const discretionaryIncome = totalIncomeNum - totalAllocated;
  const percentAllocated = totalIncomeNum > 0 ? (totalAllocated / totalIncomeNum) * 100 : 0;

  // Check if budget is within 24-hour edit window
  function checkEditWindow(budget: MonthlyBudget): boolean {
    const createdTime = new Date(budget.createdAt).getTime();
    const now = Date.now();
    const hoursSinceCreation = (now - createdTime) / (1000 * 60 * 60);
    return hoursSinceCreation > 24;
  }

  useEffect(() => {
    if (user) {
      loadBudget(currentMonth);
    }
  }, [user]);

  // Auto-distribute budget when income changes
  useEffect(() => {
    if (totalIncomeNum > 0 && totalAllocated === 0) {
      autoDistributeBudget();
    }
  }, [totalIncomeNum]);

  // Update total income when breakdown changes
  useEffect(() => {
    const total = Object.values(incomeBreakdown).reduce((sum, val) => sum + (val || 0), 0);
    setTotalIncome(total.toString());
  }, [incomeBreakdown]);

  async function loadBudget(month: string) {
    setLoading(true);
    setError(null);
    
    try {
      if (!user) {
        setLoading(false);
        return;
      }

      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `https://841dg6itk5.execute-api.us-east-1.amazonaws.com/v1/budgets/${month}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.status === 404) {
        // No budget exists for this month
        setExistingBudget(null);
        resetForm();
      } else if (response.ok) {
        const data = await response.json();
        const budgetData = data.budget;
        
        if (budgetData) {
          setExistingBudget(budgetData);
          populateFormFromBudget(budgetData);
          
          // Check if 24-hour edit window has expired
          const expired = checkEditWindow(budgetData);
          setIsEditWindowExpired(expired);
        } else {
          setExistingBudget(null);
          resetForm();
          setIsEditWindowExpired(false);
        }
      } else {
        throw new Error('Failed to load budget');
      }
    } catch (err) {
      console.error('Error loading budget:', err);
      setError(err instanceof Error ? err.message : 'Failed to load budget');
    } finally {
      setLoading(false);
    }
  }

  function populateFormFromBudget(budget: MonthlyBudget | null) {
    if (!budget) {
      resetForm();
      return;
    }
    
    setTotalIncome(budget.totalIncome?.toString() || '0');
    setIncomeBreakdown(budget.incomeBreakdown || {
      salary: 0,
      bonuses: 0,
      sideIncome: 0,
      investments: 0,
      other: 0,
    });
    
    // For now, just set allocations to empty - we'll fetch categories separately later
    // The API response structure needs to be updated to include categories
    setCategoryAllocations({});
  }

  function resetForm() {
    setTotalIncome('');
    setIncomeBreakdown({ salary: 0, bonuses: 0, sideIncome: 0, investments: 0, other: 0 });
    setCategoryAllocations({});
  }

  function autoDistributeBudget() {
    const allocations: CategoryAllocation = {};
    
    BUDGET_CATEGORIES.forEach(cat => {
      if (cat.type !== 'income' && cat.defaultPercent > 0) {
        allocations[cat.type] = Math.round((totalIncomeNum * cat.defaultPercent) / 100);
      }
    });
    
    setCategoryAllocations(allocations);
  }

  function updateCategoryAllocation(categoryType: string, amount: string) {
    const numAmount = parseFloat(amount) || 0;
    setCategoryAllocations(prev => ({
      ...prev,
      [categoryType]: numAmount,
    }));
  }

  async function saveBudget() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!user) {
        throw new Error('Not authenticated');
      }

      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Build categories array - simplified structure for API
      const categories = Object.entries(categoryAllocations)
        .filter(([_, amount]) => amount > 0)
        .map(([type, budgetedAmount]) => ({
          id: `cat_${type}_${Date.now()}`,
          type: type as BudgetCategoryType,
          budgetedAmount,
          actualSpent: 0,
          status: 'active' as const,
        }));

      const budgetData = {
        month: currentMonth,
        totalIncome: totalIncomeNum,
        incomeBreakdown,
        categories,
        totalPlannedExpenses: totalAllocated,
      };

      const method = existingBudget ? 'PUT' : 'POST';
      const url = existingBudget
        ? `https://841dg6itk5.execute-api.us-east-1.amazonaws.com/v1/budgets/${currentMonth}`
        : 'https://841dg6itk5.execute-api.us-east-1.amazonaws.com/v1/budgets';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(budgetData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save budget');
      }

      const data = await response.json();
      setExistingBudget(data.budget);
      setSuccess(existingBudget ? 'Budget updated successfully!' : 'Budget created successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error saving budget:', err);
      setError(err instanceof Error ? err.message : 'Failed to save budget');
    } finally {
      setLoading(false);
    }
  }

  function renderPieChart() {
    const width = 400;
    const height = 400;
    const radius = Math.min(width, height) / 2;

    // Prepare data for pie chart
    const chartData = Object.entries(categoryAllocations)
      .filter(([_, amount]) => amount > 0)
      .map(([type, amount]) => ({
        category: BUDGET_CATEGORIES.find(c => c.type === type)?.label || type,
        amount,
      }));

    if (chartData.length === 0) {
      return (
        <div className="pie-chart-placeholder">
          <p>💡 Enter your income and allocate budget to categories to see the chart</p>
        </div>
      );
    }

    // Create pie generator
    const pie = d3.pie<any>().value(d => d.amount);
    const arc = d3.arc().innerRadius(0).outerRadius(radius - 20);
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    return (
      <svg width={width} height={height} className="budget-pie-chart">
        <g transform={`translate(${width / 2}, ${height / 2})`}>
          {pie(chartData).map((d, i) => (
            <g key={i}>
              <path
                d={arc(d as any) || ''}
                fill={colorScale(i.toString())}
                stroke="#fff"
                strokeWidth={2}
              />
              <text
                transform={`translate(${arc.centroid(d as any)})`}
                textAnchor="middle"
                fill="#fff"
                fontSize="12px"
                fontWeight="bold"
              >
                {d.data.amount > totalIncomeNum * 0.05 ? `$${Math.round(d.data.amount)}` : ''}
              </text>
            </g>
          ))}
        </g>
      </svg>
    );
  }

  return (
    <div className="budget-setup-page">
      {/* Navigation Bar */}
      <nav className="nav-bar">
        <div className="nav-content">
          <div className="nav-left">
            <Link to="/dashboard" className="nav-brand">💎 Tyche Finance</Link>
            <div className="nav-links">
              <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>Dashboard</Link>
              <Link to="/cards" className={location.pathname === '/cards' ? 'active' : ''}>Cards</Link>
              <Link to="/budget" className={location.pathname === '/budget' ? 'active' : ''}>Budget</Link>
              <Link to="/spending" className={location.pathname.startsWith('/spending') ? 'active' : ''}>Spending</Link>
              <Link to="/chat" className={location.pathname === '/chat' ? 'active' : ''}>AI Chat</Link>
              <Link to="/analytics" className={location.pathname === '/analytics' ? 'active' : ''}>Analytics</Link>
            </div>
          </div>
          <div className="nav-right">
            <span className="user-email">{user?.email}</span>
            <button onClick={logout} className="btn-logout">Logout</button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="budget-setup-container">
        <header className="budget-header">
          <h1>💰 Budget Setup</h1>
          <p>Create and manage your monthly budget to track spending and optimize debt payoff</p>
        </header>

        {error && (
          <div className="alert alert-error">
            <span>❌</span>
            <p>{error}</p>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <span>✅</span>
            <p>{success}</p>
          </div>
        )}

        {/* Current Month Display */}
        <div className="month-display-card">
          <div className="month-info">
            <div className="month-header">
              <h3>📅 Today</h3>
              <span className="month-value">
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric'
                })}
              </span>
            </div>
            {existingBudget && !isEditWindowExpired && (
              <div className="edit-window-notice">
                <span className="notice-icon">⏰</span>
                <p>
                  Budget created {new Date(existingBudget.createdAt).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}.
                  You can edit until {new Date(new Date(existingBudget.createdAt).getTime() + 24 * 60 * 60 * 1000).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit'
                  })}.
                </p>
              </div>
            )}
            {isEditWindowExpired && (
              <div className="edit-window-expired">
                <span className="notice-icon">🔒</span>
                <p>
                  <strong>Budget locked.</strong> This budget was created over 24 hours ago and can no longer be edited.
                  This helps maintain accurate financial tracking. View historical budgets in the Analytics page.
                </p>
              </div>
            )}
            {!existingBudget && (
              <div className="create-budget-notice">
                <div className="notice-icon-top">💡</div>
                <p>
                  <strong>Create your first budget!</strong>
                  <br/>
                  You'll have 24 hours to make changes after saving.
                  After that, your budget locks to ensure honest tracking and better analytics.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Budget Overview */}
        <div className="budget-overview-grid">
          <div className="overview-card">
            <div className="overview-icon">💵</div>
            <div className="overview-content">
              <p className="overview-label">Total Income</p>
              <p className="overview-value">${totalIncomeNum.toLocaleString()}</p>
            </div>
          </div>
          <div className="overview-card">
            <div className="overview-icon">📊</div>
            <div className="overview-content">
              <p className="overview-label">Total Allocated</p>
              <p className="overview-value">${totalAllocated.toLocaleString()}</p>
              <p className="overview-subtext">{percentAllocated.toFixed(1)}% of income</p>
            </div>
          </div>
          <div className="overview-card">
            <div className="overview-icon">💎</div>
            <div className="overview-content">
              <p className="overview-label">Discretionary Income</p>
              <p className={`overview-value ${discretionaryIncome < 0 ? 'negative' : 'positive'}`}>
                ${discretionaryIncome.toLocaleString()}
              </p>
              <p className="overview-subtext">
                {discretionaryIncome < 0 ? '⚠️ Over budget!' : '✅ Available'}
              </p>
            </div>
          </div>
        </div>

        {/* Main Budget Form */}
        <div className={`budget-form-layout ${isEditWindowExpired ? 'budget-locked' : ''}`}>
          {/* Top Row: Income and Expenses side-by-side */}
          <div className="budget-top-row">
            {/* Income Section */}
            <section className="budget-section income-section">
              <h2>💵 Income</h2>
              <div className="income-breakdown">
                <div className="input-group">
                  <label>Salary</label>
                  <input
                    type="number"
                    value={incomeBreakdown.salary || ''}
                    onChange={e => setIncomeBreakdown(prev => ({
                      ...prev,
                      salary: parseFloat(e.target.value) || 0
                    }))}
                    readOnly={isEditWindowExpired}
                    placeholder="0.00"
                    className="income-input"
                  />
                </div>
                <div className="input-group">
                  <label>Bonuses</label>
                  <input
                    type="number"
                    value={incomeBreakdown.bonuses || ''}
                    onChange={e => setIncomeBreakdown(prev => ({
                      ...prev,
                      bonuses: parseFloat(e.target.value) || 0
                    }))}
                    placeholder="0.00"
                    className="income-input"
                  />
                </div>
                <div className="input-group">
                  <label>Side Income</label>
                  <input
                    type="number"
                    value={incomeBreakdown.sideIncome || ''}
                    onChange={e => setIncomeBreakdown(prev => ({
                      ...prev,
                      sideIncome: parseFloat(e.target.value) || 0
                    }))}
                    placeholder="0.00"
                    className="income-input"
                  />
                </div>
                <div className="input-group">
                  <label>Investments</label>
                  <input
                    type="number"
                    value={incomeBreakdown.investments || ''}
                    onChange={e => setIncomeBreakdown(prev => ({
                      ...prev,
                      investments: parseFloat(e.target.value) || 0
                    }))}
                    placeholder="0.00"
                    className="income-input"
                  />
                </div>
                <div className="input-group">
                  <label>Other</label>
                  <input
                    type="number"
                    value={incomeBreakdown.other || ''}
                    onChange={e => setIncomeBreakdown(prev => ({
                      ...prev,
                      other: parseFloat(e.target.value) || 0
                    }))}
                    placeholder="0.00"
                    className="income-input"
                  />
                </div>
                <div className="income-total">
                  <strong>Total Income:</strong>
                  <strong>${totalIncomeNum.toLocaleString()}</strong>
                </div>
              </div>
              <button
                onClick={saveBudget}
                disabled={loading || totalIncomeNum === 0}
                className="btn-auto-distribute"
              >
                ⬆️ Upload Income
              </button>
            </section>

            {/* Expenses Section */}
            <section className="budget-section expenses-section">
              <h2>💸 Expenses</h2>
              <div className="categories-grid">
                {BUDGET_CATEGORIES.filter(cat => cat.type !== 'income').map(category => {
                  const allocated = categoryAllocations[category.type] || 0;
                  const percent = totalIncomeNum > 0 ? (allocated / totalIncomeNum) * 100 : 0;
                  return (
                    <div key={category.type} className="category-card">
                      <div className="category-header">
                        <span className="category-label">{category.label}</span>
                        <span className="category-percent">{percent.toFixed(1)}%</span>
                      </div>
                      <input
                        type="number"
                        value={allocated || ''}
                        onChange={e => updateCategoryAllocation(category.type, e.target.value)}
                        placeholder="0.00"
                        className="category-input"
                      />
                      <div className="category-bar">
                        <div
                          className="category-bar-fill"
                          style={{ width: `${Math.min(percent, 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="expense-total" style={{ marginTop: '1rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong style={{ textAlign: 'left' }}>Total Expense:</strong>
                <strong style={{ textAlign: 'right' }}>${totalAllocated.toLocaleString()}</strong>
              </div>
              <button
                onClick={saveBudget}
                disabled={loading || totalAllocated === 0}
                className="btn-auto-distribute"
              >
                ⬆️ Upload Expense
              </button>
            </section>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="budget-actions">
          <button
            onClick={saveBudget}
            disabled={loading || totalIncomeNum === 0 || discretionaryIncome < 0 || isEditWindowExpired}
            className="btn-save-budget"
            title={isEditWindowExpired ? "Budget is locked - 24-hour edit window has expired" : ""}
          >
            {loading ? '💾 Saving...' : existingBudget ? '💾 Update Budget' : '💾 Create Budget'}
          </button>
          <button onClick={resetForm} className="btn-reset" disabled={loading || isEditWindowExpired}>
            🔄 Reset Form
          </button>
          {existingBudget && (
            <Link to={`/spending/${currentMonth}`} className="btn-view-spending">
              📊 View Spending Dashboard
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function to get current month in YYYY-MM format
function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}
