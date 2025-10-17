import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { ok, badRequest, parseBody } from '../utils';
import { createAgent } from '@tyche/ai';
import type { ChatMessage, Tool } from '@tyche/ai';
import { simulatePayoff } from '@tyche/core';
import type { PayoffStrategyInput } from '@tyche/types';
import { createTenantKey, queryItems } from '../utils/db';
import { authorize } from '../middleware/authorize';

const CREDIT_CARDS_TABLE = process.env.CREDIT_CARDS_TABLE || 'tyche-credit-cards';

/**
 * AI Chat endpoint with financial tools
 * POST /v1/chat
 * 
 * Body: {
 *   messages: ChatMessage[],
 *   context?: { cards?: CreditCardAccount[], transactions?: Transaction[] }
 * }
 * 
 * Returns: AI response with optional tool calls executed
 */
export async function chatHandler(event: APIGatewayProxyEventV2, userId?: string) {
  if (!userId) {
    return badRequest('User ID required');
  }

  // Get tenant context from authorization
  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return badRequest('Authorization context required');
  }

  const { tenantId } = auth.context;
  
  const body = parseBody(event);

  if (!body) {
    return badRequest('Invalid JSON body');
  }

  const { messages, context = {} } = body;

  // Validate messages
  if (!messages || !Array.isArray(messages)) {
    return badRequest('Missing or invalid "messages" array');
  }

  if (messages.some(m => !m.role || !m.content)) {
    return badRequest('Each message must have "role" and "content"');
  }

  try {
    // Create AI agent
    const agent = createAgent({ userId });

    // Define financial tools the AI can use
    const tools: Tool[] = [
      {
        name: 'simulate_debt_payoff',
        description: 'REQUIRED for debt payoff questions. Simulates credit card debt payoff strategies (avalanche or snowball). Returns exact months to payoff, total interest paid, and monthly breakdown. Use this tool whenever users ask about payoff strategies, timelines, or comparing methods. Call it TWICE to compare both avalanche and snowball strategies.',
        parameters: {
          type: 'object',
          properties: {
            cards: {
              type: 'array',
              description: 'Array of credit card details',
              items: {
                type: 'object',
                description: 'Credit card details',
                properties: {
                  name: { type: 'string', description: 'Card name or nickname' },
                  balance: { type: 'number', description: 'Current balance in dollars' },
                  limit: { type: 'number', description: 'Credit limit in dollars' },
                  apr: { type: 'number', description: 'Annual percentage rate as decimal (e.g., 0.1899 for 18.99%)' },
                  minPayment: { type: 'number', description: 'Minimum monthly payment in dollars' },
                },
                required: ['balance', 'apr', 'minPayment'],
              },
            },
            monthlyBudget: {
              type: 'number',
              description: 'Monthly amount available for debt payment beyond minimums (in dollars)',
            },
            strategy: {
              type: 'string',
              description: 'Payoff strategy to use',
              enum: ['avalanche', 'snowball'],
            },
          },
          required: ['cards', 'monthlyBudget', 'strategy'],
        },
      },
      {
        name: 'get_user_context',
        description: 'Get the user\'s current financial context (credit cards, recent transactions). Use this when the user asks about their specific situation.',
        parameters: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'analyze_spending_patterns',
        description: 'Analyze user spending patterns across credit cards to identify high-spend categories, unusual purchases, and opportunities to save money.',
        parameters: {
          type: 'object',
          properties: {
            cards: {
              type: 'array',
              description: 'Array of credit card details with balances',
              items: {
                type: 'object',
                description: 'Credit card with balance',
                properties: {
                  name: { type: 'string', description: 'Card name' },
                  balance: { type: 'number', description: 'Current balance' },
                  limit: { type: 'number', description: 'Credit limit' },
                },
                required: ['name', 'balance'],
              },
            },
            timeframe: {
              type: 'string',
              description: 'Time period to analyze',
              enum: ['last_month', 'last_3_months', 'last_6_months'],
            },
          },
          required: ['cards'],
        },
      },
      {
        name: 'recommend_balance_transfer',
        description: 'Evaluate if a balance transfer would save money on interest. Considers current APR, balances, transfer fees, and promotional rates.',
        parameters: {
          type: 'object',
          properties: {
            currentCards: {
              type: 'array',
              description: 'Current credit cards with high-interest debt',
              items: {
                type: 'object',
                description: 'Credit card with debt',
                properties: {
                  name: { type: 'string', description: 'Card name' },
                  balance: { type: 'number', description: 'Current balance' },
                  apr: { type: 'number', description: 'Current APR as decimal' },
                  minPayment: { type: 'number', description: 'Minimum monthly payment' },
                },
                required: ['balance', 'apr'],
              },
            },
            transferAPR: {
              type: 'number',
              description: 'Promotional APR for balance transfer (e.g., 0.03 for 3%)',
            },
            transferFee: {
              type: 'number',
              description: 'Balance transfer fee as percentage (e.g., 0.03 for 3%)',
            },
            promoMonths: {
              type: 'number',
              description: 'Number of months the promotional rate lasts',
            },
          },
          required: ['currentCards', 'transferAPR', 'promoMonths'],
        },
      },
      {
        name: 'optimize_payment_timing',
        description: 'Calculate the optimal payment schedule to minimize interest charges. Shows when to pay each card for maximum impact on credit utilization and interest savings.',
        parameters: {
          type: 'object',
          properties: {
            cards: {
              type: 'array',
              description: 'Credit cards with payment due dates',
              items: {
                type: 'object',
                description: 'Credit card with due date',
                properties: {
                  name: { type: 'string', description: 'Card name' },
                  balance: { type: 'number', description: 'Current balance' },
                  apr: { type: 'number', description: 'APR as decimal' },
                  dueDate: { type: 'number', description: 'Day of month payment is due (1-31)' },
                  minPayment: { type: 'number', description: 'Minimum payment' },
                },
                required: ['balance', 'apr', 'minPayment'],
              },
            },
            monthlyBudget: {
              type: 'number',
              description: 'Total monthly amount available for payments',
            },
            paymentFrequency: {
              type: 'string',
              description: 'How often payments can be made',
              enum: ['weekly', 'biweekly', 'monthly'],
            },
          },
          required: ['cards', 'monthlyBudget'],
        },
      },
      {
        name: 'calculate_credit_impact',
        description: 'Predict how different payment scenarios will impact credit score. Shows effect of paying down balances on credit utilization and score.',
        parameters: {
          type: 'object',
          properties: {
            cards: {
              type: 'array',
              description: 'Credit cards with current balances and limits',
              items: {
                type: 'object',
                description: 'Credit card for utilization calculation',
                properties: {
                  name: { type: 'string', description: 'Card name' },
                  balance: { type: 'number', description: 'Current balance' },
                  limit: { type: 'number', description: 'Credit limit' },
                },
                required: ['balance', 'limit'],
              },
            },
            paymentScenarios: {
              type: 'array',
              description: 'Different payment amounts to compare',
              items: {
                type: 'object',
                description: 'Payment scenario',
                properties: {
                  label: { type: 'string', description: 'Scenario name (e.g., "Minimum Payment", "Double Payment")' },
                  amount: { type: 'number', description: 'Payment amount in dollars' },
                },
                required: ['label', 'amount'],
              },
            },
            currentScore: {
              type: 'number',
              description: 'Current credit score (optional, for more accurate predictions)',
            },
          },
          required: ['cards', 'paymentScenarios'],
        },
      },
    ];

    // Add system message with context
    let systemContext = `You are a helpful financial assistant for Tyche, a budgeting and credit card optimization app.

CRITICAL INSTRUCTIONS:
1. **APR Format**: APR values are stored as decimals (e.g., 0.1999 = 19.99%, 0.20 = 20%). ALWAYS convert to percentage when displaying to users by multiplying by 100.
2. **Use Tools for Calculations**: When users ask about debt payoff strategies, balance transfers, payment timing, or credit impact, you MUST use the appropriate tool to provide accurate calculations and projections.
3. **Debt Payoff Comparisons**: When users ask "what's the best strategy", you MUST:
   a) First call get_user_context to get their credit card data
   b) Calculate total minimum payments across all cards
   c) Use simulate_debt_payoff with strategy='avalanche' and multiple budget scenarios (e.g., minimums + $500, minimums + $1000, minimums + $2000)
   d) Use simulate_debt_payoff with strategy='snowball' and the SAME budget amounts
   e) Compare the results showing: months to payoff, total interest paid, savings, and which strategy is better
4. **Be Specific**: Always provide detailed calculations with actual dollar amounts and timeframes, not just general advice.
5. **Multiple Scenarios**: Show 2-3 different payment scenarios (conservative, moderate, aggressive) so users can see the impact of different payment amounts.
6. **Clear Recommendations**: After showing the calculations, clearly state which strategy saves more money and by how much.`;
    
    if (context.cards && context.cards.length > 0) {
      systemContext += `\n\nUser's credit cards: ${JSON.stringify(context.cards)}`;
    }

    const messagesWithSystem: ChatMessage[] = [
      { role: 'system', content: systemContext },
      ...messages,
    ];

    // Call AI with tools
    const response = await agent.chatWithTools(messagesWithSystem, tools);

    // Execute any tool calls
    let finalResponse = response.content;
    const toolResults: any[] = [];

    if (response.toolCalls && response.toolCalls.length > 0) {
      for (const toolCall of response.toolCalls) {
        console.log(`[Chat] Executing tool: ${toolCall.name}`, toolCall.arguments);

        let toolResult: any;

        // Execute the requested tool
        switch (toolCall.name) {
          case 'simulate_debt_payoff':
            const input: PayoffStrategyInput = {
              cards: toolCall.arguments.cards,
              monthlyBudget: toolCall.arguments.monthlyBudget,
            };
            const strategy = toolCall.arguments.strategy || 'avalanche';
            toolResult = simulatePayoff(input, { strategy });
            break;

          case 'get_user_context':
            // Fetch user's credit cards from database
            const pk = createTenantKey(tenantId, 'USER', userId);
            const cards = await queryItems(
              CREDIT_CARDS_TABLE,
              pk,
              {
                sortKeyCondition: 'begins_with(SK, :cardPrefix)',
                expressionAttributeValues: { ':cardPrefix': 'CARD#' },
              }
            );
            
            toolResult = {
              cards: cards.map(card => ({
                id: card.cardId,
                name: card.name,
                network: card.network,
                last4: card.last4,
                balance: card.balance,
                limit: card.limit,
                apr: card.apr,
                minPayment: card.minPayment,
                dueDate: card.dueDate,
                status: card.status,
              })),
              totalBalance: cards.reduce((sum, card) => sum + (card.balance || 0), 0),
              totalLimit: cards.reduce((sum, card) => sum + (card.limit || 0), 0),
              utilization: cards.length > 0 
                ? (cards.reduce((sum, card) => sum + (card.balance || 0), 0) / 
                   cards.reduce((sum, card) => sum + (card.limit || 0), 0) * 100).toFixed(2) + '%'
                : '0%',
            };
            console.log(`[Chat] Fetched ${cards.length} cards for user ${userId}`);
            break;

          case 'analyze_spending_patterns':
            toolResult = analyzeSpendingPatterns(
              toolCall.arguments.cards,
              toolCall.arguments.timeframe || 'last_month'
            );
            break;

          case 'recommend_balance_transfer':
            toolResult = recommendBalanceTransfer({
              currentCards: toolCall.arguments.currentCards,
              transferAPR: toolCall.arguments.transferAPR,
              transferFee: toolCall.arguments.transferFee || 0.03,
              promoMonths: toolCall.arguments.promoMonths,
            });
            break;

          case 'optimize_payment_timing':
            toolResult = optimizePaymentTiming({
              cards: toolCall.arguments.cards,
              monthlyBudget: toolCall.arguments.monthlyBudget,
              paymentFrequency: toolCall.arguments.paymentFrequency || 'monthly',
            });
            break;

          case 'calculate_credit_impact':
            toolResult = calculateCreditImpact({
              cards: toolCall.arguments.cards,
              paymentScenarios: toolCall.arguments.paymentScenarios,
              currentScore: toolCall.arguments.currentScore,
            });
            break;

          default:
            toolResult = { error: `Unknown tool: ${toolCall.name}` };
        }

        toolResults.push({
          tool: toolCall.name,
          arguments: toolCall.arguments,
          result: toolResult,
        });
      }

      // If tools were called, send results back to AI for final response
      if (toolResults.length > 0) {
        console.log('[Chat] Tool results:', JSON.stringify(toolResults, null, 2));
        
        const toolResultsMessage: ChatMessage = {
          role: 'user',
          content: `Here are the results from the tools you called:\n\n${JSON.stringify(toolResults, null, 2)}\n\nPlease provide a helpful response to the user based on these results.`,
        };

        const followUpMessages = [...messagesWithSystem, toolResultsMessage];
        const finalAIResponse = await agent.chat(followUpMessages);
        finalResponse = finalAIResponse;
        
        console.log('[Chat] Final AI response:', finalResponse);
      }
    }

    // Log chat interaction
    console.log(`[Chat] userId=${userId} model=${agent.getModel().provider}/${agent.getModel().model} tools=${toolResults.length} responseLength=${finalResponse?.length || 0}`);

    return ok({
      message: finalResponse,
      toolsUsed: toolResults.map(t => t.tool),
      model: agent.getModel(),
    });

  } catch (error: any) {
    console.error('[Chat] Error:', error);
    
    // Handle specific AI provider errors
    if (error.message?.includes('API key')) {
      return badRequest('AI provider not configured. Please set up API keys.');
    }

    throw error; // Let global error handler catch it
  }
}

