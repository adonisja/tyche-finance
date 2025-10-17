# Tyche Finance - Multi-Tenancy Architecture

> Comprehensive guide to Tyche's multi-tenant architecture with role-based access control (RBAC) for admin/dev and regular users.

**Last Updated**: October 15, 2025  
**Version**: 0.1.0  
**Status**: Implementation Guide

---

## Table of Contents

1. [Multi-Tenancy Overview](#multi-tenancy-overview)
2. [Tenant Isolation Strategy](#tenant-isolation-strategy)
3. [Role-Based Access Control](#role-based-access-control)
4. [Data Model](#data-model)
5. [Authentication & Authorization](#authentication--authorization)
6. [API Endpoints by Role](#api-endpoints-by-role)
7. [Database Design](#database-design)
8. [Implementation Guide](#implementation-guide)
9. [Security Considerations](#security-considerations)
10. [Monitoring & Analytics](#monitoring--analytics)

---

## Multi-Tenancy Overview

### What is Multi-Tenancy?

**Multi-tenancy** is an architecture where a single instance of software serves multiple customers (tenants). In Tyche Finance:

- **Tenant** = Organization or customer account
- **Regular Users** = End users managing their personal finances
- **Admin/Dev Users** = Platform administrators and developers with elevated privileges

### Tenancy Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Tyche Finance Platform                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Tenant: "personal" (Individual Users)                │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │  │
│  │  │ User 1     │  │ User 2     │  │ User 3     │     │  │
│  │  │ role: user │  │ role: user │  │ role: user │     │  │
│  │  └────────────┘  └────────────┘  └────────────┘     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Tenant: "tyche-platform" (Platform Team)             │  │
│  │  ┌────────────┐  ┌────────────┐                      │  │
│  │  │ Admin 1    │  │ Developer 1│                      │  │
│  │  │ role: admin│  │ role: dev  │                      │  │
│  │  └────────────┘  └────────────┘                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Tenant: "acme-corp" (Enterprise - Future)            │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐     │  │
│  │  │ Employee 1 │  │ Employee 2 │  │ Manager    │     │  │
│  │  │ role: user │  │ role: user │  │ role: admin│     │  │
│  │  └────────────┘  └────────────┘  └────────────┘     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Key Principles

1. **Data Isolation**: Each tenant's data is logically separated
2. **Shared Infrastructure**: All tenants use the same Lambda/DynamoDB/S3
3. **Role-Based Access**: Users have different permissions based on role
4. **Scalability**: Add new tenants without infrastructure changes

---

## Tenant Isolation Strategy

### Isolation Models

| Model | Description | Our Choice |
|-------|-------------|------------|
| **Database per Tenant** | Separate DynamoDB table per tenant | ❌ Too expensive |
| **Schema per Tenant** | Separate schema in same DB | ❌ DynamoDB doesn't support schemas |
| **Row-Level Isolation** | Filter all queries by tenantId | ✅ **Selected** |

### Row-Level Isolation Implementation

Every DynamoDB item includes `tenantId`:

```typescript
// Users Table
{
  PK: 'TENANT#personal#USER#user-123',
  SK: 'METADATA',
  tenantId: 'personal',
  userId: 'user-123',
  email: 'john@example.com',
  role: 'user'
}

// Credit Cards Table
{
  PK: 'TENANT#personal#USER#user-123',
  SK: 'CARD#card-456',
  tenantId: 'personal',
  userId: 'user-123',
  cardId: 'card-456',
  name: 'Chase Sapphire'
}
```

**Query Pattern**:
```typescript
// CRITICAL: Always filter by tenantId AND userId
const cards = await db.query({
  KeyConditionExpression: 'PK = :pk',
  ExpressionAttributeValues: {
    ':pk': `TENANT#${tenantId}#USER#${userId}`
  }
});
```

**Security Rule**: 🔒 **Never allow cross-tenant data access**

---

## Role-Based Access Control

### Role Hierarchy

```
Admin (Full Access)
  │
  ├─> View all users
  ├─> View all transactions
  ├─> Modify system settings
  ├─> Access audit logs
  ├─> Run analytics queries
  └─> Impersonate users (with logging)

Dev (Read Access + Debugging)
  │
  ├─> View system metrics
  ├─> Run test transactions
  ├─> Access error logs
  ├─> Test AI models
  └─> View anonymized user data

User (Self-Service Only)
  │
  ├─> Manage own credit cards
  ├─> View own transactions
  ├─> Simulate debt payoff
  ├─> Chat with AI
  └─> Upload documents
```

### Role Definitions

```typescript
// packages/types/src/index.ts
export type UserRole = 'user' | 'dev' | 'admin';

export interface User {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  lastLogin?: string;
  permissions?: string[];  // Optional fine-grained permissions
}

export interface RolePermissions {
  role: UserRole;
  permissions: Permission[];
}

export interface Permission {
  resource: string;      // 'users', 'cards', 'transactions', 'system'
  actions: Action[];     // 'read', 'write', 'delete', 'admin'
  scope: 'own' | 'tenant' | 'all';
}

export type Action = 'read' | 'write' | 'delete' | 'admin';
```

### Permission Matrix

| Resource | User | Dev | Admin |
|----------|------|-----|-------|
| **Credit Cards** |
| View own cards | ✅ | ✅ | ✅ |
| View all cards in tenant | ❌ | ❌ | ✅ |
| View all cards (cross-tenant) | ❌ | ❌ | ✅ |
| Create/update/delete own | ✅ | ✅ | ✅ |
| Create/update/delete others | ❌ | ❌ | ✅ |
| **Transactions** |
| View own transactions | ✅ | ✅ | ✅ |
| View tenant transactions | ❌ | ✅ (anonymized) | ✅ |
| View all transactions | ❌ | ❌ | ✅ |
| **AI Chat** |
| Chat with AI | ✅ | ✅ | ✅ |
| View own chat history | ✅ | ✅ | ✅ |
| View all chat history | ❌ | ❌ | ✅ |
| Change AI model | ❌ | ✅ | ✅ |
| **System** |
| View metrics | ❌ | ✅ | ✅ |
| View logs | ❌ | ✅ | ✅ |
| Modify settings | ❌ | ❌ | ✅ |
| Manage users | ❌ | ❌ | ✅ |

---

## Data Model

### DynamoDB Table Design

#### Users Table (`tyche-users`)

```typescript
{
  PK: 'TENANT#<tenantId>#USER#<userId>',
  SK: 'METADATA',
  
  // Identity
  tenantId: string;
  userId: string;
  email: string;
  name: string;
  
  // Authorization
  role: 'user' | 'dev' | 'admin';
  permissions: string[];  // ['cards:write', 'transactions:read']
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  lastLogin: string;
  
  // Settings
  preferences: {
    currency: 'USD' | 'EUR' | 'GBP';
    theme: 'light' | 'dark';
    notifications: boolean;
  };
  
  // Admin fields
  isActive: boolean;
  isSuspended: boolean;
  suspendedReason?: string;
}

// GSI: EmailIndex (for login lookup)
{
  PK_GSI: 'EMAIL#<email>',
  SK_GSI: 'TENANT#<tenantId>'
}

// GSI: RoleIndex (for admin queries)
{
  PK_GSI2: 'TENANT#<tenantId>#ROLE#<role>',
  SK_GSI2: 'USER#<userId>'
}
```

#### Transactions Table (`tyche-transactions`)

```typescript
{
  PK: 'TENANT#<tenantId>#USER#<userId>',
  SK: 'TXN#<transactionId>',
  
  // Tenant isolation
  tenantId: string;
  userId: string;
  
  // Transaction data
  transactionId: string;
  date: string;
  amount: number;
  description: string;
  category: string;
  merchant?: string;
  
  // Classification
  priority: 'essential' | 'nice-to-have' | 'luxury';
  isRecurring: boolean;
  
  // Metadata
  createdAt: string;
  source: 'manual' | 'csv' | 'ocr' | 'api';
}

// GSI: DateIndex (for time-range queries)
{
  PK_GSI: 'TENANT#<tenantId>#USER#<userId>',
  SK_GSI: 'DATE#<date>'
}
```

#### Credit Cards Table (`tyche-credit-cards`)

```typescript
{
  PK: 'TENANT#<tenantId>#USER#<userId>',
  SK: 'CARD#<cardId>',
  
  // Tenant isolation
  tenantId: string;
  userId: string;
  
  // Card data
  cardId: string;
  name: string;
  lastFourDigits?: string;
  balance: number;
  limit: number;
  apr: number;
  minPayment: number;
  dueDayOfMonth: number;
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}
```

#### Audit Logs Table (`tyche-audit-logs`) - New

```typescript
{
  PK: 'TENANT#<tenantId>',
  SK: 'LOG#<timestamp>#<logId>',
  
  // Context
  tenantId: string;
  userId: string;
  role: string;
  
  // Action
  action: string;           // 'view_user', 'delete_card', 'change_role'
  resource: string;         // 'users', 'cards', 'transactions'
  resourceId?: string;      // Specific resource ID
  
  // Details
  timestamp: string;
  ip: string;
  userAgent: string;
  
  // Result
  success: boolean;
  errorMessage?: string;
  
  // Sensitive actions
  impersonated?: boolean;   // If admin impersonated user
  targetUserId?: string;    // User being acted upon
}
```

---

## Authentication & Authorization

### JWT Token Structure

```typescript
// Cognito JWT claims
interface TokenClaims {
  sub: string;              // userId
  email: string;
  'cognito:groups': string[]; // ['admin', 'dev', 'user']
  'custom:tenantId': string;
  'custom:role': UserRole;
  iat: number;
  exp: number;
}
```

### Authorization Middleware

```typescript
// services/api/src/middleware/authorize.ts
export function authorize(requiredRole: UserRole, requiredPermission?: string) {
  return async (
    event: APIGatewayProxyEvent,
    userId?: string
  ): Promise<{ authorized: boolean; user?: User }> => {
    if (!userId) {
      return { authorized: false };
    }
    
    // Extract user from JWT
    const claims = event.requestContext.authorizer?.claims;
    const userRole = claims?.['custom:role'] as UserRole;
    const tenantId = claims?.['custom:tenantId'];
    
    // Fetch full user from DB
    const user = await getUser(tenantId, userId);
    if (!user || !user.isActive) {
      return { authorized: false };
    }
    
    // Check role hierarchy
    const roleLevel = { user: 1, dev: 2, admin: 3 };
    if (roleLevel[user.role] < roleLevel[requiredRole]) {
      console.log(`User ${userId} (${user.role}) lacks required role ${requiredRole}`);
      return { authorized: false };
    }
    
    // Check specific permission if required
    if (requiredPermission && !hasPermission(user, requiredPermission)) {
      console.log(`User ${userId} lacks permission ${requiredPermission}`);
      return { authorized: false };
    }
    
    return { authorized: true, user };
  };
}

function hasPermission(user: User, permission: string): boolean {
  // Admin has all permissions
  if (user.role === 'admin') return true;
  
  // Check user's permission array
  return user.permissions?.includes(permission) || false;
}
```

### Usage in Handlers

```typescript
// services/api/src/handlers/admin/users.ts
export async function getAllUsers(
  event: APIGatewayProxyEvent,
  userId?: string
): Promise<APIGatewayProxyResult> {
  // Check authorization
  const { authorized, user } = await authorize('admin')(event, userId);
  if (!authorized) {
    return forbidden('Admin access required');
  }
  
  // Admin can view all users in their tenant
  const users = await db.query({
    TableName: 'tyche-users',
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${user.tenantId}`
    }
  });
  
  // Log admin action
  await auditLog({
    tenantId: user.tenantId,
    userId: user.userId,
    action: 'view_all_users',
    resource: 'users',
    success: true
  });
  
  return ok({ users: users.Items });
}
```

---

## API Endpoints by Role

### Public Endpoints (No Auth)

```typescript
GET  /public/health         - Health check
POST /public/signup         - User registration
POST /public/login          - Authentication
```

### User Endpoints (role: user)

```typescript
// Credit Cards
GET    /v1/cards                    - Get my cards
POST   /v1/cards                    - Add card
PUT    /v1/cards/{cardId}           - Update my card
DELETE /v1/cards/{cardId}           - Delete my card

// Transactions
GET    /v1/transactions             - Get my transactions
POST   /v1/transactions             - Add transaction
GET    /v1/transactions/search      - Search my transactions

// AI & Simulations
POST   /v1/payoff/simulate          - Simulate debt payoff
POST   /v1/chat                     - Chat with AI
GET    /v1/chat/history             - My chat history

// File Uploads
POST   /v1/upload/presigned         - Get presigned S3 URL
POST   /v1/upload/process           - Process uploaded file

// Profile
GET    /v1/profile                  - Get my profile
PUT    /v1/profile                  - Update my profile
```

### Dev Endpoints (role: dev)

All user endpoints PLUS:

```typescript
// System Monitoring
GET    /v1/dev/metrics              - System metrics
GET    /v1/dev/logs                 - Error logs (last 24h)
GET    /v1/dev/health/detailed      - Detailed health check

// Testing
POST   /v1/dev/test/ai              - Test AI provider
POST   /v1/dev/test/payoff          - Test payoff simulation

// Data (Anonymized)
GET    /v1/dev/analytics/usage      - Usage statistics
GET    /v1/dev/analytics/costs      - AI API costs

// Model Management
GET    /v1/dev/ai/models            - List available AI models
POST   /v1/dev/ai/switch            - Switch AI model for testing
```

### Admin Endpoints (role: admin)

All user + dev endpoints PLUS:

```typescript
// User Management
GET    /v1/admin/users              - List all users
GET    /v1/admin/users/{userId}     - View user details
PUT    /v1/admin/users/{userId}/role - Change user role
POST   /v1/admin/users/{userId}/suspend - Suspend user
POST   /v1/admin/users/{userId}/activate - Activate user
DELETE /v1/admin/users/{userId}     - Delete user

// Data Management
GET    /v1/admin/cards/all          - View all credit cards
GET    /v1/admin/transactions/all   - View all transactions
POST   /v1/admin/data/export        - Export tenant data

// System Configuration
GET    /v1/admin/settings           - View system settings
PUT    /v1/admin/settings           - Update system settings
GET    /v1/admin/features           - Feature flags

// Audit & Compliance
GET    /v1/admin/audit-logs         - View audit logs
GET    /v1/admin/reports/activity   - User activity report
GET    /v1/admin/reports/security   - Security report

// Impersonation (with audit logging)
POST   /v1/admin/impersonate/{userId} - Impersonate user
POST   /v1/admin/impersonate/stop   - Stop impersonation
```

---

## Database Design

### Query Patterns by Role

#### User Queries (Restricted to Own Data)

```typescript
// Get user's credit cards
async function getUserCards(tenantId: string, userId: string) {
  return await db.query({
    TableName: 'tyche-credit-cards',
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#USER#${userId}`
    }
  });
}
```

#### Dev Queries (Anonymized Data)

```typescript
// Get transaction counts by category (anonymized)
async function getTransactionStats(tenantId: string) {
  // For devs, return aggregated data without personal info
  const transactions = await db.query({
    TableName: 'tyche-transactions',
    KeyConditionExpression: 'PK BEGINS_WITH :pk',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}`
    }
  });
  
  // Aggregate by category (no user IDs returned)
  const stats = transactions.Items.reduce((acc, txn) => {
    acc[txn.category] = (acc[txn.category] || 0) + 1;
    return acc;
  }, {});
  
  return stats;
}
```

#### Admin Queries (Full Access)

```typescript
// Get all users in tenant with role
async function getUsersByRole(tenantId: string, role: UserRole) {
  return await db.query({
    TableName: 'tyche-users',
    IndexName: 'RoleIndex',
    KeyConditionExpression: 'PK_GSI2 = :pk',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#ROLE#${role}`
    }
  });
}

// View any user's credit cards (admin only)
async function getAnyUserCards(tenantId: string, targetUserId: string, adminUserId: string) {
  // Log admin access
  await auditLog({
    tenantId,
    userId: adminUserId,
    action: 'view_user_cards',
    resource: 'cards',
    targetUserId,
    success: true
  });
  
  return await db.query({
    TableName: 'tyche-credit-cards',
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${tenantId}#USER#${targetUserId}`
    }
  });
}
```

---

## Implementation Guide

### Step 1: Update TypeScript Types

```typescript
// packages/types/src/index.ts

export type UserRole = 'user' | 'dev' | 'admin';

export interface User {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthContext {
  userId: string;
  tenantId: string;
  role: UserRole;
  email: string;
}
```

### Step 2: Add Authorization Middleware

```typescript
// services/api/src/middleware/authorize.ts
import { APIGatewayProxyEvent } from 'aws-lambda';
import { User, UserRole } from '@tyche/types';

export async function authorize(
  event: APIGatewayProxyEvent,
  requiredRole: UserRole
): Promise<{ authorized: boolean; user?: User }> {
  const claims = event.requestContext.authorizer?.claims;
  if (!claims) {
    return { authorized: false };
  }
  
  const userId = claims.sub;
  const userRole = claims['custom:role'] as UserRole;
  const tenantId = claims['custom:tenantId'];
  
  const roleHierarchy = { user: 1, dev: 2, admin: 3 };
  
  if (roleHierarchy[userRole] < roleHierarchy[requiredRole]) {
    return { authorized: false };
  }
  
  const user: User = {
    userId,
    tenantId,
    role: userRole,
    email: claims.email,
    // Fetch full user from DB if needed
  };
  
  return { authorized: true, user };
}
```

### Step 3: Create Admin Handlers

```typescript
// services/api/src/handlers/admin/users.ts
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { authorize } from '../../middleware/authorize';
import { ok, forbidden, notFound } from '../../utils';

export async function listAllUsers(
  event: APIGatewayProxyEvent,
  userId?: string
): Promise<APIGatewayProxyResult> {
  const { authorized, user } = await authorize(event, 'admin');
  
  if (!authorized) {
    return forbidden('Admin access required');
  }
  
  // Query all users in tenant
  const users = await db.query({
    TableName: 'tyche-users',
    KeyConditionExpression: 'PK BEGINS_WITH :pk',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${user.tenantId}`
    }
  });
  
  return ok({ users: users.Items, count: users.Items.length });
}

export async function changeUserRole(
  event: APIGatewayProxyEvent,
  userId?: string
): Promise<APIGatewayProxyResult> {
  const { authorized, user } = await authorize(event, 'admin');
  
  if (!authorized) {
    return forbidden('Admin access required');
  }
  
  const { targetUserId } = event.pathParameters;
  const { newRole } = JSON.parse(event.body || '{}');
  
  if (!['user', 'dev', 'admin'].includes(newRole)) {
    return badRequest('Invalid role');
  }
  
  // Update user role
  await db.update({
    TableName: 'tyche-users',
    Key: {
      PK: `TENANT#${user.tenantId}#USER#${targetUserId}`,
      SK: 'METADATA'
    },
    UpdateExpression: 'SET #role = :role, updatedAt = :now',
    ExpressionAttributeNames: { '#role': 'role' },
    ExpressionAttributeValues: {
      ':role': newRole,
      ':now': new Date().toISOString()
    }
  });
  
  // Audit log
  await auditLog({
    tenantId: user.tenantId,
    userId: user.userId,
    action: 'change_user_role',
    resource: 'users',
    targetUserId,
    details: { oldRole: 'user', newRole },
    success: true
  });
  
  return ok({ message: `User role updated to ${newRole}` });
}
```

### Step 4: Update CDK Stack

```typescript
// infrastructure/lib/tyche-stack.ts

// Add custom attributes to Cognito User Pool
const userPool = new cognito.UserPool(this, 'TycheUserPool', {
  userPoolName: 'tyche-users',
  customAttributes: {
    tenantId: new cognito.StringAttribute({ mutable: false }),
    role: new cognito.StringAttribute({ mutable: true })
  },
  // ... rest of config
});

// Create admin group
const adminGroup = new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
  groupName: 'admin',
  userPoolId: userPool.userPoolId,
  description: 'Platform administrators'
});

const devGroup = new cognito.CfnUserPoolGroup(this, 'DevGroup', {
  groupName: 'dev',
  userPoolId: userPool.userPoolId,
  description: 'Developers'
});

// Create audit logs table
const auditLogsTable = new dynamodb.Table(this, 'AuditLogsTable', {
  tableName: 'tyche-audit-logs',
  partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  timeToLiveAttribute: 'ttl',  // Auto-delete logs after 90 days
  pointInTimeRecovery: true
});

// Grant Lambda access
auditLogsTable.grantReadWriteData(apiLambda);
```

### Step 5: Add Audit Logging

```typescript
// services/api/src/utils/audit.ts
interface AuditLogEntry {
  tenantId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  targetUserId?: string;
  details?: any;
  success: boolean;
  errorMessage?: string;
}

export async function auditLog(entry: AuditLogEntry): Promise<void> {
  const timestamp = new Date().toISOString();
  const logId = `${timestamp}_${Math.random().toString(36).substring(7)}`;
  
  await db.put({
    TableName: 'tyche-audit-logs',
    Item: {
      PK: `TENANT#${entry.tenantId}`,
      SK: `LOG#${timestamp}#${logId}`,
      ...entry,
      timestamp,
      ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60  // 90 days
    }
  });
  
  // Also log to CloudWatch for monitoring
  console.log('[AUDIT]', JSON.stringify(entry));
}
```

---

## Security Considerations

### 1. Prevent Cross-Tenant Access

```typescript
// CRITICAL: Always validate tenantId matches
async function getCard(tenantId: string, userId: string, cardId: string) {
  const result = await db.get({
    TableName: 'tyche-credit-cards',
    Key: {
      PK: `TENANT#${tenantId}#USER#${userId}`,
      SK: `CARD#${cardId}`
    }
  });
  
  // Double-check tenantId matches (defense in depth)
  if (result.Item && result.Item.tenantId !== tenantId) {
    throw new Error('Cross-tenant access attempt detected');
  }
  
  return result.Item;
}
```

### 2. Admin Impersonation Safety

```typescript
// services/api/src/handlers/admin/impersonate.ts
export async function impersonateUser(
  event: APIGatewayProxyEvent,
  adminUserId?: string
): Promise<APIGatewayProxyResult> {
  const { authorized, user } = await authorize(event, 'admin');
  
  if (!authorized) {
    return forbidden('Admin access required');
  }
  
  const { targetUserId } = JSON.parse(event.body || '{}');
  
  // Generate impersonation token (limited permissions, short-lived)
  const impersonationToken = await generateToken({
    userId: targetUserId,
    tenantId: user.tenantId,
    role: 'user',  // Always impersonate as 'user', never 'admin'
    impersonatedBy: adminUserId,
    expiresIn: 900  // 15 minutes max
  });
  
  // Audit log (CRITICAL for compliance)
  await auditLog({
    tenantId: user.tenantId,
    userId: adminUserId,
    action: 'impersonate_user',
    resource: 'users',
    targetUserId,
    impersonated: true,
    success: true
  });
  
  return ok({
    token: impersonationToken,
    expiresIn: 900,
    warning: 'Impersonation is logged and audited'
  });
}
```

### 3. Rate Limiting by Role

```typescript
// services/api/src/middleware/rateLimit.ts
const rateLimits = {
  user: { requests: 100, window: 60 },    // 100 req/min
  dev: { requests: 500, window: 60 },     // 500 req/min
  admin: { requests: 1000, window: 60 }   // 1000 req/min
};

export async function checkRateLimit(
  userId: string,
  role: UserRole
): Promise<boolean> {
  const key = `ratelimit:${userId}:${Math.floor(Date.now() / (rateLimits[role].window * 1000))}`;
  
  const count = await redis.incr(key);
  await redis.expire(key, rateLimits[role].window);
  
  return count <= rateLimits[role].requests;
}
```

---

## Monitoring & Analytics

### Admin Dashboard Metrics

```typescript
// services/api/src/handlers/admin/analytics.ts
export async function getDashboardMetrics(
  event: APIGatewayProxyEvent,
  userId?: string
): Promise<APIGatewayProxyResult> {
  const { authorized, user } = await authorize(event, 'admin');
  
  if (!authorized) return forbidden('Admin access required');
  
  const metrics = {
    users: {
      total: await countUsers(user.tenantId),
      active: await countActiveUsers(user.tenantId, 7),  // Last 7 days
      byRole: await getUserCountByRole(user.tenantId)
    },
    transactions: {
      total: await countTransactions(user.tenantId),
      thisMonth: await countTransactionsThisMonth(user.tenantId),
      totalVolume: await sumTransactionVolume(user.tenantId)
    },
    ai: {
      totalRequests: await countAIRequests(user.tenantId),
      tokenUsage: await sumTokenUsage(user.tenantId),
      estimatedCost: await calculateAICost(user.tenantId)
    },
    system: {
      apiLatencyP50: await getMetric('ApiLatencyP50'),
      apiLatencyP99: await getMetric('ApiLatencyP99'),
      errorRate: await getMetric('ErrorRate'),
      lambdaColdStarts: await getMetric('ColdStarts')
    }
  };
  
  return ok(metrics);
}
```

### Audit Log Queries

```typescript
export async function getAuditLogs(
  event: APIGatewayProxyEvent,
  userId?: string
): Promise<APIGatewayProxyResult> {
  const { authorized, user } = await authorize(event, 'admin');
  
  if (!authorized) return forbidden('Admin access required');
  
  const { startDate, endDate, action, targetUserId } = event.queryStringParameters || {};
  
  const logs = await db.query({
    TableName: 'tyche-audit-logs',
    KeyConditionExpression: 'PK = :pk AND SK BETWEEN :start AND :end',
    ExpressionAttributeValues: {
      ':pk': `TENANT#${user.tenantId}`,
      ':start': `LOG#${startDate || '2000-01-01'}`,
      ':end': `LOG#${endDate || '2099-12-31'}`
    }
  });
  
  let filtered = logs.Items;
  
  if (action) {
    filtered = filtered.filter(log => log.action === action);
  }
  
  if (targetUserId) {
    filtered = filtered.filter(log => log.targetUserId === targetUserId);
  }
  
  return ok({ logs: filtered, count: filtered.length });
}
```

---

## Summary

Tyche Finance's multi-tenancy architecture provides:

✅ **Data Isolation**: Row-level security with tenantId filtering  
✅ **Role-Based Access**: User, Dev, Admin with clear permission boundaries  
✅ **Audit Logging**: Complete trail of admin actions  
✅ **Scalability**: Add tenants without infrastructure changes  
✅ **Security**: Defense-in-depth with multiple validation layers  

**Implementation Checklist**:

- [ ] Update TypeScript types with User, UserRole, AuthContext
- [ ] Add authorize() middleware to all handlers
- [ ] Create admin handlers (user management, analytics)
- [ ] Add tenantId to all DynamoDB items
- [ ] Update CDK stack with custom Cognito attributes
- [ ] Create audit logs table
- [ ] Implement audit logging utility
- [ ] Add admin routes to API router
- [ ] Update frontend with role-based UI
- [ ] Deploy and test with different user roles

**Next Steps**:

1. Implement authorization middleware
2. Create admin handlers
3. Update database schema with tenantId
4. Deploy Cognito changes
5. Test with admin/dev/user accounts

---

**Document Status**: Implementation guide - ready for development

**Last Updated**: October 15, 2025
