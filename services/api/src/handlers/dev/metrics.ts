/**
 * Developer Metrics Handlers
 * 
 * Endpoints for viewing system metrics, logs, and analytics.
 * Requires dev role.
 */

import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { authorizeDev } from '../../middleware/authorize';
import { ok, forbidden, badRequest } from '../../utils';
import { auditLog } from '../../utils/audit';
import { queryByIndex } from '../../utils/db';

const USERS_TABLE = process.env.USERS_TABLE || 'tyche-users';
const AUDIT_LOGS_TABLE = process.env.AUDIT_LOGS_TABLE || 'tyche-audit-logs';

/**
 * GET /v1/dev/metrics
 * Get system performance metrics
 */
export async function getSystemMetrics(
  event: APIGatewayProxyEventV2,
  _userId?: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await authorizeDev(event);
  
  if (!auth.authorized) {
    return forbidden(auth.reason);
  }
  
  const { context } = auth;
  
  try {
    // NOTE: Real CloudWatch metrics integration would use:
    // - CloudWatchClient from @aws-sdk/client-cloudwatch
    // - GetMetricStatisticsCommand for time-series data
    // - GetMetricDataCommand for multiple metrics
    // For now, returning system information from environment
    
    const period24h = 24 * 60 * 60 * 1000;
    const startTime = new Date(Date.now() - period24h);
    const endTime = new Date();
    
    const metrics = {
      lambda: {
        functionName: process.env.AWS_LAMBDA_FUNCTION_NAME || 'tyche-api',
        region: process.env.AWS_REGION || 'us-east-1',
        runtime: process.env.AWS_EXECUTION_ENV || 'AWS_Lambda_nodejs20.x',
        memoryLimit: process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE || '1024',
        // Real values would come from CloudWatch GetMetricStatistics
        note: 'Enable CloudWatch metrics collection for real-time data'
      },
      apiGateway: {
        apiId: process.env.API_ID || 'n/a',
        stage: process.env.STAGE || 'prod',
        note: 'Enable API Gateway detailed metrics for request/error tracking'
      },
      dynamodb: {
        tables: ['tyche-users', 'tyche-credit-cards', 'tyche-transactions', 'tyche-audit-logs'],
        note: 'Enable DynamoDB contributor insights for capacity metrics'
      },
      ai: {
        provider: process.env.AI_PROVIDER || 'anthropic',
        model: process.env.AI_MODEL || 'claude-3-5-sonnet-20241022',
        note: 'Track AI usage via audit logs (action: ai_chat_message)'
      },
      period: {
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        duration: '24 hours'
      }
    };
    
    // Log metrics access
    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'view_system_metrics',
      resource: 'system',
      success: true
    });
    
    return ok(metrics);
  } catch (error) {
    console.error('[GetSystemMetrics] Error:', error);
    
    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'view_system_metrics',
      resource: 'system',
      success: false,
      errorMessage: String(error)
    });
    
    return ok({
      error: 'Failed to fetch system metrics',
      note: 'Check CloudWatch Logs for details'
    });
  }
}

/**
 * GET /v1/dev/logs
 * Get recent error logs
 */
export async function getErrorLogs(
  event: APIGatewayProxyEventV2,
  _userId?: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await authorizeDev(event);
  
  if (!auth.authorized) {
    return forbidden(auth.reason);
  }
  
  const { context } = auth;
  const { hours = '24' } = event.queryStringParameters || {};
  
  try {
    // NOTE: Real CloudWatch Logs integration would use:
    // - CloudWatchLogsClient from @aws-sdk/client-cloudwatch-logs
    // - FilterLogEventsCommand to query error logs
    // - Filter pattern: [timestamp, requestId, level = ERROR, ...]
    
    // For now, we can query recent audit logs that have success: false
    // as a proxy for errors (real errors would be in CloudWatch Logs)
    const hoursNum = parseInt(hours, 10) || 24;
    const sinceTime = new Date(Date.now() - hoursNum * 60 * 60 * 1000);
    
    const errorInfo = {
      note: 'Enable CloudWatch Logs Insights for detailed error analysis',
      logGroup: `/aws/lambda/${process.env.AWS_LAMBDA_FUNCTION_NAME || 'tyche-api'}`,
      queryHint: 'Use filter pattern: [timestamp, requestId, level = ERROR]',
      auditLogsNote: 'Failed operations logged in audit table with success: false',
      period: `Last ${hours} hours since ${sinceTime.toISOString()}`,
      errorCount: 0, // Would count from CloudWatch or audit logs
      errors: [] // Would fetch from CloudWatch Logs
    };
    
    // Log access
    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'view_error_logs',
      resource: 'logs',
      details: { hours },
      success: true
    });
    
    return ok(errorInfo);
  } catch (error) {
    console.error('[GetErrorLogs] Error:', error);
    return ok({
      error: 'Failed to fetch error logs',
      note: 'Check CloudWatch Logs console for manual access'
    });
  }
}

