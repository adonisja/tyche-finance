/**
 * Admin User Management Handlers
 * 
 * Endpoints for managing users, roles, and permissions.
 * Requires admin role.
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { authorize } from '../../middleware/authorize';
import { ok, badRequest, forbidden, notFound } from '../../utils';
import { auditLog, logRoleChange, logAdminView } from '../../utils/audit';
import { createTenantKey, getItem, updateItem, queryByIndex } from '../../utils/db';
import type { UserRole } from '@tyche/types';

const USERS_TABLE = process.env.USERS_TABLE || 'tyche-users';

/**
 * GET /v1/admin/users
 * List all users in the tenant
 */
export async function listAllUsers(
  event: APIGatewayProxyEventV2,
  _userId?: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await authorize(event, 'admin');
  
  if (!auth.authorized) {
    return forbidden(auth.reason);
  }
  
  const { user, context } = auth;

  try {
    // Query all users in this tenant using tenant-aware keys
    // We'll scan for all items with PK starting with TENANT#tenantId#USER#
    const users = await queryByIndex(
      USERS_TABLE,
      'RoleIndex', // Use RoleIndex GSI (tenantId + role)
      'tenantId',
      context!.tenantId
    );
  
    // Log admin action
    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'list_all_users',
      resource: 'users',
      success: true,
      details: { count: users.length }
    });
  
    return ok({
      users,
      count: users.length
    });
  } catch (error) {
    console.error('[ListAllUsers] Error:', error);
    
    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'list_all_users',
      resource: 'users',
      success: false,
      errorMessage: String(error)
    });
    
    return badRequest('Failed to fetch users');
  }
}

/**
 * GET /v1/admin/users/{userId}
 * Get details for a specific user
 */
export async function getUserById(
  event: APIGatewayProxyEventV2,
  _userId?: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await authorize(event, 'admin');
  
  if (!auth.authorized) {
    return forbidden(auth.reason);
  }
  
  const { context } = auth;
  const targetUserId = event.pathParameters?.userId;
  
  if (!targetUserId) {
    return badRequest('User ID is required');
  }

  try {
    // Build tenant-aware key
    const pk = createTenantKey(context!.tenantId, 'USER', targetUserId);
    const sk = 'METADATA';

    // Get user from DynamoDB
    const user = await getItem(USERS_TABLE, pk, sk);

    if (!user) {
      return notFound('User not found');
    }

    // Verify user belongs to same tenant (security check)
    if (user.tenantId !== context!.tenantId) {
      console.error(`[SECURITY] Admin ${context!.userId} attempted to access user ${targetUserId} from different tenant`);
      return notFound('User not found'); // Don't reveal that user exists
    }
  
    // Log admin viewing user details
    await logAdminView(
      context!.tenantId,
      context!.userId,
      'users',
      targetUserId
    );
  
    return ok(user);
  } catch (error) {
    console.error('[GetUserById] Error:', error);
    return badRequest('Failed to fetch user');
  }
}

/**
 * PUT /v1/admin/users/{userId}/role
 * Change a user's role
 */
export async function changeUserRole(
  event: APIGatewayProxyEventV2,
  _userId?: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await authorize(event, 'admin', 'users:admin');
  
  if (!auth.authorized) {
    return forbidden(auth.reason);
  }
  
  const { context } = auth;
  const targetUserId = event.pathParameters?.userId;
  
  if (!targetUserId) {
    return badRequest('User ID is required');
  }
  
  const body = JSON.parse(event.body || '{}');
  const { newRole } = body;
  
  // Validate role
  const validRoles: UserRole[] = ['user', 'dev', 'admin'];
  if (!newRole || !validRoles.includes(newRole)) {
    return badRequest(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }
  
  // Prevent users from demoting themselves
  if (targetUserId === context!.userId && newRole !== 'admin') {
    return badRequest('Cannot change your own admin role');
  }

  try {
    // Build tenant-aware key
    const pk = createTenantKey(context!.tenantId, 'USER', targetUserId);
    const sk = 'METADATA';

    // Get current user data
    const user = await getItem(USERS_TABLE, pk, sk);

    if (!user) {
      return notFound('User not found');
    }

    // Verify user belongs to same tenant
    if (user.tenantId !== context!.tenantId) {
      console.error(`[SECURITY] Admin ${context!.userId} attempted to change role for user ${targetUserId} from different tenant`);
      return notFound('User not found');
    }

    const currentRole = user.role || 'user';

    // Update role in DynamoDB
    await updateItem(USERS_TABLE, pk, sk, {
      role: newRole
    });

    // TODO: Also update Cognito custom attribute
    // This would require AWS SDK Cognito client:
    // await cognito.adminUpdateUserAttributes({
    //   UserPoolId: process.env.USER_POOL_ID,
    //   Username: user.email,
    //   UserAttributes: [{ Name: 'custom:role', Value: newRole }]
    // });
  
    // Log role change
    await logRoleChange(
      context!.tenantId,
      context!.userId,
      targetUserId,
      currentRole,
      newRole
    );
  
    return ok({
      message: `User role updated from '${currentRole}' to '${newRole}'`,
      userId: targetUserId,
      oldRole: currentRole,
      newRole
    });
  } catch (error) {
    console.error('[ChangeUserRole] Error:', error);
    return badRequest('Failed to change user role');
  }
}

/**
 * POST /v1/admin/users/{userId}/suspend
 * Suspend a user account
 */
export async function suspendUser(
  event: APIGatewayProxyEventV2,
  _userId?: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await authorize(event, 'admin', 'users:admin');
  
  if (!auth.authorized) {
    return forbidden(auth.reason);
  }
  
  const { context } = auth;
  const targetUserId = event.pathParameters?.userId;
  
  if (!targetUserId) {
    return badRequest('User ID is required');
  }
  
  // Prevent self-suspension
  if (targetUserId === context!.userId) {
    return badRequest('Cannot suspend your own account');
  }
  
  const body = JSON.parse(event.body || '{}');
  const { reason } = body;
  
  if (!reason) {
    return badRequest('Suspension reason is required');
  }

  try {
    // Build tenant-aware key
    const pk = createTenantKey(context!.tenantId, 'USER', targetUserId);
    const sk = 'METADATA';

    // Verify user exists
    const user = await getItem(USERS_TABLE, pk, sk);

    if (!user) {
      return notFound('User not found');
    }

    // Verify same tenant
    if (user.tenantId !== context!.tenantId) {
      console.error(`[SECURITY] Admin ${context!.userId} attempted to suspend user ${targetUserId} from different tenant`);
      return notFound('User not found');
    }

    // Update user status in DynamoDB
    await updateItem(USERS_TABLE, pk, sk, {
      isSuspended: true,
      suspendedReason: reason,
      suspendedAt: new Date().toISOString(),
      suspendedBy: context!.userId
    });

    // TODO: Also disable in Cognito
    // await cognito.adminDisableUser({
    //   UserPoolId: process.env.USER_POOL_ID,
    //   Username: user.email
    // });
  
    // Log suspension
    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'suspend_user',
      resource: 'users',
      targetUserId,
      details: { reason },
      success: true
    });
  
    return ok({
      message: 'User suspended successfully',
      userId: targetUserId,
      reason
    });
  } catch (error) {
    console.error('[SuspendUser] Error:', error);
    
    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'suspend_user',
      resource: 'users',
      targetUserId,
      success: false,
      errorMessage: String(error)
    });
    
    return badRequest('Failed to suspend user');
  }
}

