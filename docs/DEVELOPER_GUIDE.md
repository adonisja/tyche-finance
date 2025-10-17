# Developer Quick Reference

> Quick reference for common tasks in Tyche Finance development

**Target Audience**: Developers working on the codebase  
**Last Updated**: October 16, 2025

---

## 📁 Project Structure Quick Lookup

```
Key Files & Directories:
├── packages/types/src/index.ts        # All TypeScript type definitions
├── packages/core/src/index.ts         # Business logic (simulatePayoff)
├── packages/ai/src/                   # AI provider system
│   ├── index.ts                       # createAgent() entry point
│   ├── config.ts                      # Model configuration
│   └── providers/                     # Claude, GPT-4, Grok, DeepSeek
├── services/api/src/
│   ├── index.ts                       # Lambda main handler
│   ├── utils.ts                       # Router, response helpers
│   └── handlers/                      # API endpoint implementations
├── infrastructure/lib/tyche-stack.ts  # AWS CDK resources
└── docs/                              # All documentation
```

---

## 🛠️ Common Commands

### Build & Development

```bash
# Install all dependencies (run from repo root)
npm install

# Build everything
npm run build

# Build specific package
cd packages/core && npm run build

# Clean all build artifacts
npm run clean

# Watch mode for development
cd packages/core
npm run build -- --watch
```

### Testing

```bash
# Run all tests
npm test

# Test specific package
cd packages/core
npm test

# Test coverage
npm test -- --coverage
```

### Development Servers

```bash
# Web app (Vite dev server)
cd apps/web
npm run dev
# → http://localhost:5173

# Mobile app (Expo)
cd apps/mobile
npm start
# → Scan QR with Expo Go app
```

### AWS Deployment

```bash
# Bootstrap CDK (one-time per AWS account/region)
cd infrastructure
npm run bootstrap

# Preview changes
npm run diff

# Deploy to AWS
npm run deploy

# Destroy all resources
npm run destroy
```

---

## 🔧 Environment Variables

### Required for AI Features

```bash
# Choose ONE provider
export AI_PROVIDER=anthropic  # or: openai, xai, deepseek

# Set corresponding API key
export ANTHROPIC_API_KEY=sk-ant-your-key-here
# or
export OPENAI_API_KEY=sk-your-key-here
# or
export XAI_API_KEY=xai-your-key-here
# or
export DEEPSEEK_API_KEY=sk-your-key-here

# (Optional) Override default model
export AI_MODEL=claude-3-5-sonnet-latest
```

### Required for AWS

```bash
# AWS credentials (from aws configure or env vars)
export AWS_ACCESS_KEY_ID=your-key
export AWS_SECRET_ACCESS_KEY=your-secret
export AWS_DEFAULT_REGION=us-east-1
```

### Frontend Configuration

```bash
# Web app (.env in apps/web/)
VITE_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/prod
VITE_USER_POOL_ID=us-east-1_ABC123
VITE_USER_POOL_CLIENT_ID=1234567890abcdef
VITE_COGNITO_REGION=us-east-1
```

---

## 📦 Adding New Packages

### Add Dependency to Specific Package

```bash
# Add to specific workspace
cd packages/core
npm install lodash

# Add dev dependency
npm install --save-dev @types/lodash
```

### Add Workspace Dependency

```bash
# In packages/ai/package.json
{
  "dependencies": {
    "@tyche/core": "*",
    "@tyche/types": "*"
  }
}

# Then run from root:
npm install
```

---

## 🎯 API Development Patterns

### Adding New Endpoint

**1. Create Handler**

```typescript
// services/api/src/handlers/myFeature.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ok, badRequest } from '../utils';

export async function myHandler(
  event: APIGatewayProxyEvent,
  userId?: string
): Promise<APIGatewayProxyResult> {
  if (!userId) {
    return badRequest('User ID required');
  }
  
  const body = JSON.parse(event.body || '{}');
  
  // Your logic here
  
  return ok({ result: 'success' });
}
```

**2. Register Route**

