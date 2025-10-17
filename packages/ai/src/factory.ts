import { getModelConfig } from './config';
import type { AIProvider } from './provider';
import { AnthropicProvider } from './providers/anthropic';
import { OpenAIProvider } from './providers/openai';
import { XAIProvider } from './providers/xai';
import { DeepSeekProvider } from './providers/deepseek';

/**
 * Create an AI provider instance based on environment configuration
 * 
 * Reads AI_PROVIDER and AI_MODEL from environment and returns
 * the appropriate provider implementation.
 * 
 * @throws Error if API key is missing for the selected provider
 * @returns Configured AI provider instance
 */
export function createAIProvider(): AIProvider {
  const config = getModelConfig();

  switch (config.provider) {
    case 'anthropic':
      if (!config.apiKey) {
        throw new Error(
          'ANTHROPIC_API_KEY environment variable is required when using Anthropic provider'
        );
      }
      return new AnthropicProvider(config.apiKey, config.model);

    case 'openai':
      if (!config.apiKey) {
        throw new Error(
          'OPENAI_API_KEY environment variable is required when using OpenAI provider'
        );
      }
      return new OpenAIProvider(config.apiKey, config.model);

    case 'xai':
      if (!config.apiKey) {
        throw new Error(
          'XAI_API_KEY environment variable is required when using xAI provider'
        );
      }
      return new XAIProvider(config.apiKey, config.model, config.baseURL);

    case 'deepseek':
      if (!config.apiKey) {
        throw new Error(
          'DEEPSEEK_API_KEY environment variable is required when using DeepSeek provider'
        );
      }
      return new DeepSeekProvider(config.apiKey, config.model, config.baseURL);

    case 'bedrock':
      // TODO: Implement Bedrock provider (uses AWS SDK instead of API key)
      throw new Error('Bedrock provider not yet implemented');

    default:
      throw new Error(`Unknown AI provider: ${config.provider}`);
  }
}
