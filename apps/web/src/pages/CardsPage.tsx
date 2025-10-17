/**
 * Cards Page
 * 
 * Full CRUD interface for managing credit cards.
 * Features:
 * - List all cards with key metrics
 * - Add new card with form validation
 * - Edit existing cards
 * - Delete cards with confirmation
 * - Calculate utilization and totals
 */

import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useCreditCards } from '../hooks/useCreditCards';
import { Link, useLocation } from 'react-router-dom';
import type { CreditCard } from '../hooks/useCreditCards';
import './Cards.css';

type CardNetwork = 'Visa' | 'Mastercard' | 'American Express' | 'Discover' | 'Other';

interface CardFormData {
  cardName: string;
  network: CardNetwork;
  lastFourDigits: string;
  balance: string;  // Changed to string to handle input better
  creditLimit: string;  // Changed to string to handle input better
  interestRate: string;  // Changed to string for percentage input
  minimumPayment: string;  // Changed to string to handle input better
  dueDate: string;  // Day of month (1-28) when payment is due
}

const initialFormData: CardFormData = {
  cardName: '',
  network: 'Visa',
  lastFourDigits: '',
  balance: '',
  creditLimit: '',
  interestRate: '',
  minimumPayment: '',
  dueDate: '',
};

export function CardsPage() {
  const { user, logout } = useAuth();
  const { cards, loading, error, addCard, updateCard, deleteCard } = useCreditCards();
  const location = useLocation();
  
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [formData, setFormData] = useState<CardFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof CardFormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showAllCards, setShowAllCards] = useState(false);
  const [recentlyEditedCard, setRecentlyEditedCard] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000); // Auto-dismiss after 4 seconds
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const calculateUtilization = (balance: number, limit: number) => {
    return limit > 0 ? (balance / limit) * 100 : 0;
  };

  const totalDebt = cards.reduce((sum, card) => sum + card.balance, 0);
  const totalLimit = cards.reduce((sum, card) => sum + card.limit, 0);
  const avgUtilization = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0;

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof CardFormData, string>> = {};

    if (!formData.cardName.trim()) {
      errors.cardName = 'Card name is required';
    }

    if (!formData.lastFourDigits.match(/^\d{4}$/)) {
      errors.lastFourDigits = 'Must be exactly 4 digits';
    }

    const balance = parseFloat(formData.balance);
    if (isNaN(balance) || balance < 0) {
      errors.balance = 'Balance must be a positive number';
    }

    const creditLimit = parseFloat(formData.creditLimit);
    if (isNaN(creditLimit) || creditLimit <= 0) {
      errors.creditLimit = 'Credit limit must be greater than 0';
    }

    const interestRate = parseFloat(formData.interestRate);
    if (isNaN(interestRate) || interestRate < 0 || interestRate > 100) {
      errors.interestRate = 'Interest rate must be between 0 and 100';
    }

    const minimumPayment = parseFloat(formData.minimumPayment);
    if (isNaN(minimumPayment) || minimumPayment < 0) {
      errors.minimumPayment = 'Minimum payment must be a positive number';
    }

    const dueDate = parseInt(formData.dueDate);
    if (isNaN(dueDate) || dueDate < 1 || dueDate > 28) {
      errors.dueDate = 'Due date must be between 1 and 28';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);
    const cardIdBeingEdited = editingCard?.id || null;
    try {
      if (editingCard) {
        // When updating, only send mutable fields (exclude lastFourDigits, network, and name)
        const updates = {
          balance: parseFloat(formData.balance),
          limit: parseFloat(formData.creditLimit),                    // Backend expects 'limit'
          apr: parseFloat(formData.interestRate) / 100,              // Backend expects 'apr' (decimal)
          minPayment: parseFloat(formData.minimumPayment),           // Backend expects 'minPayment'
          dueDayOfMonth: parseInt(formData.dueDate),                 // Backend expects 'dueDayOfMonth'
        };
        await updateCard(editingCard.id, updates);
        
        // Show success notification
        showNotification('success', `✅ Card updated successfully!`);
      } else {
        // When creating, send all fields including immutable ones
        const cardData = {
          name: formData.cardName,                                    // Backend expects 'name'
          network: formData.network,                                  // Card network type
          lastFourDigits: formData.lastFourDigits,                   // Last 4 digits (security)
          balance: parseFloat(formData.balance),
          limit: parseFloat(formData.creditLimit),                    // Backend expects 'limit'
          apr: parseFloat(formData.interestRate) / 100,              // Backend expects 'apr' (decimal)
          minPayment: parseFloat(formData.minimumPayment),           // Backend expects 'minPayment'
          dueDayOfMonth: parseInt(formData.dueDate),                 // Backend expects 'dueDayOfMonth'
        };
        await addCard(cardData);
        showNotification('success', `✅ Card "${cardData.name}" added successfully!`);
      }
      
      // Reset form
      setFormData(initialFormData);
      setShowForm(false);
      setEditingCard(null);
      setFormErrors({});
    } catch (err: any) {
      console.error('Error saving card:', err);
      showNotification('error', err.message || 'Failed to save card');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (card: CreditCard) => {
    setEditingCard(card);
    setFormData({
      cardName: card.name,                                       // Map from 'name'
      network: (card.network as CardNetwork) || 'Visa',
      lastFourDigits: card.lastFourDigits || '',
      balance: card.balance.toString(),
      creditLimit: card.limit.toString(),                        // Map from 'limit'
      interestRate: (card.apr * 100).toFixed(2),                // Map from 'apr' (decimal to %)
      minimumPayment: card.minPayment.toString(),               // Map from 'minPayment'
      dueDate: card.dueDayOfMonth.toString(),                   // Map from 'dueDayOfMonth'
    });
    setFormErrors({});
    
    // Scroll to the top editing card with smooth animation
    setTimeout(() => {
      const editingElement = document.getElementById('editing-card-container');
      if (editingElement) {
        editingElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleDelete = async (id: string) => {
    const cardToDelete = cards.find(c => c.id === id);
    const cardName = cardToDelete?.name || 'Card';
    
    try {
      await deleteCard(id);
      setDeleteConfirm(null);
      showNotification('success', `🗑️ "${cardName}" deleted successfully!`);
    } catch (err: any) {
      console.error('Error deleting card:', err);
      showNotification('error', err.message || 'Failed to delete card');
    }
  };

  const handleCancel = () => {
    setEditingCard(null);
    setFormData(initialFormData);
    setFormErrors({});
  };

  const getCardIcon = (network: CardNetwork) => {
    const icons: Record<CardNetwork, string> = {
      'Visa': '💳',
      'Mastercard': '💳',
      'American Express': '💳',
      'Discover': '💳',
      'Other': '💳',
    };
    return icons[network] || '💳';
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
          <div key="header-title">
            <h2>Credit Cards 💳</h2>
            <p className="subtitle">Manage your credit card accounts</p>
          </div>
          {!showForm && (
            <button 
              key="add-card-btn"
              className="btn-primary"
              onClick={() => setShowForm(true)}
            >
              + Add Card
            </button>
          )}
        </header>

        {/* Summary Cards */}
        <div className="metrics-grid">
          <div key="total-cards" className="metric-card">
            <div className="metric-icon">💳</div>
            <div className="metric-content">
              <h3>Total Cards</h3>
              <p className="metric-value">{cards.length}</p>
            </div>
          </div>

          <div key="total-debt" className="metric-card">
            <div className="metric-icon">💰</div>
            <div className="metric-content">
              <h3>Total Debt</h3>
              <p className="metric-value">{formatCurrency(totalDebt)}</p>
            </div>
          </div>

          <div key="total-credit" className="metric-card">
            <div className="metric-icon">💎</div>
            <div className="metric-content">
              <h3>Total Credit</h3>
              <p className="metric-value">{formatCurrency(totalLimit)}</p>
            </div>
          </div>

          <div key="avg-utilization" className="metric-card">
            <div className="metric-icon">📊</div>
            <div className="metric-content">
              <h3>Avg Utilization</h3>
              <p className="metric-value">{avgUtilization.toFixed(1)}%</p>
            </div>
          </div>
        </div>

        {/* Notification Display */}
        {notification && (
          <div key="notification" className={`notification ${notification.type}`}>
            {notification.message}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div key="error-message" className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Add/Edit Form */}
        {showForm && (
          <div key="card-form" className="card-form-container">
            <div className="card-form">
              <h3>{editingCard ? 'Edit Card' : 'Add New Card'}</h3>
              
              <form onSubmit={handleSubmit}>
                {/* Immutable fields - only show during creation */}
                {!editingCard && (
                  <>
                    <div key="form-row-1" className="form-row">
                      <div className="form-group">
                        <label htmlFor="cardName">Card Name *</label>
                        <input
                          id="cardName"
                          type="text"
                          value={formData.cardName}
                          onChange={(e) => setFormData({ ...formData, cardName: e.target.value })}
                          placeholder="e.g., Chase Sapphire Preferred"
                          className={formErrors.cardName ? 'error' : ''}
                        />
                        {formErrors.cardName && <span className="error-text">{formErrors.cardName}</span>}
                      </div>

                      <div className="form-group">
                        <label htmlFor="network">Card Network *</label>
                        <select
                          id="network"
                          value={formData.network}
                          onChange={(e) => setFormData({ ...formData, network: e.target.value as CardNetwork })}
                        >
                          <option key="visa" value="Visa">Visa</option>
                          <option key="mastercard" value="Mastercard">Mastercard</option>
                          <option key="amex" value="American Express">American Express</option>
                          <option key="discover" value="Discover">Discover</option>
                          <option key="other" value="Other">Other</option>
                        </select>
                      </div>
                    </div>

                    <div key="form-row-2" className="form-row">
                      <div className="form-group">
                        <label htmlFor="lastFourDigits">Last 4 Digits *</label>
                        <input
                          id="lastFourDigits"
                          type="text"
                          value={formData.lastFourDigits}
                          onChange={(e) => setFormData({ ...formData, lastFourDigits: e.target.value })}
                          placeholder="4532"
                          maxLength={4}
                          className={formErrors.lastFourDigits ? 'error' : ''}
                        />
                        {formErrors.lastFourDigits && <span className="error-text">{formErrors.lastFourDigits}</span>}
                        <small className="help-text">🔒 We never store full card numbers (PCI DSS compliance)</small>
                      </div>
                    </div>
                  </>
                )}

                {/* Read-only display of immutable fields during edit */}
                {editingCard && (
                  <div className="immutable-fields-display">
                    <h4>Card Information (cannot be changed)</h4>
                    <div className="info-row">
                      <span className="info-label">Card Name:</span>
                      <span className="info-value">{formData.cardName}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Network:</span>
                      <span className="info-value">{formData.network}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Last 4 Digits:</span>
                      <span className="info-value">****{formData.lastFourDigits}</span>
                    </div>
                  </div>
                )}

                {/* Mutable fields - always editable */}
                <div key="form-row-balance" className="form-row">
                  <div className="form-group">
                    <label htmlFor="balance">Current Balance *</label>
                    <input
                      id="balance"
                      type="number"
                      step="0.01"
                      value={formData.balance}
                      onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                      placeholder="0.00"
                      className={formErrors.balance ? 'error' : ''}
                    />
                    {formErrors.balance && <span className="error-text">{formErrors.balance}</span>}
                  </div>
                </div>

                <div key="form-row-3" className="form-row">
                  <div className="form-group">
                    <label htmlFor="creditLimit">Credit Limit *</label>
                    <input
                      id="creditLimit"
                      type="number"
                      step="0.01"
                      value={formData.creditLimit}
                      onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                      placeholder="5000.00"
                      className={formErrors.creditLimit ? 'error' : ''}
                    />
                    {formErrors.creditLimit && <span className="error-text">{formErrors.creditLimit}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="interestRate">Interest Rate (APR %) *</label>
                    <input
                      id="interestRate"
                      type="number"
                      step="0.01"
                      value={formData.interestRate}
                      onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                      placeholder="19.99"
                      className={formErrors.interestRate ? 'error' : ''}
                    />
                    {formErrors.interestRate && <span className="error-text">{formErrors.interestRate}</span>}
                    <small className="help-text">Enter as percentage (e.g., 19.99 for 19.99%)</small>
                  </div>
                </div>

                <div key="form-row-4" className="form-row">
                  <div className="form-group">
                    <label htmlFor="minimumPayment">Minimum Payment *</label>
                    <input
                      id="minimumPayment"
                      type="number"
                      step="0.01"
                      value={formData.minimumPayment}
                      onChange={(e) => setFormData({ ...formData, minimumPayment: e.target.value })}
                      placeholder="25.00"
                      className={formErrors.minimumPayment ? 'error' : ''}
                    />
                    {formErrors.minimumPayment && <span className="error-text">{formErrors.minimumPayment}</span>}
                  </div>

                  <div className="form-group">
                    <label htmlFor="dueDate">Payment Due Date (Day of Month) *</label>
                    <input
                      id="dueDate"
                      type="number"
                      min="1"
                      max="28"
                      value={formData.dueDate}
                      onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                      placeholder="15"
                      className={formErrors.dueDate ? 'error' : ''}
                    />
                    <small className="help-text">Day of month when payment is due (1-28)</small>
                    {formErrors.dueDate && <span className="error-text">{formErrors.dueDate}</span>}
                  </div>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleCancel}
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={submitting}
                  >
                    {submitting ? 'Saving...' : editingCard ? 'Update Card' : 'Add Card'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Editing Card - Dedicated Top Section */}
        {editingCard && (
          <div key="editing-card-section" id="editing-card-container" className="editing-card-section">
            <h3>✏️ Editing Card</h3>
            <div className="editing-card-wrapper">
              {(() => {
                const card = editingCard;
                const utilization = calculateUtilization(card.balance, card.limit);
                const utilizationClass = utilization > 30 ? 'high' : utilization > 10 ? 'medium' : 'low';

                return (
                  <div className="credit-card editing-top">
                    <div className="card-header">
                      <div className="card-title">
                        <h4>
                          <span className="card-icon">💳</span>
                          {card.name}
                        </h4>
                        <span className="card-network">{card.network} ****{card.lastFourDigits}</span>
                      </div>
                    </div>

                    {/* Edit form */}
                    <form onSubmit={handleSubmit} className="inline-edit-form">
                      {/* Immutable fields display */}
                      <div className="immutable-fields-display">
                        <h4>Card Information (cannot be changed)</h4>
                        <div className="info-row">
                          <span className="info-label">Card Name:</span>
                          <span className="info-value">{formData.cardName}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Network:</span>
                          <span className="info-value">{formData.network}</span>
                        </div>
                        <div className="info-row">
                          <span className="info-label">Last 4 Digits:</span>
                          <span className="info-value">****{formData.lastFourDigits}</span>
                        </div>
                      </div>

                      {/* Editable fields */}
                      <div className="form-group">
                        <label htmlFor="edit-balance">Current Balance ($)</label>
                        <input
                          id="edit-balance"
                          name="balance"
                          type="text"
                          value={formData.balance}
                          onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                          placeholder="0.00"
                          className={formErrors.balance ? 'error' : ''}
                        />
                        {formErrors.balance && <span className="error-message">{formErrors.balance}</span>}
                      </div>

                      <div className="form-group">
                        <label htmlFor="edit-creditLimit">Credit Limit ($)</label>
                        <input
                          id="edit-creditLimit"
                          name="creditLimit"
                          type="text"
                          value={formData.creditLimit}
                          onChange={(e) => setFormData({ ...formData, creditLimit: e.target.value })}
                          placeholder="0.00"
                          className={formErrors.creditLimit ? 'error' : ''}
                        />
                        {formErrors.creditLimit && <span className="error-message">{formErrors.creditLimit}</span>}
                      </div>

                      <div className="form-group">
                        <label htmlFor="edit-interestRate">Interest Rate (APR %)</label>
                        <input
                          id="edit-interestRate"
                          name="interestRate"
                          type="text"
                          value={formData.interestRate}
                          onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                          placeholder="19.99"
                          className={formErrors.interestRate ? 'error' : ''}
                        />
                        {formErrors.interestRate && <span className="error-message">{formErrors.interestRate}</span>}
                      </div>

                      <div className="form-group">
                        <label htmlFor="edit-minimumPayment">Minimum Payment ($)</label>
                        <input
                          id="edit-minimumPayment"
                          name="minimumPayment"
                          type="text"
                          value={formData.minimumPayment}
                          onChange={(e) => setFormData({ ...formData, minimumPayment: e.target.value })}
                          placeholder="25.00"
                          className={formErrors.minimumPayment ? 'error' : ''}
                        />
                        {formErrors.minimumPayment && <span className="error-message">{formErrors.minimumPayment}</span>}
                      </div>

                      <div className="form-group">
                        <label htmlFor="edit-dueDate">Payment Due (Day of Month)</label>
                        <input
                          id="edit-dueDate"
                          name="dueDate"
                          type="text"
                          value={formData.dueDate}
                          onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                          placeholder="15"
                          className={formErrors.dueDate ? 'error' : ''}
                        />
                        {formErrors.dueDate && <span className="error-message">{formErrors.dueDate}</span>}
                      </div>

                      <div className="form-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={handleCancel}
                          disabled={submitting}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={submitting}
                        >
                          {submitting ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    </form>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Cards List */}
        <div key="cards-section" className="section">
          <h3>Your Cards ({cards.length})</h3>

          {loading ? (
            <div className="loading">Loading cards...</div>
          ) : cards.length === 0 ? (
            <div className="empty-state">
              <p>💳 No credit cards yet</p>
              <p className="subtitle">Add your first card to get started with debt optimization</p>
              {!showForm && (
                <button 
                  className="btn-primary"
                  onClick={() => setShowForm(true)}
                >
                  + Add Your First Card
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="cards-grid">
                {(showAllCards ? cards : cards.slice(0, 6))
                  .filter(card => editingCard?.id !== card.id) // Hide card being edited
                  .map((card) => {
                  const utilization = calculateUtilization(card.balance, card.limit);
                  const utilizationClass = utilization > 30 ? 'high' : utilization > 10 ? 'medium' : 'low';
                  const isRecentlyEdited = recentlyEditedCard === card.id;

                return (
                  <div 
                    key={card.id} 
                    id={`card-${card.id}`}
                    className={`credit-card ${isRecentlyEdited ? 'recently-edited' : ''}`}
                  >
                    <div className="card-header">
                      <div className="card-title">
                        <h4>
                          <span className="card-icon">💳</span>
                          {card.name}
                        </h4>
                        <span className="card-network">{card.network} ****{card.lastFourDigits}</span>
                      </div>
                      <div className="card-actions">
                        <button
                          className="btn-icon"
                          onClick={() => handleEdit(card)}
                          title="Edit card"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => setDeleteConfirm(card.id)}
                          title="Delete card"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>

                    {/* Normal card view */}
                    <div className="card-details">
                            {/* NEW: Consolidated Key Metrics Grid */}
                            <div className="key-metrics-grid">
                                <div className="metric-item">
                                    <span className="metric-label">Balance</span>
                                    <span className="metric-value-large">{formatCurrency(card.balance)}</span>
                                </div>
                                <div className="metric-item">
                                    <span className="metric-label">Credit Limit</span>
                                    <span className="metric-value-large">{formatCurrency(card.limit)}</span>
                                </div>
                                <div className="metric-item">
                                    <span className="metric-label">APR</span>
                                    <span className="metric-value-large">{formatPercent(card.apr)}</span>
                                </div>
                            </div>
                            
                            {/* Remaining Details (Min Payment and Due Date) */}
                            <div className="detail-row">
                                <span className="label">Min Payment:</span>
                                <span className="value">{formatCurrency(card.minPayment)}</span>
                            </div>
                            <div className="detail-row">
                                <span className="label">Due Date:</span>
                                <span className="value">Day {card.dueDayOfMonth}</span>
                            </div>
                        </div>

                    <div className="card-footer">
                      <div className={`utilization ${utilizationClass}`}>
                        <span className="label">Utilization:</span>
                        <span className="value">{utilization.toFixed(1)}%</span>
                      </div>
                      <div className="utilization-bar">
                        <div 
                          className={`utilization-fill ${utilizationClass}`}
                          style={{ width: `${Math.min(utilization, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* Delete Confirmation */}
                    {deleteConfirm === card.id && (
                      <div className="delete-confirm">
                        <p>⚠️ Delete this card?</p>
                        <div className="confirm-actions">
                          <button
                            className="btn-secondary"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn-danger"
                            onClick={() => handleDelete(card.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
              
              {/* Show toggle button only if there are more than 6 cards */}
              {cards.length > 6 && (
                <div className="view-all-container">
                  <button
                    className="btn-secondary"
                    onClick={() => setShowAllCards(!showAllCards)}
                  >
                    {showAllCards ? '← Show Less' : `View All ${cards.length} Cards →`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