// ========================================
// Tool Implementation Functions
// ========================================

/**
 * Analyze spending patterns across credit cards
 */
function analyzeSpendingPatterns(cards: any[], timeframe: string) {
  const totalDebt = cards.reduce((sum, card) => sum + card.balance, 0);
  const totalLimit = cards.reduce((sum, card) => sum + card.limit, 0);
  const utilization = totalLimit > 0 ? totalDebt / totalLimit : 0;

  // Calculate high-interest cards
  const highInterestCards = cards
    .filter(card => card.apr > 0.18)
    .sort((a, b) => b.apr - a.apr);

  // Find cards with high balances relative to limit
  const highUtilizationCards = cards
    .filter(card => {
      const cardUtil = card.balance / card.limit;
      return cardUtil > 0.3;
    })
    .sort((a, b) => (b.balance / b.limit) - (a.balance / a.limit));

  return {
    summary: {
      totalDebt,
      totalLimit,
      overallUtilization: Math.round(utilization * 100) / 100,
      numberOfCards: cards.length,
      timeframe,
    },
    insights: {
      highInterestCards: highInterestCards.map(card => ({
        name: card.name || `Card ending in ${card.last4}`,
        apr: card.apr,
        balance: card.balance,
        monthlyInterest: Math.round((card.balance * card.apr / 12) * 100) / 100,
      })),
      highUtilizationCards: highUtilizationCards.map(card => ({
        name: card.name || `Card ending in ${card.last4}`,
        utilization: Math.round((card.balance / card.limit) * 100),
        balance: card.balance,
        limit: card.limit,
      })),
    },
    recommendations: [
      utilization > 0.3 ? 'Your overall credit utilization is above 30%, which may hurt your credit score. Consider paying down balances.' : null,
      highInterestCards.length > 0 ? `You have ${highInterestCards.length} card(s) with APR above 18%. Focus on paying these down first.` : null,
      highUtilizationCards.length > 0 ? `${highUtilizationCards.length} card(s) are over 30% utilization. This impacts your credit score.` : null,
    ].filter(Boolean),
  };
}

