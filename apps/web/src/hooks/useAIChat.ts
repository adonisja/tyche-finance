/**
 * useAIChat Hook
 * 
 * Manages AI-powered conversations with AgentKit.
 * Supports 6 tools: simulate_debt_payoff, get_user_context, 
 * analyze_spending_patterns, recommend_balance_transfer,
 * optimize_payment_timing, calculate_credit_impact.
 * 
 * Usage:
 *   const { messages, loading, sendMessage, clearChat } = useAIChat();
 *   await sendMessage("Show me my credit cards");
 */

import { useState, useCallback } from 'react';
import { apiClient } from '../lib/api-client';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface UseChatReturn {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  sendMessage: (message: string) => Promise<void>;
  clearChat: () => void;
}

export function useAIChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;

    try {
      setLoading(true);
      setError(null);

      // Add user message immediately
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, userMessage]);

      // Build messages array for API (include conversation history)
      const allMessages = [...messages, userMessage].map(m => ({
        role: m.role,
        content: m.content,
      }));

      // Send to backend with messages array format
      const response = await apiClient.post<{ success: boolean; data: { message: string } }>('/v1/chat', {
        messages: allMessages,
      });

      // Add AI response (response is wrapped in { success: true, data: {...} })
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.data.message,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMessage]);

    } catch (err: any) {
      console.error('[useAIChat] Error details:', err);
      console.error('[useAIChat] Response data:', err.response?.data);
      
      const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to send message';
      setError(errorMsg);
      
      // Add error message to chat
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `❌ Error: ${errorMsg}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, [messages]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    loading,
    error,
    sendMessage,
    clearChat,
  };
}
