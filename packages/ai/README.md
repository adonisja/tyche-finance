# @tyche/ai - Multi-Model AI Provider

Universal AI provider layer supporting Claude, GPT-4, Grok, DeepSeek, and Bedrock.

## Quick Start

```typescript
import { createAgent } from '@tyche/ai';

// Create agent (uses environment config)
const agent = createAgent({ userId: 'user123' });

// Simple chat
const response = await agent.chat([
  { role: 'user', content: 'Should I use avalanche or snowball method?' }
]);

// Chat with tool calling
const tools = [
  {
    name: 'simulate_payoff',
    description: 'Simulate credit card debt payoff strategies',
    parameters: {
      type: 'object',
      properties: {
        cards: { type: 'array', description: 'Credit card details' },
        strategy: { type: 'string', enum: ['avalanche', 'snowball'] }
      },
      required: ['cards', 'strategy']
    }
  }
];

const result = await agent.chatWithTools([
  { role: 'user', content: 'What's the best way to pay off my cards?' }
], tools);
```

## Supported Providers

### 1. Anthropic Claude (Default)

**Best for**: Financial reasoning, mathematical precision, long context

```bash
export AI_PROVIDER=anthropic
export AI_MODEL=claude-3-5-sonnet-latest
export ANTHROPIC_API_KEY=sk-ant-...
```

**Models**:
- `claude-3-5-sonnet-latest` - Latest Sonnet (recommended)
- `claude-3-5-sonnet-20241022` - Pinned version
- `claude-3-opus-20240229` - Most capable, slower
- `claude-3-haiku-20240307` - Fastest, cheapest

### 2. OpenAI GPT

**Best for**: Speed, conversational responses

```bash
export AI_PROVIDER=openai
export AI_MODEL=gpt-4-turbo-preview
export OPENAI_API_KEY=sk-...
```

**Models**:
- `gpt-4-turbo-preview` - Latest GPT-4
- `gpt-4` - Stable GPT-4
- `gpt-3.5-turbo` - Fastest, cheapest

### 3. xAI Grok

**Best for**: Real-time data, casual tone

```bash
export AI_PROVIDER=xai
export AI_MODEL=grok-beta
export XAI_API_KEY=xai-...
```

### 4. DeepSeek

**Best for**: Cost-effectiveness, code generation

```bash
export AI_PROVIDER=deepseek
export AI_MODEL=deepseek-chat
export DEEPSEEK_API_KEY=sk-...
```

**Models**:
- `deepseek-chat` - General conversation
- `deepseek-coder` - Code-specialized

### 5. AWS Bedrock

**Best for**: Enterprise AWS integration, compliance

```bash
export AI_PROVIDER=bedrock
export AI_MODEL=anthropic.claude-3-5-sonnet-20241022-v2:0
# Uses AWS credentials (no API key needed)
```

## Testing Different Models

Create a comparison script:

```typescript
// test-models.ts
import { createAgent } from '@tyche/ai';
import { AnthropicProvider } from '@tyche/ai/providers/anthropic';
import { OpenAIProvider } from '@tyche/ai/providers/openai';

const question = 'I have $5000 at 19.99% APR and $1500 at 24.99% APR. What should I do?';

// Test Claude
const claudeAgent = createAgent({
  userId: 'test',
  provider: new AnthropicProvider(process.env.ANTHROPIC_API_KEY!, 'claude-3-5-sonnet-latest')
});
console.log('Claude:', await claudeAgent.chat([{ role: 'user', content: question }]));

// Test GPT-4
const gptAgent = createAgent({
  userId: 'test',
  provider: new OpenAIProvider(process.env.OPENAI_API_KEY!, 'gpt-4-turbo-preview')
});
console.log('GPT-4:', await gptAgent.chat([{ role: 'user', content: question }]));
```

## Cost Comparison (as of Oct 2025)

| Provider | Input ($/1M tokens) | Output ($/1M tokens) | Best Use Case |
|----------|---------------------|----------------------|---------------|
| Claude Sonnet | $3 | $15 | Financial reasoning ✅ |
| GPT-4 Turbo | $10 | $30 | Speed, general purpose |
| GPT-3.5 Turbo | $0.50 | $1.50 | Simple tasks, high volume |
| Grok | ~$5 | ~$15 | Real-time data |
| DeepSeek | $0.14 | $0.28 | Budget-conscious 💰 |

## Architecture

```
┌─────────────────┐
│  Application    │
│  (Web/Mobile)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  createAgent()  │
│  (Factory)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  AIProvider     │  ◄── Universal Interface
│  Interface      │
└────────┬────────┘
         │
    ┌────┴────────────────────┐
    │                         │
    ▼                         ▼
┌──────────┐            ┌──────────┐
│ Claude   │            │  GPT-4   │
│ Provider │            │ Provider │
└──────────┘            └──────────┘
    │                         │
    ▼                         ▼
┌──────────┐            ┌──────────┐
│Anthropic │            │  OpenAI  │
│   API    │            │   API    │
└──────────┘            └──────────┘
```

## Environment Variables

```bash
# Provider selection
AI_PROVIDER=anthropic  # anthropic | openai | xai | deepseek | bedrock

# Model selection (provider-specific)
AI_MODEL=claude-3-5-sonnet-latest

# API Keys (only needed for your chosen provider)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
XAI_API_KEY=xai-...
DEEPSEEK_API_KEY=sk-...

# AWS Bedrock (uses AWS SDK credentials)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

## Recommendation for Tyche

**Start with Claude Sonnet** because:
- ✅ Best at mathematical reasoning (debt calculations)
- ✅ Most precise with dollar amounts
- ✅ 200K context window (analyze full financial history)
- ✅ Cost-effective for production
- ✅ Excellent tool calling (agent workflows)

**Test with**:
- GPT-4 for speed comparison
- DeepSeek for cost savings at scale
- Grok if you need real-time financial data

## Next Steps

1. Set environment variables for your preferred provider
2. Test basic chat: `npm run test --workspace=@tyche/ai`
3. Integrate into Lambda functions (see `services/api`)
4. Add financial-specific tools (debt payoff, spending analysis)
5. Monitor costs and quality across providers