/**
 * Recommend balance transfer opportunities
 */
function recommendBalanceTransfer(params: {
  currentCards: any[];
  transferAPR: number;
  transferFee: number;
  promoMonths: number;
}) {
  const { currentCards, transferAPR, transferFee, promoMonths } = params;

  // Calculate total debt and current monthly interest
  const totalDebt = currentCards.reduce((sum, card) => sum + card.balance, 0);
  const currentMonthlyInterest = currentCards.reduce(
    (sum, card) => sum + (card.balance * card.apr / 12),
    0
  );

  // Calculate balance transfer costs
  const transferFeeCost = totalDebt * transferFee;
  const promoInterest = (totalDebt * transferAPR / 12) * promoMonths;
  const totalTransferCost = transferFeeCost + promoInterest;

  // Calculate current interest over same period
  const currentTotalInterest = currentMonthlyInterest * promoMonths;

  // Calculate savings
  const savings = currentTotalInterest - totalTransferCost;
  const isWorthIt = savings > 0;

  return {
    recommendation: isWorthIt ? 'recommended' : 'not_recommended',
    analysis: {
      totalDebt,
      transferFee: transferFeeCost,
      promoMonths,
      transferAPR: `${(transferAPR * 100).toFixed(1)}%`,
    },
    comparison: {
      currentPath: {
        monthlyInterest: Math.round(currentMonthlyInterest * 100) / 100,
        totalInterestOverPromo: Math.round(currentTotalInterest * 100) / 100,
      },
      transferPath: {
        transferFee: Math.round(transferFeeCost * 100) / 100,
        promoInterest: Math.round(promoInterest * 100) / 100,
        totalCost: Math.round(totalTransferCost * 100) / 100,
      },
    },
    potentialSavings: Math.round(savings * 100) / 100,
    advice: isWorthIt
      ? `You could save $${Math.round(savings)} by doing a balance transfer. Make sure to pay off the balance before the ${promoMonths}-month promotional period ends.`
      : `A balance transfer would cost you more due to the ${(transferFee * 100).toFixed(1)}% transfer fee. Consider negotiating a lower APR with your current card issuer instead.`,
  };
}