```typescript
// services/api/src/index.ts
import { myHandler } from './handlers/myFeature';

export const handler = createRouter([
  // ... existing routes
  { method: 'POST', path: '/v1/my-feature', handler: myHandler },
]);
```

**3. Rebuild & Deploy**

```bash
npm run build
cd infrastructure
npm run deploy
```

### Response Helpers

```typescript
import { ok, badRequest, unauthorized, notFound, serverError } from './utils';

// Success (200)
return ok({ data: result });

// Bad Request (400)
return badRequest('Invalid input');

// Unauthorized (401)
return unauthorized('Authentication required');

// Not Found (404)
return notFound('Resource not found');

// Server Error (500)
return serverError('Something went wrong', error);
```

---

## 🤖 Working with AI

### Create Agent

```typescript
import { createAgent } from '@tyche/ai';

const agent = createAgent({
  userId: 'user-123',
  cards: [...],
  transactions: [...]
});
```

### Simple Chat

```typescript
const response = await agent.chat([
  { role: 'system', content: 'You are a financial advisor' },
  { role: 'user', content: 'How do I save money?' }
]);

console.log(response.content);
```

### Chat with Tools

```typescript
const tools = [{
  name: 'simulate_debt_payoff',
  description: 'Calculate debt payoff strategies',
  parameters: {
    type: 'object',
    properties: {
      cards: { type: 'array' },
      monthlyBudget: { type: 'number' },
      strategy: { type: 'string', enum: ['avalanche', 'snowball'] }
    },
    required: ['cards', 'monthlyBudget']
  }
}];

const response = await agent.chatWithTools(messages, tools);

if (response.toolCalls) {
  for (const toolCall of response.toolCalls) {
    // Execute tool
    const result = agent.simulatePayoff(toolCall.arguments);
    
    // Send result back to AI
    messages.push({
      role: 'user',
      content: `Tool result: ${JSON.stringify(result)}`
    });
    
    // Get final response
    const finalResponse = await agent.chat(messages);
  }
}
```

### Switch AI Models

```bash
# Test different models without code changes
export AI_PROVIDER=deepseek
export AI_MODEL=deepseek-chat
npm run build && cd infrastructure && npm run deploy

# Or test locally
AI_PROVIDER=openai AI_MODEL=gpt-4-turbo-preview node test-ai.js
```

---

## 🗄️ Database Queries

### DynamoDB Patterns

```typescript
import { DynamoDBDocumentClient, QueryCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Get single item
const result = await client.send(new GetCommand({
  TableName: 'tyche-users',
  Key: {
    PK: `TENANT#${tenantId}#USER#${userId}`,
    SK: 'METADATA'
  }
}));

// Query items
const cards = await client.send(new QueryCommand({
  TableName: 'tyche-credit-cards',
  KeyConditionExpression: 'PK = :pk',
  ExpressionAttributeValues: {
    ':pk': `TENANT#${tenantId}#USER#${userId}`
  }
}));

// Put item
await client.send(new PutCommand({
  TableName: 'tyche-credit-cards',
  Item: {
    PK: `TENANT#${tenantId}#USER#${userId}`,
    SK: `CARD#${cardId}`,
    tenantId,
    userId,
    cardId,
    name: 'Chase Sapphire',
    balance: 5000,
    createdAt: new Date().toISOString()
  }
}));
```

---

## 🔐 Authorization & Multi-Tenancy Patterns

**Updated:** October 15, 2025 - Full RBAC implementation

### Basic Authorization Check

```typescript
import { authorize } from './middleware/authorize';
import { ok, forbidden } from './utils';