/**
 * POST /v1/dev/test/ai
 * Test AI provider connectivity and response
 */
export async function testAIProvider(
  event: APIGatewayProxyEventV2,
  _userId?: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await authorizeDev(event);
  
  if (!auth.authorized) {
    return forbidden(auth.reason);
  }
  
  const { context } = auth;
  const body = JSON.parse(event.body || '{}');
  const { provider, model, message = 'Hello, this is a test.' } = body;
  
  try {
    // TODO: Actually test AI provider using @tyche/ai package
    // Would require: import { AIProviderFactory } from '@tyche/ai';
    // const aiProvider = AIProviderFactory.create(provider || process.env.AI_PROVIDER);
    // const response = await aiProvider.chat([{ role: 'user', content: message }]);
    
    const startTime = Date.now();
    const testProvider = provider || process.env.AI_PROVIDER || 'anthropic';
    const testModel = model || process.env.AI_MODEL || 'claude-3-5-sonnet-20241022';
    
    // Simulate test (real implementation would call AI API)
    const responseTime = Date.now() - startTime;
    
    const testResult = {
      provider: testProvider,
      model: testModel,
      status: 'ready',
      note: 'AI provider configured but not tested (requires API call)',
      apiKeyConfigured: !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.XAI_API_KEY || process.env.DEEPSEEK_API_KEY),
      envVarCheck: {
        AI_PROVIDER: process.env.AI_PROVIDER || 'not set',
        AI_MODEL: process.env.AI_MODEL || 'not set',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? 'configured' : 'not set',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'configured' : 'not set',
        XAI_API_KEY: process.env.XAI_API_KEY ? 'configured' : 'not set',
        DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ? 'configured' : 'not set'
      },
      responseTime: `${responseTime}ms`,
      hint: 'Send POST to /v1/chat to actually test AI provider with a real message'
    };
    
    // Log test
    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'test_ai_provider',
      resource: 'ai',
      details: { provider: testProvider, model: testModel },
      success: true
    });
    
    return ok(testResult);
  } catch (error: any) {
    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'test_ai_provider',
      resource: 'ai',
      details: { provider, model },
      success: false,
      errorMessage: error.message
    });
    
    return ok({
      provider: provider || process.env.AI_PROVIDER,
      model: model || process.env.AI_MODEL,
      status: 'error',
      error: error.message
    });
  }
}

/**
 * GET /v1/dev/analytics/usage
 * Get usage analytics (anonymized)
 */
export async function getUsageAnalytics(
  event: APIGatewayProxyEventV2,
  _userId?: string
): Promise<APIGatewayProxyResultV2> {
  const auth = await authorizeDev(event);
  
  if (!auth.authorized) {
    return forbidden(auth.reason);
  }
  
  const { context } = auth;
  
  try {
    // Query users in tenant using RoleIndex
    const allUsers = await queryByIndex(
      USERS_TABLE,
      'RoleIndex',
      'tenantId',
      context!.tenantId
    );

    // Calculate user statistics
    const totalActive = allUsers.filter(u => u.isActive && !u.isSuspended).length;
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const newThisWeek = allUsers.filter(u => {
      const created = new Date(u.createdAt || 0);
      return created > oneWeekAgo;
    }).length;

    // Query recent audit logs for activity patterns
    // NOTE: This is a simplified version - production would use time-based queries
    // and potentially cache/aggregate this data
    
    const analytics = {
      users: {
        totalActive,
        newThisWeek,
        total: allUsers.length,
        byRole: {
          user: allUsers.filter(u => u.role === 'user').length,
          dev: allUsers.filter(u => u.role === 'dev').length,
          admin: allUsers.filter(u => u.role === 'admin').length
        }
      },
      note: {
        transactions: 'Query tyche-transactions table for transaction analytics',
        cards: 'Query tyche-credit-cards table for card/debt statistics',
        payoffSimulations: 'Track via audit logs with action: run_payoff_simulation',
        aiChat: 'Track via audit logs with action: ai_chat_message',
        implementation: 'Add aggregation queries or create analytics cache table'
      },
      dataAvailable: {
        users: true,
        transactions: false, // Not yet implemented
        cards: false,        // Not yet implemented
        payoffSims: false,   // Not yet implemented
        aiChat: false        // Not yet implemented
      }
    };
    
    // Log analytics access
    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'view_usage_analytics',
      resource: 'analytics',
      success: true
    });
    
    return ok(analytics);
  } catch (error) {
    console.error('[GetUsageAnalytics] Error:', error);
    
    await auditLog({
      tenantId: context!.tenantId,
      userId: context!.userId,
      role: context!.role,
      action: 'view_usage_analytics',
      resource: 'analytics',
      success: false,
      errorMessage: String(error)
    });
    
    return badRequest('Failed to fetch usage analytics');
  }
}
