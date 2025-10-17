import type {
  AIProvider,
  ChatOptions,
  ChatResponse,
  Tool,
  ToolCall,
} from '../provider';
import type { ChatMessage } from '../index';

/**
 * DeepSeek Provider
 * 
 * Supports: DeepSeek Chat, DeepSeek Coder
 * Best for: Cost-effectiveness, code generation, reasoning
 * Note: DeepSeek API is OpenAI-compatible
 */
export class DeepSeekProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private baseURL: string = 'https://api.deepseek.com/v1';

  constructor(apiKey: string, model: string, baseURL?: string) {
    if (!apiKey) {
      throw new Error('DeepSeek API key is required. Set DEEPSEEK_API_KEY environment variable.');
    }
    this.apiKey = apiKey;
    this.model = model;
    if (baseURL) this.baseURL = baseURL;
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
    return 'deepseek';
  }

  private async makeRequest(
    messages: ChatMessage[],
    tools: Tool[],
    options?: ChatOptions
  ): Promise<ChatResponse> {
    // DeepSeek uses OpenAI-compatible format
    const requestBody: any = {
      model: this.model,
      messages: messages,
      temperature: options?.temperature ?? 0.7,
      max_tokens: options?.maxTokens,
    };

    // Add tools if provided
    if (tools.length > 0) {
      requestBody.tools = tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }));
    }

    if (options?.stopSequences) {
      requestBody.stop = options.stopSequences;
    }

    // Make API request
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error (${response.status}): ${error}`);
    }

    const data = await response.json();
    const choice = data.choices[0];

    // Extract content and tool calls
    const content = choice.message.content || '';
    const toolCalls: ToolCall[] | undefined = choice.message.tool_calls?.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }));

    return {
      content,
      toolCalls,
      finishReason: this.mapFinishReason(choice.finish_reason),
    };
  }

  private mapFinishReason(reason: string): ChatResponse['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'tool_calls':
      case 'function_call':
        return 'tool_calls';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'stop';
    }
  }
}
