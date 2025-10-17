/**
 * DynamoDB Utilities
 * 
 * Helpers for multi-tenant database operations with proper key construction
 * and tenant isolation.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';

// Initialize DynamoDB client
const client = new DynamoDBClient({});
export const docClient = DynamoDBDocumentClient.from(client);

/**
 * Create a tenant-aware partition key
 * 
 * Pattern: TENANT#tenantId#ENTITY#entityId
 * 
 * @example
 * createTenantKey('acme-corp', 'USER', 'user-123')
 * // Returns: "TENANT#acme-corp#USER#user-123"
 */
export function createTenantKey(tenantId: string, entityType: string, entityId: string): string {
  return `TENANT#${tenantId}#${entityType}#${entityId}`;
}

/**
 * Generate a random ID for new entities
 */
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}-${timestamp}${random}` : `${timestamp}${random}`;
}

/**
 * Get current timestamp in ISO format
 */
export function timestamp(): string {
  return new Date().toISOString();
}

/**
 * Calculate TTL for DynamoDB items (90 days from now)
 * Returns Unix timestamp in seconds
 */
export function ttl90Days(): number {
  return Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60);
}

/**
 * Put item into DynamoDB with automatic timestamps
 */
export async function putItem(tableName: string, item: Record<string, any>) {
  const now = timestamp();
  
  await docClient.send(new PutCommand({
    TableName: tableName,
    Item: {
      ...item,
      createdAt: item.createdAt || now,
      updatedAt: now,
    },
  }));
  
  return item;
}

/**
 * Get item from DynamoDB by PK and SK
 */
export async function getItem(tableName: string, pk: string, sk: string) {
  const result = await docClient.send(new GetCommand({
    TableName: tableName,
    Key: { PK: pk, SK: sk },
  }));
  
  return result.Item;
}

/**
 * Query items from DynamoDB by PK
 */
export async function queryItems(
  tableName: string,
  pk: string,
  options?: {
    sortKeyCondition?: string;
    filterExpression?: string;
    expressionAttributeValues?: Record<string, any>;
    limit?: number;
  }
) {
  const expressionAttributeValues: Record<string, any> = {
    ':pk': pk,
    ...(options?.expressionAttributeValues || {}),
  };

  let keyConditionExpression = 'PK = :pk';
  if (options?.sortKeyCondition) {
    keyConditionExpression += ` AND ${options.sortKeyCondition}`;
  }

  const result = await docClient.send(new QueryCommand({
    TableName: tableName,
    KeyConditionExpression: keyConditionExpression,
    FilterExpression: options?.filterExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    Limit: options?.limit,
  }));

  return result.Items || [];
}

/**
 * Update item in DynamoDB
 */
export async function updateItem(
  tableName: string,
  pk: string,
  sk: string,
  updates: Record<string, any>
) {
  // Build update expression
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {};

  // Always update updatedAt
  updates.updatedAt = timestamp();

  Object.keys(updates).forEach((key, index) => {
    const nameKey = `#attr${index}`;
    const valueKey = `:val${index}`;
    
    updateExpressions.push(`${nameKey} = ${valueKey}`);
    expressionAttributeNames[nameKey] = key;
    expressionAttributeValues[valueKey] = updates[key];
  });

  await docClient.send(new UpdateCommand({
    TableName: tableName,
    Key: { PK: pk, SK: sk },
    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
  }));

  return updates;
}

/**
 * Delete item from DynamoDB
 */
export async function deleteItem(tableName: string, pk: string, sk: string) {
  await docClient.send(new DeleteCommand({
    TableName: tableName,
    Key: { PK: pk, SK: sk },
  }));
}

/**
 * Query items by GSI
 */
export async function queryByIndex(
  tableName: string,
  indexName: string,
  partitionKey: string,
  partitionValue: any,
  options?: {
    sortKey?: string;
    sortValue?: any;
    sortCondition?: string;
    limit?: number;
  }
) {
  const expressionAttributeValues: Record<string, any> = {
    ':pk': partitionValue,
  };

  let keyConditionExpression = `${partitionKey} = :pk`;
  
  if (options?.sortKey && options?.sortValue) {
    expressionAttributeValues[':sk'] = options.sortValue;
    const condition = options?.sortCondition || '=';
    keyConditionExpression += ` AND ${options.sortKey} ${condition} :sk`;
  }

  const result = await docClient.send(new QueryCommand({
    TableName: tableName,
    IndexName: indexName,
    KeyConditionExpression: keyConditionExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    Limit: options?.limit,
  }));

  return result.Items || [];
}
