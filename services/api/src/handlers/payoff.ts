import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ok, badRequest, parseBody } from '../utils';
import { simulatePayoff } from '@tyche/core';
import type { PayoffStrategyInput } from '@tyche/types';

/**
 * Simulate credit card debt payoff
 * POST /v1/payoff/simulate
 * 
 * Body: {
 *   cards: CreditCardAccount[],
 *   monthlyBudget: number,
 *   strategy: 'avalanche' | 'snowball'
 * }
 * 
 * Returns: PayoffPlanResult with steps, total interest, months to debt-free
 */
export async function simulatePayoffHandler(event: APIGatewayProxyEventV2, userId?: string) {
  if (!userId) {
    return badRequest('User ID required');
  }
  
  const body = parseBody(event);

  if (!body) {
    return badRequest('Invalid JSON body');
  }

  const { cards, monthlyBudget, strategy = 'avalanche' } = body;

  // Validate required fields
  if (!cards || !Array.isArray(cards)) {
    return badRequest('Missing or invalid "cards" array');
  }

  if (typeof monthlyBudget !== 'number' || monthlyBudget < 0) {
    return badRequest('Missing or invalid "monthlyBudget" (must be positive number)');
  }

  if (strategy !== 'avalanche' && strategy !== 'snowball') {
    return badRequest('Invalid "strategy" (must be "avalanche" or "snowball")');
  }

  // Validate card structure
  for (const card of cards) {
    if (!card.id || typeof card.balance !== 'number' || typeof card.apr !== 'number') {
      return badRequest('Invalid card data: each card needs id, balance, apr, minPayment');
    }
  }

  // Run simulation
  const input: PayoffStrategyInput = {
    cards,
    monthlyBudget,
  };

  const result = simulatePayoff(input, { strategy });

  // Log for analytics (optional)
  console.log(`[PayoffSimulation] userId=${userId} strategy=${strategy} cards=${cards.length} result=${result.monthsToDebtFree} months`);

  return ok({
    strategy,
    result,
    recommendation: generateRecommendation(result, strategy),
  });
}

/**
 * Generate human-readable recommendation based on results
 */
function generateRecommendation(result: any, strategy: string): string {
  const years = Math.floor(result.monthsToDebtFree / 12);
  const months = result.monthsToDebtFree % 12;
  const timeStr = years > 0 
    ? `${years} year${years > 1 ? 's' : ''} and ${months} month${months !== 1 ? 's' : ''}`
    : `${months} month${months !== 1 ? 's' : ''}`;

  return `Using the ${strategy} method, you'll be debt-free in ${timeStr} and pay $${result.totalInterest.toFixed(2)} in total interest.`;
}
