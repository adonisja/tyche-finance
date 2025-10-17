import type {
  AIProvider,
  ChatOptions,
  ChatResponse,
  Tool,
  ToolCall,
} from '../provider';
import type { ChatMessage } from '../index';

/**
 * Anthropic Claude Provider
 * 
 * Supports: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
 * Best for: Financial reasoning, mathematical precision, long context
 */
export class AnthropicProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private baseURL: string = 'https://api.anthropic.com/v1';

  constructor(apiKey: string, model: string) {
    if (!apiKey) {
      throw new Error('Anthropic API key is required. Set ANTHROPIC_API_KEY environment variable.');
    }
    this.apiKey = apiKey;
    this.model = model;
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<string> {
    const response = await this.makeRequest(messages, [], options);
    return response.content;
  }

  async chatWithTools(
    messages: ChatMessage[],
    tools: Tool[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    return this.makeRequest(messages, tools, options);
  }

  getModel(): string {
    return this.model;
  }

  getProvider(): string {
    return 'anthropic';
  }

  private async makeRequest(
    messages: ChatMessage[],
    tools: Tool[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    // Convert our message format to Anthropic's format
    const anthropicMessages = messages
      .filter(m => m.role !== 'system') // System messages handled separately
      .map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    // Extract system message if present
    const systemMessage = messages.find(m => m.role === 'system')?.content 
      || options?.systemPrompt 
      || 'You are a helpful financial assistant for Tyche, a budgeting and credit card optimization app.';

    const requestBody: any = {
      model: this.model,
      max_tokens: options?.maxTokens || 4096,
      temperature: options?.temperature ?? 0.7,
      system: systemMessage,
      messages: anthropicMessages,
    };

    // Add tools if provided (Anthropic's native function calling)
    if (tools.length > 0) {
      requestBody.tools = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters,
      }));
    }

    if (options?.stopSequences) {
      requestBody.stop_sequences = options.stopSequences;
    }

    // Make API request
    const response = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${error}`);
    }

    const data = await response.json();

    // Parse response
    const content = data.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');

    const toolCalls: ToolCall[] = data.content
      .filter((block: any) => block.type === 'tool_use')
      .map((block: any) => ({
        id: block.id,
        name: block.name,
        arguments: block.input,
      }));

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason: this.mapStopReason(data.stop_reason),
    };
  }

  private mapStopReason(reason: string): ChatResponse['finishReason'] {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'tool_use':
        return 'tool_calls';
      case 'stop_sequence':
        return 'stop';
      default:
        return 'stop';
    }
  }
}
