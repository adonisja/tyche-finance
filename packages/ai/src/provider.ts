import { ChatMessage } from './index';

/**
 * Universal AI Provider Interface
 * All providers must implement this interface for consistent usage
 */
export interface AIProvider {
  /**
   * Send a chat completion request
   * @param messages - Conversation history
   * @param options - Optional parameters (temperature, max_tokens, etc.)
   * @returns AI response text
   */
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;

  /**
   * Chat with function/tool calling support
   * @param messages - Conversation history
   * @param tools - Available tools the AI can call
   * @param options - Optional parameters
   * @returns AI response with optional tool calls
   */
  chatWithTools(
    messages: ChatMessage[],
    tools: Tool[],
    options?: ChatOptions
  ): Promise<ChatResponse>;

  /**
   * Get the model identifier
   */
  getModel(): string;

  /**
   * Get the provider name
   */
  getProvider(): string;
}

export interface ChatOptions {
  temperature?: number; // 0-1, higher = more creative
  maxTokens?: number; // Max response length
  stopSequences?: string[]; // Stop generation at these strings
  systemPrompt?: string; // Override default system prompt
}

export interface Tool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  enum?: string[]; // For string enums
  items?: ToolParameter; // For arrays
  properties?: Record<string, ToolParameter>; // For objects
  required?: string[]; // Required properties for objects
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ChatResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
}
