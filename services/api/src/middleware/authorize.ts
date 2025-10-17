/**
 * Authorization Middleware
 * 
 * Provides role-based access control (RBAC) for API endpoints.
 * Validates JWT claims, checks user roles, and enforces permissions.
 */

import { APIGatewayProxyEventV2, APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import type { User, UserRole, AuthContext } from '@tyche/types';

// Type alias for the event we use (can be either with or without JWT at runtime)
type Event = APIGatewayProxyEventV2 | APIGatewayProxyEventV2WithJWTAuthorizer;

/**
 * Role hierarchy levels (higher number = more privileges)
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 1,
  dev: 2,
  admin: 3
};

/**
 * Authorization result
 */
export interface AuthorizationResult {
  authorized: boolean;
  user?: User;
  context?: AuthContext;
  reason?: string;
}

/**
 * Extract authentication context from API Gateway event
 * 
 * 📚 EXPLANATION:
 * This function reads the JWT token that AWS Cognito attached to the request.
 * The JWT contains "claims" (pieces of information) about the user:
 * - sub: User ID (unique identifier)
 * - email: User's email
 * - cognito:groups: Array of groups user belongs to (NEW!)
 * - custom:tenantId: Which "tenant" (organization) they belong to
 * - custom:permissions: What actions they're allowed to do
 * 
 * � MIGRATION NOTE:
 * We now use Cognito Groups instead of custom:role attribute.
 * Priority: Admins > DevTeam > Users (default)
 * 
 * �🔍 TypeScript Trick:
 * We use "type assertion" (as APIGatewayProxyEventV2WithJWTAuthorizer) to tell
 * TypeScript "trust me, the authorizer property will exist at runtime".
 * API Gateway adds it before Lambda execution.
 */
export function extractAuthContext(event: Event): AuthContext | null {
  // Type assertion: Tell TypeScript the authorizer exists
  // This is safe because API Gateway adds it before calling our Lambda
  const authEvent = event as APIGatewayProxyEventV2WithJWTAuthorizer;
  const claims = authEvent.requestContext?.authorizer?.jwt?.claims;
  
  if (!claims) {
    return null;
  }
  
  // Extract from JWT claims
  const userId = claims.sub as string;
  const email = claims.email as string;
  const tenantId = (claims['custom:tenantId'] || 'personal') as string;
  
  // 🆕 Extract role from Cognito Groups (primary method)
  const groups = (claims['cognito:groups'] as string[]) || [];
  let role: UserRole = 'user'; // Default role
  
  // Determine role based on group membership (highest priority wins)
  if (groups.includes('Admins')) {
    role = 'admin';
  } else if (groups.includes('DevTeam')) {
    role = 'dev';
  } else if (groups.includes('Users')) {
    role = 'user';
  } else {
    // Fallback to custom attribute for backwards compatibility
    // TODO: Remove this after all users are migrated to groups
    role = (claims['custom:role'] || 'user') as UserRole;
  }
  
  // Parse permissions (comma-separated string in JWT)
  const permissionsStr = (claims['custom:permissions'] || '') as string;
  const permissions = permissionsStr ? permissionsStr.split(',') : [];
  
  if (!userId || !email) {
    return null;
  }
  
  return {
    userId,
    tenantId,
    role,
    email,
    permissions,
    groups, // Include groups for debugging/logging
  };
}

/**
 * Check if user has required role
 */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Check if user has specific permission
 */
export function hasPermission(
  user: AuthContext,
  requiredPermission: string
): boolean {
  // Admin has all permissions
  if (user.role === 'admin') {
    return true;
  }
  
  // Check user's permission array
  return user.permissions.includes(requiredPermission);
}

/**
 * Check if user can access resource
 * 
 * @param user - Authenticated user context
 * @param resourceUserId - User ID of the resource owner
 * @param scope - Permission scope ('own', 'tenant', 'all')
 */
export function canAccessResource(
  user: AuthContext,
  resourceUserId: string,
  scope: 'own' | 'tenant' | 'all' = 'own'
): boolean {
  // Admin can access everything
  if (user.role === 'admin' && scope === 'all') {
    return true;
  }
  
  // Dev can access tenant-level data
  if (user.role === 'dev' && scope === 'tenant') {
    return true;
  }
  
  // Users can only access their own data
  if (scope === 'own') {
    return user.userId === resourceUserId;
  }
  
  return false;
}

/**
 * Authorize request with role and optional permission check
 * 
 * Usage:
 * ```typescript
 * const auth = await authorize(event, 'admin', 'users:write');
 * if (!auth.authorized) {
 *   return forbidden(auth.reason);
 * }
 * const { user, context } = auth;
 * ```
 */
export async function authorize(
  event: Event,
  requiredRole: UserRole = 'user',
  requiredPermission?: string
): Promise<AuthorizationResult> {
  // Extract auth context from JWT
  const context = extractAuthContext(event);
  
  if (!context) {
    return {
      authorized: false,
      reason: 'Authentication required. No valid JWT token found.'
    };
  }
  
  // Check role hierarchy
  if (!hasRole(context.role, requiredRole)) {
    return {
      authorized: false,
      reason: `Insufficient privileges. Required role: ${requiredRole}, user role: ${context.role}`
    };
  }
  
  // Check specific permission if required
  if (requiredPermission && !hasPermission(context, requiredPermission)) {
    return {
      authorized: false,
      reason: `Missing required permission: ${requiredPermission}`
    };
  }
  
  // TODO: Fetch full user from database to check isActive, isSuspended
  // For now, we'll create a minimal User object from context
  const user: User = {
    userId: context.userId,
    tenantId: context.tenantId,
    email: context.email,
    name: context.email.split('@')[0], // Temporary: extract from email
    role: context.role,
    permissions: context.permissions,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  return {
    authorized: true,
    user,
    context
  };
}

/**
 * Authorize admin-only actions
 * Shorthand for authorize(event, 'admin')
 */
export async function authorizeAdmin(
  event: Event
): Promise<AuthorizationResult> {
  return authorize(event, 'admin');
}

/**
 * Authorize dev-only actions
 * Shorthand for authorize(event, 'dev')
 */
export async function authorizeDev(
  event: Event
): Promise<AuthorizationResult> {
  return authorize(event, 'dev');
}

/**
 * Validate tenant access
 * Ensures user can only access data within their tenant
 */
export function validateTenantAccess(
  userTenantId: string,
  resourceTenantId: string
): boolean {
  return userTenantId === resourceTenantId;
}

/**
 * Create tenant-aware partition key
 * 
 * @example
 * createTenantKey('personal', 'USER', 'user-123')
 * // Returns: 'TENANT#personal#USER#user-123'
 */
export function createTenantKey(
  tenantId: string,
  entityType: string,
  entityId: string
): string {
  return `TENANT#${tenantId}#${entityType}#${entityId}`;
}

/**
 * Parse tenant key back to components
 * 
 * @example
 * parseTenantKey('TENANT#personal#USER#user-123')
 * // Returns: { tenantId: 'personal', entityType: 'USER', entityId: 'user-123' }
 */
export function parseTenantKey(key: string): {
  tenantId: string;
  entityType: string;
  entityId: string;
} | null {
  const parts = key.split('#');
  if (parts.length !== 4 || parts[0] !== 'TENANT') {
    return null;
  }
  
  return {
    tenantId: parts[1],
    entityType: parts[2],
    entityId: parts[3]
  };
}
