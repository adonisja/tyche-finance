/**
 * Dashboard Page
 * 
 * Main overview dashboard showing:
 * - Budget summary
 * - Credit cards overview
 * - Quick action cards
 * - Navigation to specialized dashboards
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useCreditCards } from '../hooks/useCreditCards';
import { Link, useLocation } from 'react-router-dom';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { MonthlyBudget } from '@tyche/types';
import './Dashboard.css';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const { cards, loading: cardsLoading } = useCreditCards();
  const location = useLocation();
  const [budget, setBudget] = useState<MonthlyBudget | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(true);

  const loading = cardsLoading || budgetLoading;

  // Calculate credit card metrics
  const totalDebt = cards.reduce((sum, card) => sum + card.balance, 0);
  const totalLimit = cards.reduce((sum, card) => sum + card.limit, 0);
  const totalCredit = totalLimit - totalDebt;
  const avgUtilization = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0;

  // Budget metrics
  const budgetIncome = budget?.totalIncome || 0;
  const budgetExpenses = budget?.totalPlannedExpenses || 0;
  const discretionaryIncome = budget?.discretionaryIncome || 0;
  const availableForDebt = budget?.availableForDebtPayoff || 0;

  useEffect(() => {
    if (user) {
      loadCurrentBudget();
    } else {
      setBudgetLoading(false);
    }
  }, [user]);

  async function loadCurrentBudget() {
    try {
      setBudgetLoading(true);
      
      // Wait for auth to be ready
      if (!user) {
        setBudgetLoading(false);
        return;
      }

      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      
      if (!token) {
        setBudgetLoading(false);
        return;
      }

      const currentMonth = getCurrentMonth();
      const response = await fetch(
        `https://841dg6itk5.execute-api.us-east-1.amazonaws.com/v1/budgets/${currentMonth}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setBudget(data.budget);
      }
    } catch (err) {
      console.error('Error loading budget:', err);
    } finally {
      setBudgetLoading(false);
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
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="dashboard-container">
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

      <div className="dashboard-content">
        <header className="dashboard-header">
          <div>
            <h2>Welcome back, {user?.email?.split('@')[0] || 'User'}! 👋</h2>
            <p className="subtitle">Your personal finance overview</p>
          </div>
        </header>

        {loading ? (
          <div className="loading">Loading your data...</div>
        ) : (
          <>
            {/* Quick Action Cards */}
            <div className="action-cards-grid">
              <Link to="/budget" className="action-card budget-card">
                <div className="action-icon">💰</div>
                <h3>Budget Setup</h3>
                <p>{budget ? 'Update your monthly budget' : 'Create your first budget'}</p>
                {budget && (
                  <div className="card-stat">
                    <span className="stat-label">This Month:</span>
                    <span className="stat-value">{formatCurrency(budgetIncome)}</span>
                  </div>
                )}
              </Link>

              <Link to="/cards" className="action-card cards-card">
                <div className="action-icon">💳</div>
                <h3>Credit Cards</h3>
                <p>Manage your {cards.length} credit card{cards.length !== 1 ? 's' : ''}</p>
                {cards.length > 0 && (
                  <div className="card-stat">
                    <span className="stat-label">Total Debt:</span>
                    <span className="stat-value">{formatCurrency(totalDebt)}</span>
                  </div>
                )}
              </Link>

              <Link to="/spending" className="action-card spending-card">
                <div className="action-icon">💸</div>
                <h3>Spending</h3>
                <p>Track actual vs budgeted spending</p>
                <div className="card-stat">
                  <span className="stat-label">View transactions</span>
                </div>
              </Link>

              <Link to="/spending?addTransaction=true" className="action-card transaction-card">
                <div className="action-icon">➕</div>
                <h3>Add Transaction</h3>
                <p>Record income or expense quickly</p>
                <div className="card-stat">
                  <span className="stat-label">Track spending</span>
                </div>
              </Link>

              <Link to="/chat" className="action-card chat-card">
                <div className="action-icon">🤖</div>
                <h3>AI Chat</h3>
                <p>Get personalized financial advice</p>
                <div className="card-stat">
                  <span className="stat-label">Ask me anything!</span>
                </div>
              </Link>

              <Link to="/analytics" className="action-card analytics-card">
                <div className="action-icon">📊</div>
                <h3>Analytics</h3>
                <p>View insights and spending trends</p>
                <div className="card-stat">
                  <span className="stat-label">Coming Soon</span>
                </div>
              </Link>
            </div>

            {/* Financial Overview */}
            <div className="overview-section">
              <h3>💎 Financial Overview</h3>
              <div className="metrics-grid">
                {/* Credit Cards Summary */}
                <div className="metric-card">
                  <div className="metric-icon">💳</div>
                  <div className="metric-content">
                    <h4>Total Cards</h4>
                    <p className="metric-value">{cards.length}</p>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-icon">💰</div>
                  <div className="metric-content">
                    <h4>Total Debt</h4>
                    <p className="metric-value">{formatCurrency(totalDebt)}</p>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-icon">💎</div>
                  <div className="metric-content">
                    <h4>Available Credit</h4>
                    <p className="metric-value">{formatCurrency(totalCredit)}</p>
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-icon">📊</div>
                  <div className="metric-content">
                    <h4>Utilization</h4>
                    <p className="metric-value">{formatPercent(avgUtilization)}</p>
                  </div>
                </div>

                {/* Budget Summary */}
                {budget && (
                  <>
                    <div className="metric-card">
                      <div className="metric-icon">💵</div>
                      <div className="metric-content">
                        <h4>Monthly Income</h4>
                        <p className="metric-value">{formatCurrency(budgetIncome)}</p>
                      </div>
                    </div>

                    <div className="metric-card">
                      <div className="metric-icon">📉</div>
                      <div className="metric-content">
                        <h4>Planned Expenses</h4>
                        <p className="metric-value">{formatCurrency(budgetExpenses)}</p>
                      </div>
                    </div>

                    <div className="metric-card">
                      <div className="metric-icon">💎</div>
                      <div className="metric-content">
                        <h4>Discretionary</h4>
                        <p className="metric-value">{formatCurrency(discretionaryIncome)}</p>
                      </div>
                    </div>

                    <div className="metric-card highlight-card">
                      <div className="metric-icon">🎯</div>
                      <div className="metric-content">
                        <h4>For Debt Payoff</h4>
                        <p className="metric-value">{formatCurrency(availableForDebt)}</p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            {!budget && cards.length === 0 && (
              <div className="empty-state-banner">
                <h3>🚀 Get Started</h3>
                <p>Add your credit cards and create a budget to unlock personalized AI insights!</p>
                <div className="quick-actions">
                  <Link to="/cards" className="btn-primary">Add Credit Cards</Link>
                  <Link to="/budget" className="btn-secondary">Create Budget</Link>
                </div>
              </div>
            )}

            {/* Recent Cards Preview */}
            {cards.length > 0 && (
              <div className="section">
                <div className="section-header">
                  <h3>💳 Your Credit Cards</h3>
                  <Link to="/cards" className="btn-link">View All →</Link>
                </div>
                <div className="cards-preview">
                  {cards.slice(0, 3).map(card => (
                    <div key={card.id} className="card-preview-item">
                      <div className="card-preview-header">
                        <span className="card-name">{card.name}</span>
                        <span className="card-network">{card.network}</span>
                      </div>
                      <div className="card-preview-stats">
                        <div className="stat">
                          <span className="stat-label">Balance:</span>
                          <span className="stat-value">{formatCurrency(card.balance)}</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">Limit:</span>
                          <span className="stat-value">{formatCurrency(card.limit)}</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">APR:</span>
                          <span className="stat-value">{formatPercent(card.apr * 100)}</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">Min Payment:</span>
                          <span className="stat-value">{formatCurrency(card.minPayment)}</span>
                        </div>
                      </div>
                      <div className="utilization-bar">
                        <div
                          className="utilization-fill"
                          style={{
                            width: `${Math.min((card.balance / card.limit) * 100, 100)}%`,
                            backgroundColor:
                              card.balance / card.limit > 0.7
                                ? '#e53e3e'
                                : card.balance / card.limit > 0.5
                                ? '#ed8936'
                                : '#48bb78',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Insights Teaser */}
            <div className="ai-insights-banner">
              <div className="banner-content">
                <h3>🤖 Ready for AI-Powered Insights?</h3>
                <p>
                  Chat with our AI to get personalized debt payoff strategies, spending analysis, and
                  financial recommendations tailored to your situation.
                </p>
                <Link to="/chat" className="btn-primary">Start Chatting</Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
