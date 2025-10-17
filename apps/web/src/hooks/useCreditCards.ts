/**
 * useCreditCards Hook
 * 
 * Manages credit card CRUD operations.
 * 
 * Usage:
 *   const { cards, loading, error, addCard, updateCard, deleteCard, refreshCards } = useCreditCards();
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';

export interface CreditCard {
  id: string;
  userId?: string;
  name: string;                    // Backend field name
  network: string;                 // Card network (Visa, Mastercard, etc.)
  lastFourDigits: string;          // Last 4 digits for display
  issuer?: string;                 // Bank name (optional)
  balance: number;
  limit: number;                   // Backend field name (creditLimit)
  apr: number;                     // Backend field name (interestRate as decimal)
  minPayment: number;              // Backend field name (minimumPayment)
  dueDayOfMonth: number;           // Backend field name (dueDate)
  isActive?: boolean;
  currency?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface UseCreditCardsReturn {
  cards: CreditCard[];
  loading: boolean;
  error: string | null;
  addCard: (card: Omit<CreditCard, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<CreditCard>;
  updateCard: (id: string, updates: Partial<CreditCard>) => Promise<CreditCard>;
  deleteCard: (id: string) => Promise<void>;
  refreshCards: () => Promise<void>;
}

export function useCreditCards(): UseCreditCardsReturn {
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  const fetchCards = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('📥 Fetching cards...');
      const response = await apiClient.get<{ success: boolean; data: { cards: CreditCard[] } }>('/v1/cards');
      console.log('✅ Cards fetched:', response);
      setCards(response.data.cards || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch credit cards');
      console.error('❌ Error fetching cards:', err);
      // Don't throw - just set error state
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, []);

  useEffect(() => {
    // Add small delay to ensure auth is ready
    const timer = setTimeout(() => {
      fetchCards();
    }, 100);
    
    return () => clearTimeout(timer);
  }, [fetchCards]);

  const addCard = async (card: Omit<CreditCard, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<CreditCard> => {
    try {
      setError(null);
      console.log('📤 Adding card:', card);
      const response = await apiClient.post<{ success: boolean; data: { card: CreditCard } }>('/v1/cards', card);
      console.log('✅ Card added successfully:', response);
      const newCard = response.data.card;
      setCards(prev => [...prev, newCard]);
      return newCard;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to add credit card';
      console.error('❌ Error adding card:', err);
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  const updateCard = async (id: string, updates: Partial<CreditCard>): Promise<CreditCard> => {
    try {
      setError(null);
      console.log('📤 Updating card:', id, updates);
      const response = await apiClient.put<{ success: boolean; data: { card: CreditCard } }>(`/v1/cards/${id}`, updates);
      console.log('✅ Card updated successfully:', response);
      const updatedCard = response.data.card;
      setCards(prev => prev.map(card => card.id === id ? updatedCard : card));
      return updatedCard;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to update credit card';
      console.error('❌ Error updating card:', err);
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  const deleteCard = async (id: string): Promise<void> => {
    try {
      setError(null);
      console.log('📤 Deleting card:', id);
      await apiClient.delete<{ success: boolean }>(`/v1/cards/${id}`);
      console.log('✅ Card deleted successfully');
      setCards(prev => prev.filter(card => card.id !== id));
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to delete credit card';
      console.error('❌ Error deleting card:', err);
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  return {
    cards,
    loading,
    error,
    addCard,
    updateCard,
    deleteCard,
    refreshCards: fetchCards,
  };
}
