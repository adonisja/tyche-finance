import { ok } from '../utils';
import { getModelConfig } from '@tyche/ai';

/**
 * Health check endpoint
 * GET /public/health
 * 
 * Returns API status and configuration info
 */
export async function healthCheck() {
  const aiConfig = getModelConfig();
  
  return ok({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    aiProvider: {
      provider: aiConfig.provider,
      model: aiConfig.model,
      configured: !!aiConfig.apiKey || aiConfig.provider === 'bedrock',
    },
    tables: {
      users: process.env.USERS_TABLE || 'not-configured',
      transactions: process.env.TRANSACTIONS_TABLE || 'not-configured',
      creditCards: process.env.CREDIT_CARDS_TABLE || 'not-configured',
    },
  });
}