/**
 * Optimize payment timing to minimize interest
 */
function optimizePaymentTiming(params: {
  cards: any[];
  monthlyBudget: number;
  paymentFrequency: string;
}) {
  const { cards, monthlyBudget, paymentFrequency } = params;

  // Sort cards by APR (highest first) for avalanche strategy
  const sortedCards = [...cards].sort((a, b) => b.apr - a.apr);

  // Calculate minimum payments
  const totalMinimum = cards.reduce((sum, card) => {
    const minPayment = Math.max(25, card.balance * 0.02); // 2% or $25 minimum
    return sum + minPayment;
  }, 0);

  const extraBudget = monthlyBudget - totalMinimum;

  if (extraBudget < 0) {
    return {
      warning: 'Your budget is less than minimum payments required',
      totalMinimum: Math.round(totalMinimum * 100) / 100,
      shortfall: Math.round(Math.abs(extraBudget) * 100) / 100,
    };
  }

  // Allocate payments
  const paymentPlan = sortedCards.map(card => {
    const minPayment = Math.max(25, card.balance * 0.02);
    return {
      cardName: card.name || `Card ending in ${card.last4}`,
      apr: `${(card.apr * 100).toFixed(1)}%`,
      balance: card.balance,
      minimumPayment: Math.round(minPayment * 100) / 100,
      recommendedPayment: Math.round(minPayment * 100) / 100, // Will adjust below
      savingsPotential: Math.round((card.balance * card.apr / 12) * 100) / 100,
    };
  });

  // Allocate extra budget to highest APR card
  if (paymentPlan.length > 0 && extraBudget > 0) {
    paymentPlan[0].recommendedPayment = Math.round((paymentPlan[0].minimumPayment + extraBudget) * 100) / 100;
  }

  // Payment frequency advice
  const frequencyAdvice = paymentFrequency === 'weekly'
    ? 'Making weekly payments can reduce your average daily balance, lowering interest charges.'
    : paymentFrequency === 'biweekly'
    ? 'Biweekly payments help reduce your average daily balance faster than monthly payments.'
    : 'Consider switching to biweekly or weekly payments to save on interest.';

  return {
    totalBudget: monthlyBudget,
    totalMinimum: Math.round(totalMinimum * 100) / 100,
    extraBudget: Math.round(extraBudget * 100) / 100,
    paymentPlan,
    frequencyAdvice,
    strategy: 'Focus extra payments on the highest APR card to minimize interest.',
  };
}