export async function myHandler(
  event: APIGatewayProxyEventV2,
  userId?: string
) {
  // Require user role (or higher)
  const auth = await authorize(event, 'user');
  
  if (!auth.authorized) {
    return forbidden(auth.reason);
  }
  
  const { user, context } = auth;
  
  // Now access context.userId, context.tenantId, context.role
  return ok({ message: `Hello ${user.email}` });
}
```

### Admin-Only Endpoints

```typescript
export async function listAllUsers(event, userId?) {
  // Only admins can access
  const auth = await authorize(event, 'admin');
  
  if (!auth.authorized) {
    return forbidden(auth.reason);
  }
  
  const { context } = auth;
  
  // Log admin action (required for compliance)
  await auditLog({
    tenantId: context.tenantId,
    userId: context.userId,
    role: context.role,
    action: 'list_all_users',
    resource: 'users',
    success: true
  });
  
  // Query all users in tenant
  const users = await queryUsers(context.tenantId);
  return ok({ users });
}
```

### Permission-Based Authorization

```typescript
// Check both role AND specific permission
const auth = await authorize(event, 'admin', 'users:write');

if (!auth.authorized) {
  return forbidden(auth.reason);
}

// User is admin AND has 'users:write' permission
```

### Role Hierarchy

```typescript
// Privilege levels (lower = less access)
const ROLE_HIERARCHY = {
  user: 1,   // Self-service only
  dev: 2,    // + System monitoring
  admin: 3   // + User management, full access
};

// Examples:
authorize(event, 'user')   // User, Dev, Admin can access
authorize(event, 'dev')    // Only Dev, Admin can access
authorize(event, 'admin')  // Only Admin can access
```

### Tenant-Isolated Database Queries

```typescript
// ✅ ALWAYS include tenantId from JWT
const auth = await authorize(event, 'user');

const cards = await db.query({
  TableName: 'tyche-credit-cards',
  KeyConditionExpression: 'PK = :pk',
  ExpressionAttributeValues: {
    ':pk': `TENANT#${auth.context.tenantId}#USER#${auth.context.userId}`
    //              ^^^^^^^^^^^^^^^^^^^^^^^^^ From JWT, cannot be faked
  }
});
```

### Resource Ownership Validation

```typescript
// Check if user owns the resource
const card = await getCard(context.tenantId, userId, cardId);

if (!card) {
  return notFound('Card not found');
}

// Verify ownership (unless admin)
if (card.userId !== context.userId && context.role !== 'admin') {
  await auditLog({
    tenantId: context.tenantId,
    userId: context.userId,
    action: 'unauthorized_card_access',
    resource: 'cards',
    resourceId: cardId,
    success: false
  });
  
  return forbidden('You do not own this card');
}

// Safe to modify
```

### Audit Logging

```typescript
import { auditLog, logAdminView, logRoleChange } from './utils/audit';

// Log generic action
await auditLog({
  tenantId: context.tenantId,
  userId: context.userId,
  role: context.role,
  action: 'delete_card',
  resource: 'cards',
  resourceId: cardId,
  success: true
});

// Log admin viewing user data
await logAdminView(
  context.tenantId,
  context.userId,  // Admin's ID
  'cards',
  targetUserId     // User being viewed
);

// Log role change
await logRoleChange(
  context.tenantId,
  context.userId,  // Admin's ID
  targetUserId,
  'user',          // Old role
  'dev'            // New role
);
```

### Create Tenant-Aware Keys

```typescript
import { createTenantKey } from './middleware/authorize';

// User key
const userPK = createTenantKey('acme-corp', 'USER', 'user-123');
// Returns: "TENANT#acme-corp#USER#user-123"

// Card key
const cardPK = createTenantKey('acme-corp', 'USER', 'user-123');
const cardSK = `CARD#${cardId}`;
```

### Test Authorization Locally

```typescript
// Create mock event with JWT claims
const mockEvent = {
  requestContext: {
    authorizer: {
      jwt: {
        claims: {
          sub: 'test-user-123',
          email: 'test@example.com',
          'custom:role': 'admin',
          'custom:tenantId': 'test-tenant',
          'custom:permissions': 'users:write,cards:read'
        }
      }
    },
    http: {
      method: 'GET',
      path: '/v1/admin/users'
    }
  }
} as any;

