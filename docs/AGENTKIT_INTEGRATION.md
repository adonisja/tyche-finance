# Tyche Finance - AgentKit Integration Guide

> How AgentKit patterns are integrated into Tyche Finance for intelligent personal finance automation.

**Last Updated**: October 15, 2025  
**Version**: 0.1.0  
**Target Audience**: Developers implementing AI agent features

---

## Table of Contents

1. [What is AgentKit?](#what-is-agentkit)
2. [AgentKit in Tyche Finance](#agentkit-in-tyche-finance)
3. [Architecture Overview](#architecture-overview)
4. [Tool Definitions](#tool-definitions)
5. [Agent Execution Flow](#agent-execution-flow)
6. [Implementation Details](#implementation-details)
7. [Tool Execution Patterns](#tool-execution-patterns)
8. [Advanced Patterns](#advanced-patterns)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## What is AgentKit?

### AgentKit Conceptual Framework

**AgentKit** is an architectural pattern for building AI agents that can:
- **Reason** about user problems
- **Plan** multi-step solutions
- **Use tools** to take actions
- **Learn** from results

It's **not a library**, but a **design pattern** for agent-based systems.

### Core Concepts

```
┌─────────────────────────────────────────────────────────────┐
│                       AI Agent (LLM)                         │
│  "I need to help user optimize their debt payoff strategy"  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ Decides which tool to use
                     │
      ┌──────────────┴──────────────┐
      │                             │
┌─────▼──────┐              ┌──────▼─────────┐
│   Tool 1   │              │    Tool 2      │
│ Simulate   │              │  Get User      │
│ Payoff     │              │  Context       │
└─────┬──────┘              └──────┬─────────┘
      │                             │
      │ Returns result              │ Returns data
      │                             │
┌─────▼─────────────────────────────▼──────┐
│        Agent processes results            │
│  "Based on simulation, here's my advice"  │
└───────────────────────────────────────────┘
```

**Key Components:**

1. **Agent**: The AI model (Claude, GPT-4, etc.) that reasons and plans
2. **Tools**: Functions the agent can call (simulate_debt_payoff, get_user_context, etc.)
3. **Executor**: Orchestration layer that runs tools and feeds results back to agent
4. **Context**: User-specific data that helps agent make better decisions

---

## AgentKit in Tyche Finance

### Our Implementation Philosophy

Tyche Finance uses **AgentKit principles** without a heavy framework. We implement:

✅ **Tool calling** - AI decides which functions to run  
✅ **Context management** - Pass user's financial data to agent  
✅ **Multi-step reasoning** - Agent uses tool results to formulate advice  
✅ **Provider agnostic** - Works with Claude, GPT-4, Grok, DeepSeek  

❌ No complex agent loops (keep it simple)  
❌ No autonomous agents (human in the loop)  
❌ No state persistence (stateless Lambda functions)  

### Use Cases in Tyche

| Use Case | Tools Used | Description |
|----------|-----------|-------------|
| **Debt Payoff Planning** | `simulate_debt_payoff`, `get_user_context` | User asks "How do I pay off my credit cards fastest?", agent simulates strategies and explains results |
| **Spending Analysis** | `classify_transaction`, `get_spending_pattern` | User asks "Am I overspending on dining?", agent analyzes patterns and suggests changes |
| **Purchase Impact** | `simulate_purchase_impact`, `get_current_plan` | User asks "What if I buy a $2000 laptop?", agent shows how it affects payoff timeline |
| **Bill Negotiation** *(Future)* | `analyze_bill`, `suggest_negotiation_script` | User uploads cable bill, agent suggests how to negotiate lower rates |

---

## Architecture Overview

### Component Diagram

```
┌───────────────────────────────────────────────────────────────┐
│                     Client (Web/Mobile)                        │
│  POST /v1/chat                                                 │
│  {                                                             │
│    "messages": [{ "role": "user", "content": "..." }],        │
│    "context": {                                                │
│      "cards": [...],                                           │
│      "transactions": [...]                                     │
│    }                                                           │
│  }                                                             │
└────────────────────────┬──────────────────────────────────────┘
                         │
                         │ HTTPS
                         │
┌────────────────────────▼──────────────────────────────────────┐
│               API Gateway + Lambda (chatHandler)              │
│                                                                │
│  1. Extract userId from JWT                                   │
│  2. Create agent with user context                            │
│  3. Define available tools                                    │
│  4. Call agent.chatWithTools()                                │
└────────────────────────┬──────────────────────────────────────┘
                         │
                         │
┌────────────────────────▼──────────────────────────────────────┐
│                  @tyche/ai Package                             │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  createAgent(context: AgentContext): AgentTools         │  │
│  │  {                                                       │  │
│  │    chat: (messages) => Promise<ChatResponse>,           │  │
│  │    chatWithTools: (messages, tools) => Promise<...>,    │  │
│  │    simulatePayoff: (input) => PayoffPlanResult,         │  │
│  │    getModel: () => string                               │  │
│  │  }                                                       │  │
│  └─────────────────────────────────────────────────────────┘  │
│                         │                                      │
│                         │                                      │
│  ┌──────────────────────▼──────────────────────────────────┐  │
│  │         AI Provider (Anthropic/OpenAI/xAI/DeepSeek)    │  │
│  │                                                         │  │
│  │  - Sends tool definitions to LLM                       │  │
│  │  - LLM returns tool calls                              │  │
│  │  - Returns ChatResponse with toolCalls[]              │  │
│  └─────────────────────────────────────────────────────────┘  │
└────────────────────────┬──────────────────────────────────────┘
                         │
                         │ Returns: { content, toolCalls: [...] }
                         │
┌────────────────────────▼──────────────────────────────────────┐
│                    chatHandler (continued)                     │
│                                                                │
│  5. If toolCalls exist:                                        │
│     for each tool call:                                        │
│       - Execute tool function                                  │
│       - Collect result                                         │
│     - Send all results back to agent                           │
│     - Get final response                                       │
│                                                                │
│  6. Return final AI response to client                         │
└────────────────────────────────────────────────────────────────┘
```

### Data Flow Example

**User Query**: "I have $7000 in credit card debt across 2 cards. How can I pay it off in under 2 years?"

**Step-by-Step Flow**:

```typescript
// 1. Client sends request
POST /v1/chat
{
  "messages": [
    { "role": "user", "content": "I have $7000 in credit card debt across 2 cards. How can I pay it off in under 2 years?" }
  ],
  "context": {
    "cards": [
      { "id": "1", "name": "Chase", "balance": 5000, "apr": 0.1999, "minPayment": 100 },
      { "id": "2", "name": "Amex", "balance": 2000, "apr": 0.2499, "minPayment": 50 }
    ]
  }
}

// 2. chatHandler creates agent
const agent = createAgent({ userId, cards: context.cards });

// 3. Define tools
const tools = [
  {
    name: 'simulate_debt_payoff',
    description: 'Simulate credit card debt payoff strategies...',
    parameters: { ... }
  }
];

// 4. First AI call
const response = await agent.chatWithTools(messages, tools);

// Response from AI:
{
  content: "",
  toolCalls: [
    {
      name: "simulate_debt_payoff",
      arguments: {
        cards: [...],
        monthlyBudget: 400,
        strategy: "avalanche"
      }
    }
  ]
}

// 5. Execute tool
const result = simulatePayoff({
  cards: [...],
  monthlyBudget: 400,
  strategy: "avalanche"
});

// Result:
{
  monthsToDebtFree: 18,
  totalInterest: 1247.32,
  steps: [...]
}

// 6. Send result back to AI
messages.push({
  role: "assistant",
  content: "Calling simulate_debt_payoff tool..."
});
messages.push({
  role: "user",
  content: `Tool result: ${JSON.stringify(result)}`
});

const finalResponse = await agent.chat(messages);

// 7. Final AI response
{
  content: "Great news! With the avalanche method (paying off highest APR first), you can be debt-free in 18 months by paying $400/month. You'll pay $1,247.32 in total interest. Here's the strategy:\n\n1. Focus on your Amex card first (24.99% APR)\n2. Pay minimums on Chase ($100) and extra toward Amex\n3. Once Amex is paid off, attack Chase with full $400\n\nThis saves you $300 compared to the snowball method!"
}
```

---

## Tool Definitions

### Tool Schema Format

Tools follow the JSON Schema format recognized by AI providers:

```typescript
interface Tool {
  name: string;               // Function name (snake_case)
  description: string;        // What the tool does (helps AI decide when to use it)
  parameters: {               // JSON Schema for arguments
    type: 'object';
    properties: {
      [key: string]: {
        type: 'string' | 'number' | 'boolean' | 'array' | 'object';
        description?: string;
        enum?: string[];
      };
    };
    required?: string[];
  };
}
```

### Current Tools

#### 1. simulate_debt_payoff

**Purpose**: Calculate optimal credit card payoff strategies

```typescript
{
  name: 'simulate_debt_payoff',
  description: 'Simulate credit card debt payoff strategies (avalanche or snowball) to determine the fastest and most cost-effective way to become debt-free. Returns months to payoff and total interest paid.',
  parameters: {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        description: 'Array of credit card objects with id, name, balance, apr, minPayment'
      },
      monthlyBudget: {
        type: 'number',
        description: 'Total monthly amount available for debt payments (including minimums)'
      },
      strategy: {
        type: 'string',
        enum: ['avalanche', 'snowball'],
        description: 'Avalanche = highest APR first (saves money), Snowball = lowest balance first (psychological wins)'
      }
    },
    required: ['cards', 'monthlyBudget']
  }
}
```

**When AI Uses It**:
- User asks about debt payoff strategies
- User wants to compare avalanche vs snowball
- User asks "how long to pay off debt"
- User asks "how much interest will I pay"

**Example Tool Call**:
```json
{
  "name": "simulate_debt_payoff",
  "arguments": {
    "cards": [
      { "id": "1", "balance": 5000, "apr": 0.1999, "minPayment": 100 },
      { "id": "2", "balance": 2000, "apr": 0.2499, "minPayment": 50 }
    ],
    "monthlyBudget": 500,
    "strategy": "avalanche"
  }
}
```

#### 2. get_user_context

**Purpose**: Retrieve user's current financial snapshot

```typescript
{
  name: 'get_user_context',
  description: 'Get the user\'s current financial context including credit cards, recent transactions, income, and expenses. Use this when you need up-to-date information to provide personalized advice.',
  parameters: {
    type: 'object',
    properties: {
      includeTransactions: {
        type: 'boolean',
        description: 'Whether to include recent transaction history'
      },
      daysBack: {
        type: 'number',
        description: 'How many days of transaction history to include (default: 30)'
      }
    }
  }
}
```

**When AI Uses It**:
- User asks vague question ("help me with my finances")
- AI needs more context to answer
- User asks about spending patterns

**Example Tool Call**:
```json
{
  "name": "get_user_context",
  "arguments": {
    "includeTransactions": true,
    "daysBack": 30
  }
}
```

#### 3. classify_transaction *(Planned)*

**Purpose**: Categorize a transaction using AI

```typescript
{
  name: 'classify_transaction',
  description: 'Classify a transaction into a category (dining, groceries, entertainment, bills, etc.) and priority level (essential, nice-to-have, luxury).',
  parameters: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'Transaction description from bank statement'
      },
      amount: {
        type: 'number',
        description: 'Transaction amount'
      },
      merchant: {
        type: 'string',
        description: 'Merchant name if available'
      }
    },
    required: ['description', 'amount']
  }
}
```

#### 4. simulate_purchase_impact *(Planned)*

**Purpose**: Show how a planned purchase affects debt payoff

```typescript
{
  name: 'simulate_purchase_impact',
  description: 'Simulate the impact of a planned purchase on the user\'s debt payoff timeline. Shows how much longer it will take to become debt-free and how much more interest they\'ll pay.',
  parameters: {
    type: 'object',
    properties: {
      amount: {
        type: 'number',
        description: 'Purchase amount'
      },
      cardId: {
        type: 'string',
        description: 'Which card to charge it to'
      },
      description: {
        type: 'string',
        description: 'What they\'re buying'
      }
    },
    required: ['amount', 'cardId']
  }
}
```

---

## Agent Execution Flow

### Single-Tool Execution

```typescript
// services/api/src/handlers/chat.ts
export async function chatHandler(
  event: APIGatewayProxyEvent,
  userId?: string
): Promise<APIGatewayProxyResult> {
  if (!userId) return badRequest('User ID required');
  
  const { messages, context } = parseBody(event);
  
  // Create agent with user context
  const agent = createAgent({
    userId,
    cards: context?.cards || [],
    transactions: context?.transactions || []
  });
  
  // Define available tools
  const tools: Tool[] = [
    {
      name: 'simulate_debt_payoff',
      description: '...',
      parameters: { ... }
    }
  ];
  
  // Add system message
  const systemMessage: Message = {
    role: 'system',
    content: `You are a personal finance advisor helping users optimize their credit card debt payoff strategies. Be concise, actionable, and empathetic.`
  };
  
  const messagesWithSystem = [systemMessage, ...messages];
  
  // First AI call (may return tool calls)
  let response = await agent.chatWithTools(messagesWithSystem, tools);
  
  console.log(`AI Model: ${agent.getModel()}`);
  console.log(`Response finish reason: ${response.finishReason}`);
  
  // If AI wants to use tools
  if (response.toolCalls && response.toolCalls.length > 0) {
    // Execute each tool
    for (const toolCall of response.toolCalls) {
      console.log(`Executing tool: ${toolCall.name}`, toolCall.arguments);
      
      let toolResult: any;
      
      // Route to appropriate tool implementation
      if (toolCall.name === 'simulate_debt_payoff') {
        toolResult = agent.simulatePayoff(toolCall.arguments);
      } else if (toolCall.name === 'get_user_context') {
        toolResult = {
          cards: context?.cards || [],
          transactions: context?.transactions || []
        };
      } else {
        toolResult = { error: `Unknown tool: ${toolCall.name}` };
      }
      
      // Add tool execution to conversation
      messagesWithSystem.push({
        role: 'assistant',
        content: `Calling tool: ${toolCall.name}`
      });
      messagesWithSystem.push({
        role: 'user',
        content: `Tool result: ${JSON.stringify(toolResult)}`
      });
    }
    
    // Get final response with tool results
    response = await agent.chat(messagesWithSystem);
  }
  
  return ok({
    message: response.content,
    toolsUsed: response.toolCalls?.map(tc => tc.name) || [],
    usage: response.usage
  });
}
```

### Multi-Tool Execution (Sequential)

For complex queries, AI may call multiple tools:

```typescript
// User: "Compare my credit card strategies and tell me my spending patterns"

// AI decides to call two tools:
1. simulate_debt_payoff (to get optimal strategy)
2. get_user_context (to analyze spending)

// Execution:
for (const toolCall of response.toolCalls) {
  const result = await executetool(toolCall);
  messagesWithSystem.push({
    role: 'user',
    content: `Tool ${toolCall.name} result: ${JSON.stringify(result)}`
  });
}

// AI synthesizes both results:
"Based on your $7000 debt, the avalanche method will save you $300 in interest. 
Looking at your spending, you're spending $800/month on dining out. 
If you reduce that by $200, you can pay off debt 3 months faster!"
```

### Error Handling in Tool Execution

```typescript
try {
  if (toolCall.name === 'simulate_debt_payoff') {
    // Validate input
    if (!toolCall.arguments.cards || toolCall.arguments.cards.length === 0) {
      throw new Error('No credit cards provided');
    }
    
    if (toolCall.arguments.monthlyBudget <= 0) {
      throw new Error('Monthly budget must be positive');
    }
    
    toolResult = agent.simulatePayoff(toolCall.arguments);
  }
} catch (error) {
  console.error(`Tool execution error: ${toolCall.name}`, error);
  
  // Return error to AI so it can explain to user
  toolResult = {
    error: error.message,
    suggestion: 'Please provide valid credit card details and a positive monthly budget'
  };
}

// AI will say something like:
// "I couldn't run the simulation because the monthly budget needs to be a positive number. 
// Could you tell me how much you can afford to pay toward debt each month?"
```

---

## Implementation Details

### @tyche/ai Package Structure

```
packages/ai/
├── src/
│   ├── index.ts            # Public API
│   │   export { createAgent }
│   │
│   ├── config.ts           # Model configuration
│   │   export { getModelConfig, MODELS }
│   │
│   ├── provider.ts         # AIProvider interface
│   │   interface AIProvider { chat(), chatWithTools() }
│   │
│   ├── factory.ts          # Provider factory
│   │   export function createAIProvider(config): AIProvider
│   │
│   └── providers/
│       ├── anthropic.ts    # Claude implementation
│       ├── openai.ts       # GPT-4 implementation
│       ├── xai.ts          # Grok implementation
│       └── deepseek.ts     # DeepSeek implementation
```

### createAgent() Function

```typescript
// packages/ai/src/index.ts
import { simulatePayoff } from '@tyche/core';
import { createAIProvider } from './factory';
import { getModelConfig } from './config';
import type { AgentContext, AgentTools, Message, Tool } from './types';

export function createAgent(context: AgentContext): AgentTools {
  const config = getModelConfig();
  const provider = createAIProvider(config);
  
  return {
    // Simple chat without tools
    async chat(messages: Message[]): Promise<ChatResponse> {
      return provider.chat(messages, {
        maxTokens: 4096,
        temperature: 0.7
      });
    },
    
    // Chat with tool calling support
    async chatWithTools(messages: Message[], tools: Tool[]): Promise<ChatResponse> {
      return provider.chatWithTools(messages, tools, {
        maxTokens: 4096,
        temperature: 0.7
      });
    },
    
    // Direct tool access (for internal use or testing)
    simulatePayoff(input: PayoffStrategyInput): PayoffPlanResult {
      return simulatePayoff(input, { strategy: input.strategy || 'avalanche' });
    },
    
    // Utility to check which model is being used
    getModel(): string {
      return `${config.provider}/${config.model}`;
    },
    
    // Get user context
    getContext(): AgentContext {
      return context;
    }
  };
}
```

### Provider Tool Calling Implementation

**Anthropic Claude** (Native Tool Calling):

```typescript
// packages/ai/src/providers/anthropic.ts
async chatWithTools(messages: Message[], tools: Tool[]): Promise<ChatResponse> {
  const systemMessage = messages.find(m => m.role === 'system')?.content;
  const userMessages = messages.filter(m => m.role !== 'system');
  
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'anthropic-version': '2023-06-01',
      'x-api-key': this.apiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: this.model,
      max_tokens: 4096,
      system: systemMessage,
      messages: userMessages,
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters  // Claude uses "input_schema" instead of "parameters"
      }))
    })
  });
  
  const data = await response.json();
  
  // Parse tool calls from Claude response
  const toolCalls = data.content
    .filter(c => c.type === 'tool_use')
    .map(c => ({
      name: c.name,
      arguments: c.input
    }));
  
  const textContent = data.content
    .filter(c => c.type === 'text')
    .map(c => c.text)
    .join('\n');
  
  return {
    content: textContent,
    finishReason: data.stop_reason === 'tool_use' ? 'tool_calls' : 'stop',
    toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    usage: {
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens
    }
  };
}
```

**OpenAI GPT-4** (Function Calling):

```typescript
// packages/ai/src/providers/openai.ts
async chatWithTools(messages: Message[], tools: Tool[]): Promise<ChatResponse> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: this.model,
      messages: messages,
      tools: tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }
      })),
      tool_choice: 'auto'  // Let AI decide whether to call tools
    })
  });
  
  const data = await response.json();
  const message = data.choices[0].message;
  
  const toolCalls = message.tool_calls?.map(tc => ({
    name: tc.function.name,
    arguments: JSON.parse(tc.function.arguments)
  }));
  
  return {
    content: message.content || '',
    finishReason: message.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
    toolCalls: toolCalls,
    usage: {
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens
    }
  };
}
```

---

## Tool Execution Patterns

### Pattern 1: Direct Execution (Pure Functions)

For tools that don't need I/O:

```typescript
if (toolCall.name === 'simulate_debt_payoff') {
  // Pure function, no DB calls
  const result = simulatePayoff(toolCall.arguments);
  return result;
}
```

**Benefits**:
- ✅ Fast (no network latency)
- ✅ No error handling for API failures
- ✅ Testable (deterministic)

### Pattern 2: Async Execution (Database/API Calls)

For tools that need external data:

```typescript
if (toolCall.name === 'get_recent_transactions') {
  // Async DB query
  const transactions = await db.query({
    TableName: 'tyche-transactions',
    KeyConditionExpression: 'userId = :userId',
    FilterExpression: '#date >= :startDate',
    ExpressionAttributeNames: { '#date': 'date' },
    ExpressionAttributeValues: {
      ':userId': userId,
      ':startDate': new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  });
  
  return transactions.Items;
}
```

**Considerations**:
- ⚠️ Add timeout handling
- ⚠️ Implement retry logic
- ⚠️ Cache results when possible

### Pattern 3: Tool Chaining (Multi-Step)

Some queries require multiple tools in sequence:

```typescript
// User: "What's my best payoff strategy and will it work with my spending?"

// Step 1: Get user context
const context = await executeToolCall({ name: 'get_user_context', arguments: {} });

// Step 2: Simulate payoff
const payoffResult = executeToolCall({
  name: 'simulate_debt_payoff',
  arguments: {
    cards: context.cards,
    monthlyBudget: 500,
    strategy: 'avalanche'
  }
});

// Step 3: Analyze spending
const spending = executeToolCall({
  name: 'analyze_spending',
  arguments: {
    transactions: context.transactions,
    daysBack: 30
  }
});

// AI synthesizes all results:
// "Your avalanche strategy requires $500/month. Looking at your spending, 
// you average $450/month in discretionary expenses. You'll need to cut $50 
// to hit your goal."
```

### Pattern 4: Conditional Tool Execution

Tools may require prerequisites:

```typescript
if (toolCall.name === 'simulate_balance_transfer') {
  // Check if user has credit cards first
  if (!context.cards || context.cards.length === 0) {
    return {
      error: 'No credit cards found',
      suggestion: 'Please add your credit cards first'
    };
  }
  
  // Check if any cards have balance transfer offers
  const eligibleCards = context.cards.filter(c => c.balanceTransferOffer);
  if (eligibleCards.length === 0) {
    return {
      error: 'No balance transfer offers available',
      suggestion: 'Check with your credit card companies for promotional offers'
    };
  }
  
  // Execute simulation
  return simulateBalanceTransfer(toolCall.arguments);
}
```

---

## Advanced Patterns

### Pattern 1: Recursive Tool Calling

Some AI providers (like Claude) support multi-turn tool calling:

```typescript
async function executeWithRecursion(
  agent: AgentTools,
  messages: Message[],
  tools: Tool[],
  maxDepth: number = 3
): Promise<ChatResponse> {
  let depth = 0;
  let response = await agent.chatWithTools(messages, tools);
  
  while (response.toolCalls && depth < maxDepth) {
    console.log(`Tool depth: ${depth}, calling ${response.toolCalls.length} tools`);
    
    for (const toolCall of response.toolCalls) {
      const result = await executeToolCall(toolCall);
      messages.push({
        role: 'assistant',
        content: `Tool: ${toolCall.name}`
      });
      messages.push({
        role: 'user',
        content: `Result: ${JSON.stringify(result)}`
      });
    }
    
    response = await agent.chatWithTools(messages, tools);
    depth++;
  }
  
  if (depth >= maxDepth) {
    console.warn('Max tool depth reached, returning partial response');
  }
  
  return response;
}
```

**Use Cases**:
- Complex financial planning that requires multiple simulations
- "What-if" scenario analysis
- Multi-step calculations

**Risks**:
- ⚠️ Cost (each AI call costs money)
- ⚠️ Latency (users wait longer)
- ⚠️ Infinite loops (always set maxDepth)

### Pattern 2: Parallel Tool Execution

For independent tools, execute in parallel:

```typescript
if (response.toolCalls && response.toolCalls.length > 1) {
  // Check if tools are independent
  const canRunInParallel = response.toolCalls.every(tc => 
    !tc.name.startsWith('update_') && !tc.name.startsWith('delete_')
  );
  
  if (canRunInParallel) {
    // Execute all tools in parallel
    const results = await Promise.all(
      response.toolCalls.map(tc => executeToolCall(tc))
    );
    
    // Add all results to conversation
    response.toolCalls.forEach((tc, i) => {
      messages.push({
        role: 'assistant',
        content: `Tool: ${tc.name}`
      });
      messages.push({
        role: 'user',
        content: `Result: ${JSON.stringify(results[i])}`
      });
    });
  }
}
```

**Benefits**:
- ✅ 2-3x faster for multiple independent tools
- ✅ Better user experience (lower latency)

**When to Use**:
- Read-only tools (get_context, simulate_payoff, analyze_spending)
- No shared state between tools

**When NOT to Use**:
- Write operations (create_card, delete_transaction)
- Tools that depend on each other's results

### Pattern 3: Tool Result Caching

Avoid redundant tool calls:

```typescript
const toolResultCache = new Map<string, any>();

function getCacheKey(toolCall: ToolCall): string {
  return `${toolCall.name}:${JSON.stringify(toolCall.arguments)}`;
}

async function executeToolCallWithCache(toolCall: ToolCall): Promise<any> {
  const key = getCacheKey(toolCall);
  
  // Check cache
  if (toolResultCache.has(key)) {
    console.log(`Cache hit for ${toolCall.name}`);
    return toolResultCache.get(key);
  }
  
  // Execute tool
  const result = await executeToolCall(toolCall);
  
  // Store in cache (with TTL)
  toolResultCache.set(key, result);
  setTimeout(() => toolResultCache.delete(key), 60000);  // 1 minute TTL
  
  return result;
}
```

**Benefits**:
- ✅ Reduces cost (fewer AI calls)
- ✅ Faster responses
- ✅ Avoids redundant computations

### Pattern 4: Human-in-the-Loop for Sensitive Tools

For tools that take actions (not just queries):

```typescript
const SENSITIVE_TOOLS = ['delete_card', 'update_payment_method', 'transfer_funds'];

if (response.toolCalls) {
  const sensitiveToolCalls = response.toolCalls.filter(tc => 
    SENSITIVE_TOOLS.includes(tc.name)
  );
  
  if (sensitiveToolCalls.length > 0) {
    // Don't execute automatically
    return ok({
      message: response.content,
      pendingActions: sensitiveToolCalls.map(tc => ({
        tool: tc.name,
        description: `AI wants to ${tc.name.replace('_', ' ')}`,
        arguments: tc.arguments
      })),
      requiresConfirmation: true
    });
  }
}

// Client shows confirmation dialog:
// "The AI wants to delete your Chase Sapphire card. Confirm?"
// If user confirms, client sends another request with confirmation=true
```

---

## Best Practices

### 1. Clear Tool Descriptions

**BAD**:
```typescript
{
  name: 'get_data',
  description: 'Gets data',
  parameters: { ... }
}
```

**GOOD**:
```typescript
{
  name: 'get_user_credit_cards',
  description: 'Retrieves all credit cards for the current user including balance, APR, credit limit, and minimum payment. Use this when you need current credit card information to provide advice or run simulations.',
  parameters: { ... }
}
```

**Why**: AI uses descriptions to decide which tool to call. Be specific!

### 2. Validate Tool Arguments

```typescript
if (toolCall.name === 'simulate_debt_payoff') {
  // Validate required fields
  if (!toolCall.arguments.cards || !Array.isArray(toolCall.arguments.cards)) {
    throw new Error('cards must be an array');
  }
  
  // Validate data types
  if (typeof toolCall.arguments.monthlyBudget !== 'number') {
    throw new Error('monthlyBudget must be a number');
  }
  
  // Validate business logic
  if (toolCall.arguments.monthlyBudget <= 0) {
    throw new Error('monthlyBudget must be positive');
  }
  
  const minPayments = toolCall.arguments.cards.reduce((sum, c) => sum + c.minPayment, 0);
  if (toolCall.arguments.monthlyBudget < minPayments) {
    throw new Error(`monthlyBudget ($${toolCall.arguments.monthlyBudget}) must be at least the sum of minimum payments ($${minPayments})`);
  }
}
```

### 3. Log Everything

```typescript
console.log(`[${userId}] AI Chat Request`);
console.log(`Model: ${agent.getModel()}`);
console.log(`Message count: ${messages.length}`);

if (response.toolCalls) {
  console.log(`Tools called: ${response.toolCalls.map(tc => tc.name).join(', ')}`);
  console.log(`Tool arguments: ${JSON.stringify(response.toolCalls.map(tc => tc.arguments))}`);
}

console.log(`Response length: ${response.content.length} chars`);
console.log(`Tokens used: ${response.usage?.inputTokens} input, ${response.usage?.outputTokens} output`);
```

**Why**: Essential for debugging, cost tracking, and understanding user interactions.

### 4. Return Structured Results

**BAD**:
```typescript
return {
  result: "18 months, $1247.32 interest"
};
```

**GOOD**:
```typescript
return {
  monthsToDebtFree: 18,
  totalInterest: 1247.32,
  monthlyPayment: 400,
  steps: [...],
  metadata: {
    strategy: 'avalanche',
    cardsCount: 2,
    totalDebt: 7000
  }
};
```

**Why**: AI can parse structured data better and provide more detailed advice.

### 5. Handle Provider Differences

Different AI providers have quirks:

```typescript
// Anthropic requires "input_schema", OpenAI uses "parameters"
const tools = tools.map(t => ({
  name: t.name,
  description: t.description,
  ...(config.provider === 'anthropic' 
    ? { input_schema: t.parameters }
    : { parameters: t.parameters }
  )
}));
```

---

## Troubleshooting

### Issue 1: AI Not Calling Tools

**Symptoms**:
- AI responds with text instead of calling available tools
- AI says "I can't do that" even though tool exists

**Causes**:
1. Tool description too vague
2. User query doesn't match tool purpose
3. System message restricts tool usage
4. Provider doesn't support tool calling for that model

**Solutions**:
```typescript
// 1. Improve tool description
description: 'Use this tool when user asks about debt payoff, credit card strategies, or wants to know how long to become debt-free'

// 2. Add examples to system message
system: `You are a finance advisor. When users ask about debt strategies, USE THE simulate_debt_payoff TOOL. Example: User says "How do I pay off my cards?" -> Call simulate_debt_payoff tool.`

// 3. Check model support
if (config.model === 'gpt-3.5-turbo') {
  console.warn('GPT-3.5 has limited tool calling, consider upgrading to GPT-4');
}
```

### Issue 2: Tool Arguments Invalid

**Symptoms**:
- AI calls tool but arguments don't match schema
- JSON parsing errors

**Causes**:
1. JSON Schema too complex
2. AI misunderstands parameter format
3. Missing required fields

**Solutions**:
```typescript
// 1. Simplify schema
// BAD:
parameters: {
  type: 'object',
  properties: {
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          balance: { type: 'number' },
          // ... 10 more fields
        }
      }
    }
  }
}

// GOOD:
parameters: {
  type: 'object',
  properties: {
    cards: {
      type: 'array',
      description: 'Array of card objects with id, balance, apr, minPayment'
    },
    monthlyBudget: {
      type: 'number',
      description: 'Total monthly payment amount'
    }
  },
  required: ['cards', 'monthlyBudget']
}

// 2. Add validation with helpful errors
try {
  JSON.parse(toolCall.arguments);
} catch (error) {
  console.error('Invalid tool arguments:', toolCall.arguments);
  return {
    error: 'Invalid arguments format',
    expected: 'JSON object with cards and monthlyBudget',
    received: toolCall.arguments
  };
}
```

### Issue 3: High Latency

**Symptoms**:
- Responses take 10+ seconds
- User complaints about slow chat

**Causes**:
1. Multiple sequential tool calls
2. Large tool results (thousands of transactions)
3. Slow database queries
4. No caching

**Solutions**:
```typescript
// 1. Parallel execution
const results = await Promise.all(toolCalls.map(executeToolCall));

// 2. Limit data size
const recentTransactions = transactions.slice(0, 100);  // Only last 100

// 3. Cache tool results
const cacheKey = `${userId}:cards`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

// 4. Use streaming (if provider supports)
const stream = await agent.chatWithToolsStream(messages, tools);
for await (const chunk of stream) {
  sendToClient(chunk);  // Progressive responses
}
```

### Issue 4: Cost Explosion

**Symptoms**:
- Monthly AI API bill is very high
- Many token-heavy requests

**Causes**:
1. Sending full conversation history every time
2. Large tool results (e.g., 1000 transactions)
3. Recursive tool calling without limits
4. Using expensive models for simple tasks

**Solutions**:
```typescript
// 1. Truncate conversation history
const recentMessages = messages.slice(-10);  // Only last 10 messages

// 2. Summarize large results
if (transactions.length > 100) {
  toolResult = {
    summary: `${transactions.length} transactions totaling $${total}`,
    categories: categorySummary,
    // Don't include full transaction list
  };
}

// 3. Set max depth
const MAX_TOOL_DEPTH = 2;

// 4. Use cheaper models for classification
if (toolCall.name === 'classify_transaction') {
  const cheapAgent = createAgent({
    ...context,
    provider: 'deepseek',  // 10x cheaper than GPT-4
    model: 'deepseek-chat'
  });
  return await cheapAgent.chat(messages);
}
```

---

## Summary

AgentKit in Tyche Finance enables:

✅ **Intelligent financial advice** - AI reasons about user's situation  
✅ **Actionable tools** - Simulate strategies, analyze spending, predict impact  
✅ **Multi-model support** - Works with Claude, GPT-4, Grok, DeepSeek  
✅ **Scalable architecture** - Stateless Lambda functions, cacheable results  

**Key Takeaways**:

1. **Tools are functions AI can call** - Define them clearly with good descriptions
2. **Execution happens in Lambda** - Keep it fast (<3s per request)
3. **Validate everything** - Don't trust AI-generated arguments blindly
4. **Log for debugging** - You'll need it when things go wrong
5. **Start simple** - Add complexity (parallel execution, caching) only when needed

**Next Steps**:

- [ ] Add more financial tools (balance transfers, purchase impact)
- [ ] Implement tool result caching (Redis or DynamoDB)
- [ ] Add streaming responses for better UX
- [ ] Build admin dashboard to monitor tool usage
- [ ] A/B test different models for cost vs quality

---

**Document Status**: Living document - update as agent capabilities expand.

**Last Reviewed**: October 15, 2025