/**
 * Calculate credit score impact of different payment scenarios
 */
function calculateCreditImpact(params: {
  cards: any[];
  paymentScenarios: number[];
  currentScore?: number;
}) {
  const { cards, paymentScenarios, currentScore } = params;

  const totalDebt = cards.reduce((sum, card) => sum + card.balance, 0);
  const totalLimit = cards.reduce((sum, card) => sum + card.limit, 0);
  const currentUtilization = totalLimit > 0 ? totalDebt / totalLimit : 0;

  // Calculate impact for each scenario
  const scenarios = paymentScenarios.map(payment => {
    const newDebt = Math.max(0, totalDebt - payment);
    const newUtilization = totalLimit > 0 ? newDebt / totalLimit : 0;
    const utilizationChange = currentUtilization - newUtilization;

    // Rough estimation: Every 10% reduction in utilization ≈ 20-50 point credit score increase
    // This is a simplified model; real credit scoring is more complex
    let scoreImpact = 0;
    if (utilizationChange > 0) {
      const utilizationReductionPercent = utilizationChange * 100;
      scoreImpact = Math.round((utilizationReductionPercent / 10) * 35);
    }

    // Adjust based on utilization thresholds
    let impactLevel = 'minimal';
    if (newUtilization < 0.1 && currentUtilization >= 0.1) {
      impactLevel = 'excellent';
      scoreImpact += 30; // Bonus for getting under 10%
    } else if (newUtilization < 0.3 && currentUtilization >= 0.3) {
      impactLevel = 'significant';
      scoreImpact += 20; // Bonus for getting under 30%
    } else if (newUtilization < 0.5 && currentUtilization >= 0.5) {
      impactLevel = 'moderate';
      scoreImpact += 10;
    } else if (utilizationChange > 0.05) {
      impactLevel = 'modest';
    }

    return {
      paymentAmount: payment,
      newDebt: Math.round(newDebt * 100) / 100,
      newUtilization: Math.round(newUtilization * 100),
      utilizationChange: Math.round(utilizationChange * 100),
      estimatedScoreImpact: scoreImpact > 0 ? `+${scoreImpact}` : '0',
      impactLevel,
      projectedScore: currentScore ? currentScore + scoreImpact : null,
    };
  });

  return {
    currentState: {
      totalDebt,
      totalLimit,
      utilization: Math.round(currentUtilization * 100),
      currentScore: currentScore || 'Not provided',
    },
    scenarios,
    recommendations: [
      currentUtilization > 0.5 ? 'High utilization (>50%) significantly hurts your score. Prioritize getting under 30%.' : null,
      currentUtilization > 0.3 ? 'Getting under 30% utilization will have a noticeable positive impact on your credit score.' : null,
      currentUtilization > 0.1 ? 'Reaching under 10% utilization is ideal for maximizing your credit score.' : null,
      currentUtilization <= 0.1 ? 'Excellent! Your utilization is under 10%, which is optimal for credit scores.' : null,
    ].filter(Boolean),
    disclaimer: 'Credit score impact estimates are approximate. Actual changes depend on many factors including payment history, credit age, and credit mix.',
  };
}