// Test authorization
const auth = await authorize(mockEvent, 'admin');
console.log('Authorized:', auth.authorized);
console.log('Context:', auth.context);
```

---

## 💳 Working with Credit Card Data

**Added:** October 15, 2025 - PCI DSS Compliant Schema

### Security-First Design

Tyche Finance **never stores full credit card numbers, CVV codes, or expiration dates**. We only store:
- **Card network** (Visa, Mastercard, etc.) - for display/logos
- **Last 4 digits** (e.g., "4532") - for user identification
- **Account details** (balance, limit, APR) - for optimization calculations

This approach:
- ✅ Eliminates PCI DSS compliance burden
- ✅ Protects users from data breaches
- ✅ Reduces legal liability
- ✅ Maintains full app functionality

### Create Credit Card

```typescript
// POST /v1/cards
import { createCard } from './handlers/cards';

const event = {
  body: JSON.stringify({
    name: 'Chase Sapphire Preferred',
    network: 'Visa',              // Required: 'Visa' | 'Mastercard' | 'American Express' | 'Discover' | 'Other'
    lastFourDigits: '4532',       // Required: Exactly 4 digits
    limit: 10000,                 // Credit limit
    balance: 5000,                // Current balance
    apr: 0.1999,                  // Annual percentage rate (19.99% = 0.1999)
    minPayment: 150,              // Minimum payment amount
    dueDayOfMonth: 15,            // Day of month payment is due (1-28)
    issuer: 'Chase Bank',         // Optional: Bank name
    isActive: true,               // Optional: Defaults to true
    currency: 'USD'               // Optional: Defaults to 'USD'
  }),
  requestContext: {
    authorizer: {
      jwt: { claims: { sub: 'user-123', 'custom:tenantId': 'tenant-1' } }
    }
  }
};

const response = await createCard(event, 'user-123');
// Returns: 201 Created with card object
```

**Validation Rules:**
```typescript
// Network must be one of the valid values
const validNetworks = ['Visa', 'Mastercard', 'American Express', 'Discover', 'Other'];

// Last 4 digits must be exactly 4 numeric characters
const lastFourDigitsPattern = /^\d{4}$/;

// APR must be between 0 and 1 (0% to 100%)
const aprRange = [0, 1];

// Due day must be between 1 and 28 (safe for all months)
const dueDayRange = [1, 28];
```

**Error Examples:**
```typescript
// ❌ Invalid network
{ network: 'Viza', lastFourDigits: '4532', ... }
// → 400 Bad Request: "Invalid network. Must be one of: Visa, Mastercard, American Express, Discover, Other"

// ❌ Wrong digit count
{ network: 'Visa', lastFourDigits: '123', ... }
// → 400 Bad Request: "lastFourDigits must be exactly 4 digits"

// ❌ Non-numeric characters
{ network: 'Visa', lastFourDigits: 'abcd', ... }
// → 400 Bad Request: "lastFourDigits must be exactly 4 digits"

// ❌ Attempting to send full card number
{ network: 'Visa', lastFourDigits: '4532123456789012', ... }
// → 400 Bad Request: "Security error: Only last 4 digits allowed"
// (Also logged as security event)
```

### Update Credit Card

```typescript
// PUT /v1/cards/{cardId}
const event = {
  pathParameters: { cardId: 'card-123' },
  body: JSON.stringify({
    name: 'Chase Sapphire Reserve',  // Updated name
    balance: 4500,                   // Updated balance
    limit: 15000,                    // Updated limit
    apr: 0.1799                      // Updated APR
  })
};

const response = await updateCard(event, 'user-123');
// Returns: 200 OK with updated card
```

**Immutable Fields (Cannot Be Changed):**
```typescript
// ❌ These will be rejected with 400 Bad Request
{
  lastFourDigits: '9999'  // Error: "Cannot modify lastFourDigits (immutable identifier)"
}

{
  network: 'Mastercard'   // Error: "Cannot modify network (immutable identifier)"
}
```

**Why Immutable?** These fields identify the physical card. If they change, it's a different card → create a new record instead.

### List User's Cards

```typescript
// GET /v1/cards
const response = await getCards(event, 'user-123');

