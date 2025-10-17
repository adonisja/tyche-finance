import { createRouter } from './utils';
import { healthCheck } from './handlers/health';
import { simulatePayoffHandler } from './handlers/payoff';
import { chatHandler } from './handlers/chat';
import { getCards, createCard, updateCard, deleteCard } from './handlers/cards';
import { 
  listAllUsers, 
  getUserById, 
  changeUserRole, 
  suspendUser, 
  activateUser, 
  getUserStats 
} from './handlers/admin/users';
import { 
  getSystemMetrics, 
  getErrorLogs, 
  testAIProvider, 
  getUsageAnalytics 
} from './handlers/dev/metrics';
import {
  createFinancialSnapshot,
  getFinancialSnapshots,
  createFinancialGoal,
  getFinancialGoals,
  updateFinancialGoal,
  getProgressReport,
  getAnalyticsInsights
} from './handlers/analytics';
import {
  getBudget,
  createBudget,
  updateBudget,
  deleteBudget,
  listBudgets,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getAnalytics,
  generateAnalyticsHandler
} from './handlers/budgets';

/**
 * Main Lambda handler for Tyche API
 * 
 * Handles all API Gateway HTTP requests and routes them to appropriate handlers
 */
export const handler = createRouter([
  // Public routes (no auth)
  {
    method: 'GET',
    path: '/public/health',
    handler: healthCheck,
    requireAuth: false,
  },

  // Protected routes (require Cognito auth)
  
  // Payoff simulation
  {
    method: 'POST',
    path: '/v1/payoff/simulate',
    handler: simulatePayoffHandler,
  },

  // AI Chat
  {
    method: 'POST',
    path: '/v1/chat',
    handler: chatHandler,
  },

  // Credit Cards CRUD
  {
    method: 'GET',
    path: '/v1/cards',
    handler: getCards,
  },
  {
    method: 'POST',
    path: '/v1/cards',
    handler: createCard,
  },
  {
    method: 'PUT',
    path: '/v1/cards/[^/]+', // Regex: /v1/cards/{cardId}
    handler: updateCard,
  },
  {
    method: 'DELETE',
    path: '/v1/cards/[^/]+', // Regex: /v1/cards/{cardId}
    handler: deleteCard,
  },

  // Admin routes (role: admin)
  {
    method: 'GET',
    path: '/v1/admin/users',
    handler: listAllUsers,
  },
  {
    method: 'GET',
    path: '/v1/admin/users/stats',
    handler: getUserStats,
  },
  {
    method: 'GET',
    path: '/v1/admin/users/[^/]+', // /v1/admin/users/{userId}
    handler: getUserById,
  },
  {
    method: 'PUT',
    path: '/v1/admin/users/[^/]+/role', // /v1/admin/users/{userId}/role
    handler: changeUserRole,
  },
  {
    method: 'POST',
    path: '/v1/admin/users/[^/]+/suspend', // /v1/admin/users/{userId}/suspend
    handler: suspendUser,
  },
  {
    method: 'POST',
    path: '/v1/admin/users/[^/]+/activate', // /v1/admin/users/{userId}/activate
    handler: activateUser,
  },

  // Dev routes (role: dev)
  {
    method: 'GET',
    path: '/v1/dev/metrics',
    handler: getSystemMetrics,
  },
  {
    method: 'GET',
    path: '/v1/dev/logs',
    handler: getErrorLogs,
  },
  {
    method: 'POST',
    path: '/v1/dev/test/ai',
    handler: testAIProvider,
  },
  {
    method: 'GET',
    path: '/v1/dev/analytics/usage',
    handler: getUsageAnalytics,
  },

  // Analytics routes (role: user+)
  {
    method: 'POST',
    path: '/v1/analytics/snapshot',
    handler: createFinancialSnapshot,
  },
  {
    method: 'GET',
    path: '/v1/analytics/snapshots',
    handler: getFinancialSnapshots,
  },
  {
    method: 'POST',
    path: '/v1/analytics/goal',
    handler: createFinancialGoal,
  },
  {
    method: 'GET',
    path: '/v1/analytics/goals',
    handler: getFinancialGoals,
  },
  {
    method: 'PUT',
    path: '/v1/analytics/goal/[^/]+', // /v1/analytics/goal/{goalId}
    handler: updateFinancialGoal,
  },
  {
    method: 'GET',
    path: '/v1/analytics/progress',
    handler: getProgressReport,
  },
  {
    method: 'GET',
    path: '/v1/analytics/insights',
    handler: getAnalyticsInsights,
  },

  // Budget routes (role: user+)
  {
    method: 'GET',
    path: '/v1/budgets',
    handler: listBudgets,
  },
  {
    method: 'POST',
    path: '/v1/budgets',
    handler: createBudget,
  },
  {
    method: 'GET',
    path: '/v1/budgets/[^/]+', // /v1/budgets/{month}
    handler: getBudget,
  },
  {
    method: 'PUT',
    path: '/v1/budgets/[^/]+', // /v1/budgets/{month}
    handler: updateBudget,
  },
  {
    method: 'DELETE',
    path: '/v1/budgets/[^/]+', // /v1/budgets/{month}
    handler: deleteBudget,
  },

  // Budget category routes
  {
    method: 'GET',
    path: '/v1/categories',
    handler: getCategories,
  },
  {
    method: 'POST',
    path: '/v1/categories',
    handler: createCategory,
  },
  {
    method: 'PUT',
    path: '/v1/categories/[^/]+', // /v1/categories/{id}
    handler: updateCategory,
  },
  {
    method: 'DELETE',
    path: '/v1/categories/[^/]+', // /v1/categories/{id}
    handler: deleteCategory,
  },

  // Transaction routes
  {
    method: 'GET',
    path: '/v1/transactions',
    handler: getTransactions,
  },
  {
    method: 'POST',
    path: '/v1/transactions',
    handler: createTransaction,
  },
  {
    method: 'PUT',
    path: '/v1/transactions/[^/]+', // /v1/transactions/{id}
    handler: updateTransaction,
  },
  {
    method: 'DELETE',
    path: '/v1/transactions/[^/]+', // /v1/transactions/{id}
    handler: deleteTransaction,
  },

  // Spending analytics routes
  {
    method: 'GET',
    path: '/v1/spending/analytics/[^/]+', // /v1/spending/analytics/{month}
    handler: getAnalytics,
  },
  {
    method: 'POST',
    path: '/v1/spending/analytics/[^/]+/generate', // /v1/spending/analytics/{month}/generate
    handler: generateAnalyticsHandler,
  },

  // TODO: Add more routes
  // - GET/POST /v1/transactions (transaction management)
  // - GET /v1/users/me (user profile)
  // - POST /v1/upload (file upload to S3)
  // - POST /v1/analyze/receipt (OCR receipt scanning)
]);

