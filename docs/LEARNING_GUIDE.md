# 🎓 Multi-Tenancy Authorization System - Complete Learning Guide

**Status:** ✅ Fully Implemented (October 15, 2025)  
**Implementation:** Authorization middleware, admin/dev handlers, audit logging, type definitions  
**Deployed:** Pending (code ready, AWS deployment next)

## Table of Contents
1. [High-Level Architecture](#high-level-architecture)
2. [Type System Explained](#type-system-explained)
3. [Authorization Flow](#authorization-flow)
4. [JWT Token Deep Dive](#jwt-token-deep-dive)
5. [Role Hierarchy](#role-hierarchy)
6. [Database Schema](#database-schema)
7. [Common Patterns](#common-patterns)
8. [Security Best Practices](#security-best-practices)
9. [Implementation Files](#implementation-files)

---

## Implementation Files

**Status: ✅ All files created and compiled successfully**

| File | Purpose | Lines | Status |
|------|---------|-------|--------|
| `packages/types/src/index.ts` | Type definitions (User, UserRole, AuthContext, AuditLogEntry) | +60 | ✅ |
| `services/api/src/middleware/authorize.ts` | Authorization middleware and helpers | 250 | ✅ |
| `services/api/src/utils/audit.ts` | Audit logging system | 200 | ✅ |
| `services/api/src/handlers/admin/users.ts` | Admin user management endpoints | 370 | ✅ |
| `services/api/src/handlers/dev/metrics.ts` | Dev system monitoring endpoints | 260 | ✅ |
| `services/api/src/index.ts` | Route configuration | +50 | ✅ |
| `services/api/src/utils.ts` | Updated RouteHandler type | +5 | ✅ |

**Build Status:** ✅ `npm run build` succeeds with zero errors

---

## Table of Contents

```
┌─────────────┐
│   Client    │  (React Web App / Mobile App)
│             │  
└──────┬──────┘
       │ HTTP Request with JWT Token
       │ Authorization: Bearer eyJhbGc...
       ▼
┌─────────────────────────────────────────┐
│      AWS API Gateway (HTTP API)         │
│  ┌─────────────────────────────────┐   │
│  │  Cognito JWT Authorizer         │   │
│  │  - Validates token signature     │   │
│  │  - Extracts claims (user info)   │   │
│  │  - Attaches to requestContext    │   │
│  └─────────────────────────────────┘   │
└──────────────┬──────────────────────────┘
               │ Event with JWT claims
               ▼
┌─────────────────────────────────────────┐
│           Lambda Handler                │
│  ┌─────────────────────────────────┐   │
│  │  1. Extract Auth Context        │   │
│  │     - Read JWT claims           │   │
│  │     - Parse role, tenant, etc   │   │
│  │                                 │   │
│  │  2. Check Authorization         │   │
│  │     - Does role match required? │   │
│  │     - Does user have permission?│   │
│  │     - Is tenant ID correct?     │   │
│  │                                 │   │
│  │  3. Log Audit Entry            │   │
│  │     - Who, what, when, where   │   │
│  │                                 │   │
│  │  4. Execute Business Logic     │   │
│  │     - Query DynamoDB            │   │
│  │     - Call AI service           │   │
│  │     - Return response           │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
               │
               ▼
      ┌────────────────┐
      │   DynamoDB     │
      │   (Database)   │
      └────────────────┘
```

---

## Type System Explained

### Why TypeScript for Backend?

TypeScript adds **compile-time type checking** to JavaScript:

```typescript
// ❌ JavaScript - Runtime error (crashes in production!)
function addNumbers(a, b) {
  return a + b;
}
addNumbers("5", 3);  // Returns "53" (string concatenation)

// ✅ TypeScript - Compile error (caught before deployment!)
function addNumbers(a: number, b: number): number {
  return a + b;
}
addNumbers("5", 3);  // ERROR: Argument of type 'string' is not assignable to parameter of type 'number'
```

**Benefits:**
- Catch bugs before they reach users
- IDE autocomplete (IntelliSense)
- Self-documenting code
- Easier refactoring

---

### User Role Type

```typescript
export type UserRole = 'user' | 'dev' | 'admin';
```

**What is a "union type"?**
A type that can be one of several values. It's like an enum but lighter.

```typescript
// This works:
const myRole: UserRole = 'admin';  ✅

// This fails at compile time:
const badRole: UserRole = 'hacker';  ❌
// ERROR: Type '"hacker"' is not assignable to type 'UserRole'
```

**Alternative: Enum**
```typescript
enum UserRole {
  USER = 'user',
  DEV = 'dev',
  ADMIN = 'admin'
}
```
We chose union type because it's simpler and serializes cleanly to JSON.

---

### AuthContext Interface

```typescript
export interface AuthContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
  permissions: string[];
}
```

**What is an interface?**
A contract that describes the shape of an object. It's like a blueprint.

```typescript
// ✅ Valid AuthContext
const auth: AuthContext = {
  userId: 'user-123',
  tenantId: 'acme-corp',
  role: 'admin',
  email: 'admin@acme.com',
  permissions: ['users:write', 'cards:read']
};

// ❌ Missing required fields
const badAuth: AuthContext = {
  userId: 'user-123'
  // ERROR: Missing properties: tenantId, role, email, permissions
};
```

---

## Authorization Flow

### Step-by-Step Request Flow

Let's trace a request from start to finish:

#### Example: User tries to view admin panel

```
1. User clicks "Admin Dashboard" in UI
   ↓
2. Frontend sends GET request to /v1/admin/users
   Headers:
   {
     "Authorization": "Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
   }
   ↓
3. AWS API Gateway receives request
   - Extracts JWT token from Authorization header
   - Sends to Cognito for validation
   ↓
4. Cognito validates JWT
   - Check signature (was it really issued by us?)
   - Check expiration (is token still valid?)
   - Check revocation (did we blacklist this token?)
   ↓
5. If valid, Cognito extracts claims and attaches to request
   event.requestContext.authorizer.jwt.claims = {
     sub: "user-123",
     email: "john@acme.com",
     "custom:role": "user",
     "custom:tenantId": "acme-corp",
     exp: 1729012800
   }
   ↓
6. Lambda receives event with claims
   ↓
7. Authorization middleware runs:
   a. extractAuthContext(event)
      → Returns AuthContext object
   b. authorize(event, 'admin')
      → Checks if user role >= required role
      → User has role='user', required='admin'
      → DENIED!
   ↓
8. Return 403 Forbidden response
   {
     "success": false,
     "error": "Insufficient privileges. Required role: admin, user role: user"
   }
```

#### What if user WAS an admin?

```
7. Authorization middleware runs:
   b. authorize(event, 'admin')
      → User has role='admin', required='admin'
      → ALLOWED!
   ↓
8. Log audit entry:
   {
     tenantId: "acme-corp",
     userId: "user-123",
     role: "admin",
     action: "list_all_users",
     resource: "users",
     timestamp: "2025-10-15T14:30:00Z",
     success: true
   }
   ↓
9. Execute business logic (listAllUsers handler)
   - Query DynamoDB for all users in tenant
   - Return user list
   ↓
10. Return 200 OK response
    {
      "success": true,
      "data": {
        "users": [...],
        "count": 125
      }
    }
```

---

## JWT Token Deep Dive

### What is a JWT?

**JWT (JSON Web Token)** = A compact, URL-safe way to represent claims between two parties.

Structure: `header.payload.signature`

```
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9    ← Header (algorithm, type)
.
eyJzdWIiOiJ1c2VyLTEyMyIsImVtYWlsIjoi    ← Payload (claims/data)
am9obkBhY21lLmNvbSIsImN1c3RvbTpyb2xl
IjoiYWRtaW4iLCJleHAiOjE3MjkwMTI4MDB9
.
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_a    ← Signature (cryptographic proof)
dQssw5c
```

**Decoded Payload:**
```json
{
  "sub": "user-123",                    // Subject (user ID)
  "email": "john@acme.com",
  "custom:role": "admin",               // Custom claim (our addition)
  "custom:tenantId": "acme-corp",       // Custom claim
  "custom:permissions": "users:write,cards:read",
  "iss": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123",
  "exp": 1729012800,                    // Expiration timestamp
  "iat": 1729009200                     // Issued at timestamp
}
```

### Why JWTs are Secure

1. **Signature prevents tampering**
   - If attacker changes `role: 'user'` → `role: 'admin'`, signature breaks
   - Cognito detects invalid signature and rejects token

2. **Stateless authentication**
   - No need to look up session in database on every request
   - Token contains all necessary info
   - Faster, more scalable

3. **Time-limited**
   - `exp` claim = expiration timestamp
   - Old tokens automatically invalid
   - Limits damage from stolen tokens

### Custom Claims in Cognito

By default, Cognito includes standard claims (sub, email, etc). We add custom ones:

```typescript
// In CDK infrastructure code:
userPool.addCustomAttribute('role', {
  dataType: cognito.StringDataType,
  mutable: true  // Can be changed after user creation
});

userPool.addCustomAttribute('tenantId', {
  dataType: cognito.StringDataType,
  mutable: false  // Cannot be changed (security!)
});
```

**Why custom claims?**
- Avoid database lookup on every request
- JWT contains everything needed for authorization
- Claims are cryptographically signed (trustworthy)

---

## Role Hierarchy

### The Three Tiers

```typescript
const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 1,   // Lowest privilege
  dev: 2,    // Middle privilege
  admin: 3   // Highest privilege
};
```

### How Role Check Works

```typescript
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

// Examples:
hasRole('admin', 'user')   // true  (3 >= 1) ✅
hasRole('admin', 'dev')    // true  (3 >= 2) ✅
hasRole('admin', 'admin')  // true  (3 >= 3) ✅
hasRole('dev', 'admin')    // false (2 >= 3) ❌
hasRole('user', 'dev')     // false (1 >= 2) ❌
```

**Key insight:** Higher roles inherit lower role permissions!
- Admin can do everything dev + user can do
- Dev can do everything user can do
- User can only do user things

### Permission Matrix

| Resource        | User  | Dev   | Admin |
|----------------|-------|-------|-------|
| Own cards      | RW    | RW    | RWD   |
| Own transactions| RW    | RW    | RWD   |
| AI chat        | RW    | RW    | RWD   |
| System metrics | ❌    | R     | R     |
| Error logs     | ❌    | R     | RW    |
| User management| ❌    | ❌    | RWD   |
| Audit logs     | ❌    | ❌    | R     |
| All user data  | ❌    | ❌    | R     |

**Legend:** R=Read, W=Write, D=Delete, ❌=No access

---

## Database Schema

### Tenant Isolation Pattern

**Problem:** How do we store data for multiple tenants in one database?

**Solution:** Include tenantId in partition key

```typescript
// ❌ BAD: No tenant isolation
DynamoDB Item: {
  PK: "USER#user-123",
  SK: "METADATA",
  email: "john@acme.com",
  // Any user could query this if they knew the ID!
}

// ✅ GOOD: Tenant-isolated
DynamoDB Item: {
  PK: "TENANT#acme-corp#USER#user-123",  // Composite key
  SK: "METADATA",
  email: "john@acme.com",
  tenantId: "acme-corp",
  // Must know tenantId to query!
}
```

### Why This Works

```typescript
// User tries to access another tenant's data
const maliciousQuery = {
  TableName: 'tyche-users',
  KeyConditionExpression: 'PK = :pk',
  ExpressionAttributeValues: {
    ':pk': 'TENANT#other-company#USER#user-456'  // Different tenant!
  }
};

// Our middleware extracts tenantId from JWT (acme-corp)
// When building query, we ALWAYS use JWT's tenantId:
const secureQuery = {
  TableName: 'tyche-users',
  KeyConditionExpression: 'PK = :pk',
  ExpressionAttributeValues: {
    ':pk': `TENANT#${context.tenantId}#USER#${userId}`
    //              ^^^^^^^^^^^^^^^^^ From JWT (can't be faked)
  }
};

// Even if attacker modifies request, JWT's tenantId is cryptographically signed!
```

### Helper Functions

```typescript
// Create tenant-aware partition key
export function createTenantKey(
  tenantId: string,
  entityType: string,
  entityId: string
): string {
  return `TENANT#${tenantId}#${entityType}#${entityId}`;
}

// Usage:
const pk = createTenantKey('acme-corp', 'USER', 'user-123');
// Returns: "TENANT#acme-corp#USER#user-123"

const cardPk = createTenantKey('acme-corp', 'USER', 'user-123');
const cardSk = `CARD#${cardId}`;
// Query pattern: PK=TENANT#acme-corp#USER#user-123, SK begins_with CARD#
```

---

## Common Patterns

### Pattern 1: Authorize at Handler Start

```typescript
export async function listAllUsers(
  event: APIGatewayProxyEventV2,
  _userId?: string
): Promise<APIGatewayProxyResultV2> {
  // ALWAYS FIRST: Check authorization
  const auth = await authorize(event, 'admin');
  
  if (!auth.authorized) {
    return forbidden(auth.reason);  // 403 response
  }
  
  // Now safe to proceed
  const { user, context } = auth;
  
  // ... business logic ...
}
```

**Why this order?**
1. Fail fast (don't waste resources on unauthorized requests)
2. Clear security boundary
3. Consistent pattern across all handlers

### Pattern 2: Audit After Authorization

```typescript
const auth = await authorize(event, 'admin');

if (!auth.authorized) {
  // Log FAILED authorization attempt
  await logAuthorizationFailure(
    context.tenantId,
    context.userId,
    'list_all_users',
    'users',
    auth.reason
  );
  return forbidden(auth.reason);
}

// Log SUCCESSFUL access
await auditLog({
  tenantId: context.tenantId,
  userId: context.userId,
  role: context.role,
  action: 'list_all_users',
  resource: 'users',
  success: true
});
```

**Why log both?**
- Failed attempts = potential attack detection
- Successful access = compliance audit trail

### Pattern 3: Resource Ownership Check

```typescript
// User trying to update a credit card
export async function updateCard(event, userId) {
  const auth = await authorize(event, 'user');
  if (!auth.authorized) return forbidden(auth.reason);
  
  const cardId = event.pathParameters.cardId;
  
  // Fetch card from database
  const card = await getCard(auth.context.tenantId, userId, cardId);
  
  if (!card) {
    return notFound('Card not found');
  }
  
  // Check ownership
  if (card.userId !== auth.context.userId) {
    await auditLog({
      tenantId: auth.context.tenantId,
      userId: auth.context.userId,
      action: 'unauthorized_card_access',
      resource: 'cards',
      resourceId: cardId,
      success: false,
      errorMessage: 'Attempted to access another user\'s card'
    });
    return forbidden('You do not own this card');
  }
  
  // Now safe to update
  // ...
}
```

**Defense in depth:** Multiple layers of security!
1. JWT authentication (are you logged in?)
2. Role authorization (do you have permission?)
3. Tenant isolation (are you in the right organization?)
4. Resource ownership (is this YOUR data?)

---

## Security Best Practices

### 1. Never Trust Client Input

```typescript
// ❌ DANGER: Trusting client-provided tenantId
const body = JSON.parse(event.body);
const tenantId = body.tenantId;  // Attacker can modify this!

// ✅ SAFE: Always use JWT's tenantId
const auth = await authorize(event, 'user');
const tenantId = auth.context.tenantId;  // Cryptographically verified
```

### 2. Validate All Path Parameters

```typescript
const targetUserId = event.pathParameters?.userId;

if (!targetUserId) {
  return badRequest('User ID is required');
}

// Validate format (prevent injection attacks)
if (!/^[a-zA-Z0-9-_]+$/.test(targetUserId)) {
  return badRequest('Invalid user ID format');
}
```

### 3. Prevent Self-Harm

```typescript
// Don't let admin suspend their own account
if (targetUserId === context.userId) {
  return badRequest('Cannot suspend your own account');
}

// Don't let admin demote themselves
if (targetUserId === context.userId && newRole !== 'admin') {
  return badRequest('Cannot change your own admin role');
}
```

### 4. PCI DSS Compliance: Never Store Full Credit Card Numbers

**What is PCI DSS?**

PCI DSS (Payment Card Industry Data Security Standard) is a set of security requirements that **all companies handling credit card data must follow**. It was created by major card networks (Visa, Mastercard, American Express, Discover) to protect cardholder data.

**The Problem:**
If you store full credit card numbers and your database gets hacked, attackers can:
- Use the cards for fraudulent purchases
- Sell the card numbers on the dark web
- Cause massive financial damage to users
- Create huge legal liability for your company

**The Cost:**
- PCI DSS certification costs **$10,000-$50,000+ per year**
- Requires security audits, penetration testing, documentation
- Data breach fines can reach **millions of dollars**
- Legal fees and settlements from affected users
- Permanent reputation damage

**Tyche's Solution: Don't Store Sensitive Data**

```typescript
// ✅ WHAT WE STORE (Safe, PCI-compliant)
interface CreditCardAccount {
  network: CardNetwork;      // 'Visa' | 'Mastercard' | 'American Express' | 'Discover' | 'Other'
  lastFourDigits: string;    // '4532' - for display only
  balance: number;           // Current balance
  limit: number;             // Credit limit
  apr: number;               // Annual percentage rate
  // ... other account info
}

// ❌ WHAT WE NEVER STORE (Dangerous, PCI-scope)
// - Full card number (e.g., 4532-1234-5678-9012)
// - CVV security code (e.g., 123)
// - Expiration date (not needed for our calculations)
// - Card PIN
```

**Why This Works:**

1. **Identification**: Last 4 digits + network name is enough for users to recognize their cards
   - "Your Visa ending in 4532"
   - "Your Mastercard ending in 8765"

2. **Optimization**: We only need balance, limit, and APR to calculate optimal payoff strategies
   - No need for full card number to run the math
   - Can still provide accurate debt-free dates

3. **Zero Liability**: If hackers steal our database, they get:
   - Network name (useless for fraud)
   - Last 4 digits (can't make purchases with just this)
   - Account balances (not sensitive payment info)
   - **Result: No usable payment card data = no fraud possible**

**Validation Enforcement:**

```typescript
// services/api/src/handlers/cards.ts
export async function createCard(event, userId?) {
  const { network, lastFourDigits, ...rest } = parseBody(event);
  
  // ✅ Validate network is known type
  const validNetworks: CardNetwork[] = ['Visa', 'Mastercard', 'American Express', 'Discover', 'Other'];
  if (!validNetworks.includes(network)) {
    return badRequest(`Invalid network. Must be one of: ${validNetworks.join(', ')}`);
  }
  
  // ✅ Validate exactly 4 digits
  if (!/^\d{4}$/.test(lastFourDigits)) {
    return badRequest('lastFourDigits must be exactly 4 digits');
  }
  
  // 🔒 Security check: Reject suspiciously long strings
  if (lastFourDigits.length > 4) {
    console.error(`[SECURITY] Attempt to store more than 4 digits. userId=${userId}`);
    return badRequest('Security error: Only last 4 digits allowed');
  }
  
  // Safe to store
  await db.put({
    TableName: 'tyche-credit-cards',
    Item: {
      id: generateId(),
      userId,
      network,
      lastFourDigits,
      ...rest,
      createdAt: new Date().toISOString()
    }
  });
  
  // Log with privacy protection
  console.log(`[CreateCard] userId=${userId} network=${network} lastFour=****${lastFourDigits}`);
}
```

**Real-World Example:**

Imagine two scenarios:

**Scenario A: Storing Full Card Numbers (Bad)**
```
Database gets hacked
→ Attackers steal:
  - Full card number: 4532-1234-5678-9012
  - CVV: 123
  - Expiration: 12/2027
→ Attackers make fraudulent purchases
→ Users lose money
→ Company faces lawsuits
→ Company goes bankrupt

Cost: Millions in damages + criminal liability
```

**Scenario B: Storing Only Last 4 Digits (Good)**
```
Database gets hacked
→ Attackers steal:
  - Network: Visa
  - Last 4 digits: 4532
  - Balance: $5,000
→ Attackers can't make purchases (missing full number + CVV)
→ Users are safe
→ Company reports breach, no financial impact
→ Company continues operating

Cost: Minor reputational hit, zero financial liability
```

**Trade-offs:**

**What We Lose:**
- ❌ Can't automatically import transactions (don't have full card number to link)
- ❌ Users must manually enter balances (can't fetch from banks)
- ❌ No automatic payment scheduling (can't charge cards)

**What We Gain:**
- ✅ Zero PCI DSS compliance cost ($0 vs. $50,000/year)
- ✅ No security audits required
- ✅ No data breach liability
- ✅ Users trust us with their data
- ✅ Can focus on building features, not security bureaucracy
- ✅ Faster development (no compliance red tape)

**Key Lesson:**

> **Security by Minimization**: The best way to protect sensitive data is to never collect it in the first place. If you don't have it, it can't be stolen.

This is called "defense in depth" - even if every other security layer fails (firewall, authentication, encryption), there's still no usable data to steal.

**Further Reading:**
- [PCI DSS Official Site](https://www.pcisecuritystandards.org/)
- [OWASP Top 10 - Sensitive Data Exposure](https://owasp.org/Top10/)
- [Stripe's approach to PCI compliance](https://stripe.com/guides/pci-compliance)

### 5. Rate Limiting (TODO)

```typescript
// Check rate limit before expensive operations
const rateLimitKey = `rate_limit:${context.userId}:${action}`;
const count = await redis.incr(rateLimitKey);

if (count > 100) {  // 100 requests per minute
  return response(429, { error: 'Rate limit exceeded' });
}

await redis.expire(rateLimitKey, 60);  // Reset after 1 minute
```

### 6. Sensitive Data Redaction

```typescript
// Don't include sensitive data in audit logs
await auditLog({
  userId: context.userId,
  action: 'update_card',
  resource: 'cards',
  details: {
    cardId: card.id,
    fieldsUpdated: ['name', 'limit'],
    // ❌ DON'T: creditCardNumber: card.number
  }
});
```

---

## Debugging Tips

### 1. Enable Verbose Logging

```typescript
// In development, log JWT claims
if (process.env.NODE_ENV === 'development') {
  console.log('[AUTH] JWT Claims:', JSON.stringify(claims, null, 2));
}
```

### 2. Test with Mock Events

```typescript
// Create test event with mock JWT claims
const testEvent = {
  requestContext: {
    authorizer: {
      jwt: {
        claims: {
          sub: 'test-user-123',
          email: 'test@example.com',
          'custom:role': 'admin',
          'custom:tenantId': 'test-tenant'
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
const auth = await authorize(testEvent, 'admin');
console.log('Authorized:', auth.authorized);
```

### 3. Use AWS CloudWatch Insights

```sql
-- Query audit logs for suspicious activity
fields @timestamp, userId, action, success
| filter success = false
| filter action like /admin/
| stats count() by userId, action
| sort count desc
```

---

## Next Steps

1. ✅ Understand the types
2. ✅ Understand authorization flow
3. 🔄 Implement CDK changes (add custom attributes to Cognito)
4. 🔄 Wire up real DynamoDB queries
5. 🔄 Add rate limiting
6. 🔄 Build frontend admin UI
7. 🔄 Write integration tests

---

## Questions to Test Your Understanding

1. What happens if an attacker modifies their JWT's `custom:role` claim from 'user' to 'admin'?
   <details>
   <summary>Answer</summary>
   The signature verification fails at AWS API Gateway level. The modified token is rejected before it even reaches our Lambda function.
   </details>

2. Why do we use `ROLE_HIERARCHY` numbers instead of just comparing strings?
   <details>
   <summary>Answer</summary>
   Numbers allow easy "greater than or equal to" checks. Admin (3) >= Dev (2) means admin can access dev endpoints. String comparison wouldn't work ('admin' < 'dev' alphabetically!).
   </details>

3. What's the difference between `User` and `AuthContext` interfaces?
   <details>
   <summary>Answer</summary>
   `User` is the full database record (heavy). `AuthContext` is lightweight auth info extracted from JWT (fast, no DB lookup needed).
   </details>

4. Why include `tenantId` in DynamoDB partition keys?
   <details>
   <summary>Answer</summary>
   Row-level isolation. Even if query logic has a bug, DynamoDB physically separates data by partition key. Can't accidentally fetch wrong tenant's data.
   </details>

5. What's the purpose of audit logging?
   <details>
   <summary>Answer</summary>
   Security (detect attacks), compliance (legal requirements), debugging (troubleshoot issues), trust (transparency with users).
   </details>

---

**Keep learning!** Security is layered - every check matters. 🔒