/**
 * POST /v1/admin/users/{userId}/activate
 * Reactivate a suspended user account
 */
export async function activateUser(
  event: APIGatewayProxyEventV2,
  _userId?: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await authorize(event, 'admin', 'users:admin');
  
  if (!auth.authorized) {
    return forbidden(auth.reason);
  }
  
  const { context } = auth;
  const targetUserId = event.pathParameters?.userId;
  
  if (!targetUserId) {
    return badRequest('User ID is required');
  }

  try {
    // Build tenant-aware key
    const pk = createTenantKey(context!.tenantId, 'USER', targetUserId);
    const sk = 'METADATA';

    // Verify user exists
    const user = await getItem(USERS_TABLE, pk, sk);

    if (!user) {
      return notFound('User not found');
    }

    // Verify same tenant
    if (user.tenantId !== context!.tenantId) {
      console.error(`[SECURITY] Admin ${context!.userId} attempted to activate user ${targetUserId} from different tenant`);
      return notFound('User not found');
    }

    // Update user status in DynamoDB
    await updateItem(USERS_TABLE, pk, sk, {
      isSuspended: false,
      isActive: true,
      activatedAt: new Date().toISOString(),
      activatedBy: context!.userId
      // Note: suspendedReason, suspendedAt, suspendedBy remain in history
    });

    // TODO: Also enable in Cognito
    // await cognito.adminEnableUser({
    //   UserPoolId: process.env.USER_POOL_ID,
    //   Username: user.email
    // });
  
    // Log activation
    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'activate_user',
      resource: 'users',
      targetUserId,
      success: true
    });
  
    return ok({
      message: 'User activated successfully',
      userId: targetUserId
    });
  } catch (error) {
    console.error('[ActivateUser] Error:', error);
    
    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'activate_user',
      resource: 'users',
      targetUserId,
      success: false,
      errorMessage: String(error)
    });
    
    return badRequest('Failed to activate user');
  }
}

/**
 * GET /v1/admin/users/stats
 * Get user statistics for the tenant
 */
export async function getUserStats(
  event: APIGatewayProxyEventV2,
  _userId?: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await authorize(event, 'admin');
  
  if (!auth.authorized) {
    return forbidden(auth.reason);
  }
  
  const { context } = auth;

  try {
    // Query all users in tenant using RoleIndex GSI
    const allUsers = await queryByIndex(
      USERS_TABLE,
      'RoleIndex',
      'tenantId',
      context!.tenantId
    );

    // Calculate statistics
    const total = allUsers.length;
    const active = allUsers.filter(u => u.isActive && !u.isSuspended).length;
    const suspended = allUsers.filter(u => u.isSuspended).length;

    // Count by role
    const byRole = {
      user: allUsers.filter(u => u.role === 'user').length,
      dev: allUsers.filter(u => u.role === 'dev').length,
      admin: allUsers.filter(u => u.role === 'admin').length
    };

    // New this month
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const newThisMonth = allUsers.filter(u => {
      const created = new Date(u.createdAt || 0);
      return created > oneMonthAgo;
    }).length;

    // Active today (users with lastLogin today)
    const today = new Date().toISOString().split('T')[0];
    const activeToday = allUsers.filter(u => {
      const lastLogin = u.lastLogin || '';
      return lastLogin.startsWith(today);
    }).length;

    const stats = {
      total,
      active,
      suspended,
      byRole,
      newThisMonth,
      activeToday,
      // Note: Card/debt stats would require cross-table queries
      // For now, we'll leave those as TODO for performance reasons
      averageCardsPerUser: 0, // TODO: Calculate from credit cards table
      averageDebtPerUser: 0    // TODO: Calculate from credit cards table
    };
  
    // Log stats access
    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'view_user_stats',
      resource: 'users',
      success: true
    });
  
    return ok(stats);
  } catch (error) {
    console.error('[GetUserStats] Error:', error);
    return badRequest('Failed to fetch user statistics');
  }
}
