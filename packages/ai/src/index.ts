import { PayoffStrategyInput } from "@tyche/types";
import { simulatePayoff } from "@tyche/core";
import { getModelConfig } from './config';
import { createAIProvider } from './factory';
import type { AIProvider, Tool } from './provider';

// Re-export types and utilities
export { getModelConfig, MODELS, aiConfigHelp } from './config';
export { createAIProvider } from './factory';
export type { AIProvider, ChatOptions, ChatResponse, Tool, ToolCall, ToolParameter } from './provider';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentContext {
  userId: string;
  provider?: AIProvider; // Optional: pass custom provider instance
}

export interface AgentTools {
  simulatePayoff: (input: PayoffStrategyInput, strategy: 'avalanche' | 'snowball') => ReturnType<typeof simulatePayoff>;
  getModel: () => { provider: string; model: string };
  chat: (messages: ChatMessage[]) => Promise<string>;
  chatWithTools: (messages: ChatMessage[], tools: Tool[]) => Promise<any>;
}

/**
 * Create an AI agent with financial tools
 * 
 * Usage:
 * ```ts
 * const agent = createAgent({ userId: '123' });
 * const response = await agent.chat([
 *   { role: 'user', content: 'How should I pay off my credit cards?' }
 * ]);
 * ```
 */
export function createAgent(ctx: AgentContext): AgentTools {
  // Use provided provider or create one from environment
  const provider = ctx.provider || createAIProvider();

  return {
    simulatePayoff: (input, strategy) => simulatePayoff(input, { strategy }),
    
    getModel: () => {
      const config = getModelConfig();
      return { 
        provider: config.provider, 
        model: config.model 
      };
    },
    
    chat: async (messages) => {
      return provider.chat(messages, {
        systemPrompt: 'You are a helpful financial assistant for Tyche, a budgeting and credit card optimization app. Provide clear, actionable advice.',
      });
    },
    
    chatWithTools: async (messages, tools) => {
      return provider.chatWithTools(messages, tools, {
        systemPrompt: 'You are a helpful financial assistant for Tyche. Use the provided tools to help users with budgeting, debt payoff, and financial planning.',
      });
    },
  };
}