// Returns:
{
  cards: [
    {
      id: 'card-123',
      userId: 'user-123',
      name: 'Chase Sapphire Preferred',
      network: 'Visa',
      lastFourDigits: '4532',
      limit: 10000,
      balance: 5000,
      apr: 0.1999,
      minPayment: 150,
      dueDayOfMonth: 15,
      issuer: 'Chase Bank',
      isActive: true,
      currency: 'USD',
      createdAt: '2025-10-15T12:00:00.000Z',
      updatedAt: '2025-10-15T12:00:00.000Z'
    }
  ]
}
```

### Delete Credit Card

```typescript
// DELETE /v1/cards/{cardId}
const event = {
  pathParameters: { cardId: 'card-123' }
};

const response = await deleteCard(event, 'user-123');
// Returns: 200 OK { message: 'Card deleted' }
```

### Frontend Form Example

```typescript
// React component for adding a card
function AddCardForm() {
  const [formData, setFormData] = useState({
    name: '',
    network: 'Visa',
    lastFourDigits: '',
    limit: 0,
    balance: 0,
    apr: 0,
    minPayment: 0,
    dueDayOfMonth: 15
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Validate locally
    if (!/^\d{4}$/.test(formData.lastFourDigits)) {
      alert('Last 4 digits must be exactly 4 numeric characters');
      return;
    }
    
    // Send to API
    const response = await fetch('/v1/cards', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify(formData)
    });
    
    if (response.ok) {
      const card = await response.json();
      console.log('Card created:', card);
    } else {
      const error = await response.json();
      alert(error.message);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Card nickname (e.g., Chase Freedom)"
        value={formData.name}
        onChange={e => setFormData({ ...formData, name: e.target.value })}
        required
      />
      
      <select
        value={formData.network}
        onChange={e => setFormData({ ...formData, network: e.target.value as CardNetwork })}
        required
      >
        <option value="Visa">Visa</option>
        <option value="Mastercard">Mastercard</option>
        <option value="American Express">American Express</option>
        <option value="Discover">Discover</option>
        <option value="Other">Other</option>
      </select>
      
      <input
        type="text"
        placeholder="Last 4 digits"
        value={formData.lastFourDigits}
        onChange={e => setFormData({ ...formData, lastFourDigits: e.target.value })}
        pattern="\d{4}"
        maxLength={4}
        required
      />
      
      <input
        type="number"
        placeholder="Credit limit"
        value={formData.limit}
        onChange={e => setFormData({ ...formData, limit: Number(e.target.value) })}
        min={0}
        required
      />
      
      <input
        type="number"
        placeholder="Current balance"
        value={formData.balance}
        onChange={e => setFormData({ ...formData, balance: Number(e.target.value) })}
        min={0}
        required
      />
      
      <input
        type="number"
        placeholder="APR (e.g., 0.1999 for 19.99%)"
        value={formData.apr}
        onChange={e => setFormData({ ...formData, apr: Number(e.target.value) })}
        step={0.0001}
        min={0}
        max={1}
        required
      />
      
      <input
        type="number"
        placeholder="Minimum payment"
        value={formData.minPayment}
        onChange={e => setFormData({ ...formData, minPayment: Number(e.target.value) })}
        min={0}
        required
      />
      
      <input
        type="number"
        placeholder="Due day of month (1-28)"
        value={formData.dueDayOfMonth}
        onChange={e => setFormData({ ...formData, dueDayOfMonth: Number(e.target.value) })}
        min={1}
        max={28}
        required
      />
      
      <button type="submit">Add Card</button>
    </form>
  );
}
```

### Display Card in UI

```typescript
function CardDisplay({ card }: { card: CreditCardAccount }) {
  // Map network to logo/icon
  const networkIcon = {
    'Visa': '💳',
    'Mastercard': '💳',
    'American Express': '💳',
    'Discover': '💳',
    'Other': '💳'
  }[card.network];

  return (
    <div className="card-display">
      <div className="card-header">
        <span className="network-icon">{networkIcon}</span>
        <span className="network-name">{card.network}</span>
        <span className="last-four">•••• {card.lastFourDigits}</span>
      </div>
      
      <h3>{card.name}</h3>
      
      <div className="card-details">
        <div>
          <label>Balance</label>
          <span>${card.balance.toFixed(2)}</span>
        </div>
        <div>
          <label>Limit</label>
          <span>${card.limit.toFixed(2)}</span>
        </div>
        <div>
          <label>Available</label>
          <span>${(card.limit - card.balance).toFixed(2)}</span>
        </div>
        <div>
          <label>APR</label>
          <span>{(card.apr * 100).toFixed(2)}%</span>
        </div>
        <div>
          <label>Min Payment</label>
          <span>${card.minPayment.toFixed(2)}</span>
        </div>
        <div>
          <label>Due Date</label>
          <span>Day {card.dueDayOfMonth} of month</span>
        </div>
      </div>
    </div>
  );
}
```

### Type Definitions

```typescript
// packages/types/src/index.ts

export type CardNetwork = 'Visa' | 'Mastercard' | 'American Express' | 'Discover' | 'Other';

export interface CreditCardAccount {
  id: string;
  name: string;
  network: CardNetwork;
  lastFourDigits: string;
  limit: number;
  balance: number;
  apr: number;
  minPayment: number;
  dueDayOfMonth: number;
  issuer?: string;
  promotionalAprEndsOn?: string;
  isActive?: boolean;
  currency?: Currency;
  createdAt?: string;
  updatedAt?: string;
}
```

---

## 🧪 Testing Strategies

### Authentication Testing

**Complete authentication flow testing guide**: See [AUTH_TESTING_GUIDE.md](./AUTH_TESTING_GUIDE.md)

**Quick Test - Signup & Login:**

```bash
# 1. Start dev server
cd apps/web
npm run dev

# 2. Navigate to http://localhost:5173/signup
# 3. Fill form and submit
# 4. Check email for verification code (from app.tyche.financial@gmail.com)
# 5. Confirm email with 6-digit code
# 6. Login at http://localhost:5173/login
# 7. Should redirect to dashboard

# Verify user was auto-assigned to "Users" group
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id us-east-1_khi9CtS4e \
  --username your-email@example.com \
  --region us-east-1 \
  --profile tyche-dev

# Expected output:
# {
#   "Groups": [
#     {
#       "GroupName": "Users",
#       "Precedence": 3
#     }
#   ]
# }
```

**Debug Auth Token in Browser Console:**

```javascript
// Get current auth token and claims
await window.getAuthToken();

// Output:
// {
//   token: "eyJraWQiOiJ...",
//   claims: {
//     sub: "8448b4d8-20b1-7062-caba-1ab4ab081277",
//     email: "user@example.com",
//     "cognito:groups": ["Users"],
//     exp: 1729099234
//   },
//   groups: ["Users"]
// }

// Clear session (logout + clear storage)
await window.debugLogout();
```

**Test API with Auth:**

```bash
# Get auth token from browser (window.getAuthToken())
TOKEN="eyJraWQiOiJ..."

# Test authenticated endpoint
curl -H "Authorization: Bearer $TOKEN" \
  https://841dg6itk5.execute-api.us-east-1.amazonaws.com/v1/cards
```

### Unit Tests (Vitest)
// packages/core/src/index.test.ts
import { describe, it, expect } from 'vitest';
import { simulatePayoff } from './index';

describe('simulatePayoff', () => {
  it('calculates avalanche correctly', () => {
    const result = simulatePayoff({
      cards: [
        { id: '1', balance: 5000, apr: 0.15, minPayment: 100 },
        { id: '2', balance: 2000, apr: 0.25, minPayment: 50 }
      ],
      monthlyBudget: 500,
      strategy: 'avalanche'
    });
    
    expect(result.monthsToDebtFree).toBeGreaterThan(0);
    expect(result.totalInterest).toBeLessThan(2000);
  });
});
```

### Integration Tests (Lambda)

```typescript
// services/api/src/handlers/cards.test.ts
import { createCard } from './cards';

it('creates card successfully', async () => {
  const event = {
    body: JSON.stringify({
      name: 'Test Card',
      balance: 1000,
      apr: 0.15,
      limit: 5000
    })
  };
  
  const response = await createCard(event, 'user-123');
  const body = JSON.parse(response.body);
  
  expect(response.statusCode).toBe(200);
  expect(body.success).toBe(true);
  expect(body.data.cardId).toBeDefined();
});
```

---

## 🐛 Debugging

### View Lambda Logs

```bash
# Real-time logs
aws logs tail /aws/lambda/tyche-api --follow

# Filter for errors
aws logs tail /aws/lambda/tyche-api --follow --filter-pattern "ERROR"

# Last 1 hour
aws logs tail /aws/lambda/tyche-api --since 1h
```

### Test Lambda Locally

```bash
# Install SAM CLI
brew install aws-sam-cli

# Invoke Lambda locally
sam local invoke TycheApiFunction --event event.json
```

### Debug TypeScript Compilation

```bash
# Check for type errors without building
cd packages/core
npx tsc --noEmit

# Verbose build output
npm run build -- --verbose
```

---

## 📊 Monitoring

### Check API Health

```bash
curl https://your-api-id.execute-api.us-east-1.amazonaws.com/prod/public/health
```

### CloudWatch Metrics

Key metrics to watch:
- **Invocations**: Number of Lambda invocations
- **Errors**: Failed Lambda invocations
- **Duration**: Execution time (watch for timeouts)
- **ConcurrentExecutions**: Active Lambda instances

### Cost Tracking

```bash
# View current month costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -u +%Y-%m-01),End=$(date -u +%Y-%m-%d) \
  --granularity MONTHLY \
  --metrics BlendedCost
```

---

## 🆘 Troubleshooting

### "Cannot find module @tyche/core"

```bash
# Rebuild packages
npm run build

# Re-link workspaces
rm -rf node_modules package-lock.json
npm install
```

### "User ID required" Error

Check JWT token has required claims:
- `sub` (userId)
- `custom:tenantId`
- `custom:role`

### DynamoDB Access Denied

Verify Lambda has correct IAM permissions:
```typescript
// infrastructure/lib/tyche-stack.ts
usersTable.grantReadWriteData(apiLambda);
cardsTable.grantReadWriteData(apiLambda);
```

### Cold Start Too Slow

Options:
1. Increase Lambda memory (more CPU)
2. Enable provisioned concurrency
3. Use Lambda warmers

---

## 🎨 Code Style

### TypeScript

```typescript
// Use explicit types
function calculate(amount: number, rate: number): number {
  return amount * rate;
}

// Prefer interfaces for objects
interface CreditCard {
  id: string;
  balance: number;
}

// Use const for immutable values
const MAX_CARDS = 10;

// Async/await over promises
async function fetchData() {
  const data = await api.get('/data');
  return data;
}
```

### Naming Conventions

```typescript
// PascalCase for types, interfaces, classes
type UserRole = 'user' | 'dev' | 'admin';
interface User { ... }
class PayoffCalculator { ... }

// camelCase for variables, functions
const userId = 'user-123';
function calculateTotal() { ... }

// UPPER_SNAKE_CASE for constants
const MAX_RETRY_ATTEMPTS = 3;

// kebab-case for file names
credit-card-form.tsx
simulate-payoff.ts
```

---

## 📚 Further Reading

- [Architecture Deep Dive](../docs/ARCHITECTURE.md)
- [Bug Fixes & Lessons](../docs/BUGS_AND_FIXES.md)
- [AgentKit Integration](../docs/AGENTKIT_INTEGRATION.md)
- [Multi-Tenancy Guide](../docs/MULTI_TENANCY.md)
- [AWS Deployment](../infrastructure/README.md)

---

**Keep this updated as patterns emerge!**
