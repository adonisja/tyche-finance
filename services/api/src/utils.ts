/**
 * 📦 AWS Lambda Types Import
 * 
 * 🎓 EXPLANATION:
 * These types come from @types/aws-lambda package (AWS official type definitions)
 * 
 * - APIGatewayProxyHandlerV2: Function signature for Lambda handler
 * - APIGatewayProxyEventV2: HTTP request event object (HTTP API V2)
 * - APIGatewayProxyEventV2WithJWTAuthorizer: Event WITH JWT auth data
 * - APIGatewayProxyResultV2: HTTP response object
 * 
 * Why HTTP API (V2)?
 * - 71% cheaper than REST API ($1.00 vs $3.50 per million requests)
 * - 60% faster (50-80ms vs 100-150ms latency)
 * - Simpler event structure
 * - Better Cognito JWT integration
 * - AWS recommended for new projects
 */
import type { 
  APIGatewayProxyHandlerV2, 
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2
} from 'aws-lambda';

/**
 * Simple response helper
 */
export function response(statusCode: number, body: any, headers: Record<string, string> = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // Configure properly in production
      'Access-Control-Allow-Credentials': 'true',
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

/**
 * Success response
 */
export function ok(data: any) {
  return response(200, { success: true, data });
}

/**
 * Created response (201) - use for POST requests that create new resources
 */
export function created(data: any) {
  return response(201, { success: true, data });
}

/**
 * Error responses
 */
export function badRequest(message: string, details?: any) {
  return response(400, { success: false, error: message, details });
}

export function unauthorized(message = 'Unauthorized') {
  return response(401, { success: false, error: message });
}

export function forbidden(message = 'Forbidden') {
  return response(403, { success: false, error: message });
}

export function notFound(message = 'Not found') {
  return response(404, { success: false, error: message });
}

export function serverError(message: string, error?: any) {
  console.error('Server error:', error);
  return response(500, { 
    success: false, 
    error: message,
    // Only include error details in development
    ...(process.env.NODE_ENV === 'development' && { details: error?.message })
  });
}

/**
 * Extract user ID from Cognito JWT authorizer claims
 */
export function getUserId(event: APIGatewayProxyEventV2WithJWTAuthorizer | APIGatewayProxyEventV2): string | null {
  const authEvent = event as APIGatewayProxyEventV2WithJWTAuthorizer;
  const claims = authEvent.requestContext?.authorizer?.jwt?.claims;
  return claims?.sub as string || null;
}

/**
 * Parse JSON body safely
 */
export function parseBody<T = any>(event: APIGatewayProxyEventV2): T | null {
  try {
    return event.body ? JSON.parse(event.body) : null;
  } catch {
    return null;
  }
}

/**
 * Route handler type
 */
export type RouteHandler = (
  event: APIGatewayProxyEventV2,
  userId?: string
) => Promise<ReturnType<typeof response>> | Promise<APIGatewayProxyResultV2<any>>;

/**
 * Route definition
 */
export interface Route {
  method: string;
  path: string; // Regex pattern or exact match
  handler: RouteHandler;
  requireAuth?: boolean; // Default true
}

/**
 * Simple router for Lambda (HTTP API V2)
 */
export function createRouter(routes: Route[]): APIGatewayProxyHandlerV2 {
  return async (event) => {
    const method = event.requestContext.http.method;
    const path = event.requestContext.http.path;

    console.log(`[${method}] ${path}`);

    // Handle OPTIONS requests for CORS preflight
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization',
          'Access-Control-Max-Age': '86400',
        },
        body: '',
      };
    }

    // Find matching route
    const route = routes.find(r => {
      if (r.method !== method) return false;
      // Exact match or regex match
      return r.path === path || new RegExp(r.path).test(path);
    });

    if (!route) {
      return notFound(`Route not found: ${method} ${path}`);
    }

    // Extract path parameters from URL
    // For routes like /v1/cards/{cardId}, extract the cardId
    if (!event.pathParameters) {
      event.pathParameters = {};
    }
    
    // Extract cardId from paths like /v1/cards/card-abc123
    if (path.startsWith('/v1/cards/') && path !== '/v1/cards') {
      const cardId = path.split('/v1/cards/')[1];
      if (cardId) {
        event.pathParameters.cardId = cardId;
      }
    }
    
    // Extract userId from admin paths like /v1/admin/users/{userId}
    if (path.startsWith('/v1/admin/users/')) {
      const parts = path.split('/');
      if (parts.length >= 5 && parts[4]) {
        event.pathParameters.userId = parts[4];
      }
    }

    // Check auth if required
    const requireAuth = route.requireAuth !== false; // Default true
    let userId: string | undefined;

    if (requireAuth) {
      userId = getUserId(event) || undefined;
      if (!userId) {
        return unauthorized('Authentication required');
      }
    }

    // Call handler with error handling
    try {
      return await route.handler(event, userId);
    } catch (error: any) {
      console.error(`Error in ${method} ${path}:`, error);
      return serverError('Internal server error', error);
    }
  };
}
