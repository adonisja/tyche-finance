/**
 * useAnalytics Hook
 * 
 * Manages progress tracking, goals, and historical snapshots.
 * 
 * Usage:
 *   const { 
 *     progress, 
 *     goals, 
 *     snapshots, 
 *     loading,
 *     createGoal,
 *     updateGoal,
 *     refreshProgress 
 *   } = useAnalytics();
 */

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '../lib/api-client';

export interface ProgressData {
  userId: string;
  totalDebt: number;
  totalMinimumPayment: number;
  totalCreditLimit: number;
  averageInterestRate: number;
  totalAvailableCredit: number;
  creditUtilization: number;
  monthlyInterestCost: number;
  projectedPayoffMonths: number;
  updatedAt: string;
}

export interface Goal {
  id: string;
  userId: string;
  goalType: 'debt_free' | 'credit_score' | 'utilization' | 'savings' | 'custom';
  targetValue: number;
  currentValue: number;
  deadline: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProgressSnapshot {
  id: string;
  userId: string;
  snapshotDate: string;
  totalDebt: number;
  creditUtilization: number;
  metadata?: {
    cardsCount: number;
    averageAPR: number;
  };
}

interface UseAnalyticsReturn {
  progress: ProgressData | null;
  goals: Goal[];
  snapshots: ProgressSnapshot[];
  loading: boolean;
  error: string | null;
  createGoal: (goal: Omit<Goal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => Promise<Goal>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<Goal>;
  deleteGoal: (id: string) => Promise<void>;
  refreshProgress: () => Promise<void>;
}

export function useAnalytics(): UseAnalyticsReturn {
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [snapshots, setSnapshots] = useState<ProgressSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProgress = useCallback(async () => {
    try {
      const data = await apiClient.get<ProgressData>('/v1/analytics/progress');
      setProgress(data);
    } catch (err: any) {
      console.error('Error fetching progress:', err);
      throw err;
    }
  }, []);

  const fetchGoals = useCallback(async () => {
    try {
      const data = await apiClient.get<{ goals: Goal[] }>('/v1/analytics/goals');
      setGoals(data.goals);
    } catch (err: any) {
      console.error('Error fetching goals:', err);
      throw err;
    }
  }, []);

  const fetchSnapshots = useCallback(async () => {
    try {
      const data = await apiClient.get<{ snapshots: ProgressSnapshot[] }>('/v1/analytics/snapshots', {
        days: 90, // Last 90 days
      });
      setSnapshots(data.snapshots);
    } catch (err: any) {
      console.error('Error fetching snapshots:', err);
      throw err;
    }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([
        fetchProgress(),
        fetchGoals(),
        fetchSnapshots(),
      ]);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  }, [fetchProgress, fetchGoals, fetchSnapshots]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const createGoal = async (goal: Omit<Goal, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Goal> => {
    try {
      setError(null);
      const newGoal = await apiClient.post<Goal>('/v1/analytics/goals', goal);
      setGoals(prev => [...prev, newGoal]);
      return newGoal;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to create goal';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  const updateGoal = async (id: string, updates: Partial<Goal>): Promise<Goal> => {
    try {
      setError(null);
      const updatedGoal = await apiClient.put<Goal>(`/v1/analytics/goals/${id}`, updates);
      setGoals(prev => prev.map(goal => goal.id === id ? updatedGoal : goal));
      return updatedGoal;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to update goal';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  const deleteGoal = async (id: string): Promise<void> => {
    try {
      setError(null);
      await apiClient.delete(`/v1/analytics/goals/${id}`);
      setGoals(prev => prev.filter(goal => goal.id !== id));
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to delete goal';
      setError(errorMsg);
      throw new Error(errorMsg);
    }
  };

  return {
    progress,
    goals,
    snapshots,
    loading,
    error,
    createGoal,
    updateGoal,
    deleteGoal,
    refreshProgress: fetchAll,
  };
}
