/**
 * Audit Logging Utility
 * 
 * Logs all admin and sensitive actions for compliance and security auditing.
 * Logs are stored in DynamoDB with 90-day TTL.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { AuditLogEntry } from '@tyche/types';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const AUDIT_LOGS_TABLE = process.env.AUDIT_LOGS_TABLE || 'tyche-audit-logs';
const TTL_DAYS = 90; // Logs expire after 90 days

/**
 * Log an audit event
 * 
 * @example
 * await auditLog({
 *   tenantId: 'personal',
 *   userId: 'admin-123',
 *   role: 'admin',
 *   action: 'view_user_cards',
 *   resource: 'cards',
 *   targetUserId: 'user-456',
 *   success: true
 * });
 */
export async function auditLog(entry: Omit<AuditLogEntry, 'timestamp'>): Promise<void> {
  const timestamp = new Date().toISOString();
  const logId = `${timestamp}_${Math.random().toString(36).substring(7)}`;
  
  // Calculate TTL (Unix timestamp in seconds)
  const ttl = Math.floor(Date.now() / 1000) + (TTL_DAYS * 24 * 60 * 60);
  
  const fullEntry: AuditLogEntry = {
    ...entry,
    timestamp
  };
  
  try {
    // Store in DynamoDB
    await docClient.send(new PutCommand({
      TableName: AUDIT_LOGS_TABLE,
      Item: {
        PK: `TENANT#${entry.tenantId}`,
        SK: `LOG#${timestamp}#${logId}`,
        ...fullEntry,
        ttl
      }
    }));
    
    // Also log to CloudWatch for real-time monitoring
    console.log('[AUDIT]', JSON.stringify(fullEntry));
  } catch (error) {
    // Don't fail request if audit logging fails
    console.error('[AUDIT ERROR]', error);
    console.error('[AUDIT ENTRY]', JSON.stringify(fullEntry));
  }
}

/**
 * Log admin viewing another user's data
 */
export async function logAdminView(
  tenantId: string,
  adminUserId: string,
  resource: string,
  targetUserId: string,
  details?: Record<string, any>
): Promise<void> {
  await auditLog({
    tenantId,
    userId: adminUserId,
    role: 'admin',
    action: `admin_view_${resource}`,
    resource,
    targetUserId,
    details,
    success: true
  });
}

/**
 * Log user role change
 */
export async function logRoleChange(
  tenantId: string,
  adminUserId: string,
  targetUserId: string,
  oldRole: string,
  newRole: string
): Promise<void> {
  await auditLog({
    tenantId,
    userId: adminUserId,
    role: 'admin',
    action: 'change_user_role',
    resource: 'users',
    targetUserId,
    details: { oldRole, newRole },
    success: true
  });
}

/**
 * Log user impersonation
 */
export async function logImpersonation(
  tenantId: string,
  adminUserId: string,
  targetUserId: string,
  action: 'start' | 'stop'
): Promise<void> {
  await auditLog({
    tenantId,
    userId: adminUserId,
    role: 'admin',
    action: `impersonate_${action}`,
    resource: 'users',
    targetUserId,
    impersonated: true,
    success: true
  });
}

/**
 * Log data export
 */
export async function logDataExport(
  tenantId: string,
  userId: string,
  role: string,
  exportType: string,
  recordCount: number
): Promise<void> {
  await auditLog({
    tenantId,
    userId,
    role: role as any,
    action: 'export_data',
    resource: exportType,
    details: { recordCount },
    success: true
  });
}

/**
 * Log failed authorization attempt
 */
export async function logAuthorizationFailure(
  tenantId: string,
  userId: string,
  action: string,
  resource: string,
  reason: string,
  ip?: string
): Promise<void> {
  await auditLog({
    tenantId,
    userId,
    role: 'user', // Unknown at this point
    action,
    resource,
    ip,
    success: false,
    errorMessage: reason
  });
}

/**
 * Log sensitive data access
 */
export async function logSensitiveAccess(
  tenantId: string,
  userId: string,
  role: string,
  resource: string,
  resourceId: string,
  action: string
): Promise<void> {
  await auditLog({
    tenantId,
    userId,
    role: role as any,
    action,
    resource,
    resourceId,
    success: true
  });
}
