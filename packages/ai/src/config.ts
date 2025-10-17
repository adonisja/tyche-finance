export type AIProvider = 'anthropic' | 'openai' | 'bedrock' | 'xai' | 'deepseek';

export interface ModelConfig {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  baseURL?: string; // For custom endpoints (DeepSeek, self-hosted)
}

// Provider-specific model options
export const MODELS = {
  anthropic: {
    sonnet: 'claude-3-5-sonnet-20241022',
    sonnetLatest: 'claude-3-5-sonnet-latest',
    opus: 'claude-3-opus-20240229',
    haiku: 'claude-3-haiku-20240307',
  },
  openai: {
    gpt4Turbo: 'gpt-4-turbo-preview',
    gpt4: 'gpt-4',
    gpt35Turbo: 'gpt-3.5-turbo',
  },
  xai: {
    grok: 'grok-beta', // xAI's Grok model
  },
  deepseek: {
    chat: 'deepseek-chat', // DeepSeek's main model
    coder: 'deepseek-coder', // Specialized for code
  },
  bedrock: {
    claudeSonnet: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
    claudeOpus: 'anthropic.claude-3-opus-20240229-v1:0',
    claudeHaiku: 'anthropic.claude-3-haiku-20240307-v1:0',
  },
} as const;

// Default: Claude Sonnet (best for financial reasoning and precision)
const DEFAULT_PROVIDER: AIProvider = 'anthropic';
const DEFAULT_MODEL = MODELS.anthropic.sonnetLatest;

/**
 * Get AI model configuration from environment variables
 * 
 * Environment variables:
 * - AI_PROVIDER: anthropic | openai | bedrock | xai | deepseek
 * - AI_MODEL: Specific model name (see MODELS constant)
 * - ANTHROPIC_API_KEY: For Anthropic direct
 * - OPENAI_API_KEY: For OpenAI
 * - XAI_API_KEY: For xAI Grok
 * - DEEPSEEK_API_KEY: For DeepSeek
 * - AWS credentials: For Bedrock (via AWS SDK)
 */
export function getModelConfig(): ModelConfig {
  const provider = (process.env.AI_PROVIDER as AIProvider) || DEFAULT_PROVIDER;
  const model = process.env.AI_MODEL || DEFAULT_MODEL;

  const config: ModelConfig = { provider, model };

  // Add provider-specific settings
  switch (provider) {
    case 'anthropic':
      config.apiKey = process.env.ANTHROPIC_API_KEY;
      break;
    case 'openai':
      config.apiKey = process.env.OPENAI_API_KEY;
      break;
    case 'xai':
      config.apiKey = process.env.XAI_API_KEY;
      config.baseURL = 'https://api.x.ai/v1'; // xAI API endpoint
      break;
    case 'deepseek':
      config.apiKey = process.env.DEEPSEEK_API_KEY;
      config.baseURL = 'https://api.deepseek.com/v1'; // DeepSeek API endpoint
      break;
    case 'bedrock':
      // Bedrock uses AWS credentials, no API key needed
      config.model = model || MODELS.bedrock.claudeSonnet;
      break;
  }

  return config;
}

export function isClaudeEnabled(): boolean {
  const cfg = getModelConfig();
  return cfg.provider === 'anthropic' || cfg.provider === 'bedrock';
}

export const aiConfigHelp = `
AI Configuration - Multi-Model Support
=====================================

Default: Claude 3.5 Sonnet (Anthropic)

Supported Providers:
-------------------
1. Anthropic (Direct)
   - Models: Sonnet, Opus, Haiku
   - Set: AI_PROVIDER=anthropic
   - Key: ANTHROPIC_API_KEY=sk-ant-...

2. OpenAI
   - Models: GPT-4 Turbo, GPT-4, GPT-3.5 Turbo
   - Set: AI_PROVIDER=openai AI_MODEL=gpt-4-turbo-preview
   - Key: OPENAI_API_KEY=sk-...

3. xAI (Grok)
   - Models: Grok Beta
   - Set: AI_PROVIDER=xai AI_MODEL=grok-beta
   - Key: XAI_API_KEY=xai-...

4. DeepSeek
   - Models: DeepSeek Chat, DeepSeek Coder
   - Set: AI_PROVIDER=deepseek AI_MODEL=deepseek-chat
   - Key: DEEPSEEK_API_KEY=sk-...

5. AWS Bedrock
   - Models: Claude via Bedrock
   - Set: AI_PROVIDER=bedrock
   - Auth: AWS credentials (IAM role or env vars)

Example Usage:
-------------
# Use Claude (default)
export ANTHROPIC_API_KEY=sk-ant-...

# Use GPT-4
export AI_PROVIDER=openai
export AI_MODEL=gpt-4-turbo-preview
export OPENAI_API_KEY=sk-...

# Use Grok
export AI_PROVIDER=xai
export XAI_API_KEY=xai-...

# Use DeepSeek
export AI_PROVIDER=deepseek
export DEEPSEEK_API_KEY=sk-...

Model Selection Guide:
--------------------
- Claude Sonnet: Best for financial reasoning, math, precision ✅ (Default)
- GPT-4: Fast, conversational, great general-purpose
- Grok: Real-time data access, casual tone
- DeepSeek: Cost-effective, good for code generation
`;

