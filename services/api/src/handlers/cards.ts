/**
 * Credit Card Handlers
 * 
 * 🔒 SECURITY: We never store full credit card numbers, CVV, or expiration dates.
 * Only store: network (Visa/Mastercard/etc) + last 4 digits for user identification.
 * This eliminates PCI DSS compliance burden and protects users from data breaches.
 */

import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import type { CreditCardAccount, CardNetwork } from '@tyche/types';
import { ok, created, badRequest, notFound } from '../utils';
import { parseBody } from '../utils';
import { createTenantKey, generateId, putItem, getItem, queryItems, updateItem, deleteItem } from '../utils/db';
import { authorize } from '../middleware/authorize';

const CREDIT_CARDS_TABLE = process.env.CREDIT_CARDS_TABLE || 'tyche-credit-cards';

/**
 * Get user's credit cards
 * GET /v1/cards
 * 
 * Returns: Array of credit cards for the authenticated user
 * 
 * 🔒 Security: Only returns last 4 digits, never full numbers
 */
export async function getCards(event: APIGatewayProxyEventV2, userId?: string) {
  if (!userId) {
    return badRequest('User ID required');
  }

  // Get tenant context from authorization
  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return badRequest('Authorization context required');
  }

  const { tenantId } = auth.context;

  try {
    // Query all cards for this user (tenant-isolated)
    const pk = createTenantKey(tenantId, 'USER', userId);
    const cards = await queryItems(
      CREDIT_CARDS_TABLE,
      pk,
      {
        sortKeyCondition: 'begins_with(SK, :cardPrefix)',
        expressionAttributeValues: { ':cardPrefix': 'CARD#' },
      }
    );

    console.log(`[GetCards] userId=${userId} tenantId=${tenantId} found=${cards.length}`);

    return ok({ cards });
  } catch (error) {
    console.error('[GetCards] Error:', error);
    return badRequest('Failed to fetch cards');
  }
}

/**
 * Create new credit card
 * POST /v1/cards
 * 
 * Body: {
 *   name: string,              // User-friendly name (e.g., "My Chase Card")
 *   network: CardNetwork,      // 'Visa' | 'Mastercard' | 'American Express' | 'Discover' | 'Other'
 *   lastFourDigits: string,    // Last 4 digits only (e.g., "4532")
 *   issuer?: string,           // Bank name (optional)
 *   balance: number,           // Current balance owed
 *   limit: number,             // Credit limit
 *   apr: number,               // Annual Percentage Rate (decimal: 0.1999 = 19.99%)
 *   minPayment: number,        // Monthly minimum payment
 *   dueDayOfMonth: number      // Payment due day (1-28)
 * }
 * 
 * 🔒 Security: Rejects any request containing full card numbers
 */
export async function createCard(event: APIGatewayProxyEventV2, userId?: string) {
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

  const { 
    name, 
    network, 
    lastFourDigits, 
    issuer, 
    balance, 
    limit, 
    apr, 
    minPayment, 
    dueDayOfMonth 
  } = body;

  // Validate required fields
  if (!name || !network || !lastFourDigits) {
    return badRequest('Missing required fields: name, network, lastFourDigits');
  }

  if (typeof balance !== 'number' || typeof limit !== 'number' || typeof apr !== 'number') {
    return badRequest('Missing or invalid required fields: balance, limit, apr');
  }

  if (typeof minPayment !== 'number' || typeof dueDayOfMonth !== 'number') {
    return badRequest('Missing or invalid required fields: minPayment, dueDayOfMonth');
  }

  // Validate card network
  const validNetworks: CardNetwork[] = ['Visa', 'Mastercard', 'American Express', 'Discover', 'Other'];
  if (!validNetworks.includes(network)) {
    return badRequest(`Invalid network. Must be one of: ${validNetworks.join(', ')}`);
  }

  // Validate last 4 digits format (exactly 4 digits)
  if (!/^\d{4}$/.test(lastFourDigits)) {
    return badRequest('lastFourDigits must be exactly 4 digits');
  }

  // 🔒 SECURITY CHECK: Reject if someone tries to send full card number
  if (lastFourDigits.length > 4) {
    console.error(`[SECURITY] Attempt to store more than 4 digits. userId=${userId} tenantId=${tenantId}`);
    return badRequest('Security error: Only last 4 digits allowed');
  }

  // Validate APR range (0-100%)
  if (apr < 0 || apr > 1) {
    return badRequest('APR must be between 0 and 1 (e.g., 0.1999 for 19.99%)');
  }

  // Validate due day (1-28 to avoid month-end issues)
  if (dueDayOfMonth < 1 || dueDayOfMonth > 28) {
    return badRequest('dueDayOfMonth must be between 1 and 28');
  }

  try {
    // Generate unique card ID
    const cardId = generateId('card');

    // Build tenant-aware keys
    const pk = createTenantKey(tenantId, 'USER', userId);
    const sk = `CARD#${cardId}`;

    const card: CreditCardAccount = {
      id: cardId,
      name,
      network,
      lastFourDigits,
      issuer,
      balance,
      limit,
      apr,
      minPayment,
      dueDayOfMonth,
      isActive: true,
      currency: 'USD',
    };

    // Write to DynamoDB with tenant isolation
    await putItem(CREDIT_CARDS_TABLE, {
      PK: pk,
      SK: sk,
      tenantId,
      userId,
      ...card,
    });

    console.log(`[CreateCard] userId=${userId} tenantId=${tenantId} cardId=${cardId} network=${network} lastFour=****${lastFourDigits}`);

    return created({ card });
  } catch (error) {
    console.error('[CreateCard] Error:', error);
    return badRequest('Failed to create card');
  }
}

/**
 * Update credit card
 * 
 * PUT /v1/cards/:cardId
 * 
 * Updates mutable fields of an existing credit card. Prevents modification
 * of immutable identifiers (lastFourDigits, network) for security.
 */
export async function updateCard(event: APIGatewayProxyEventV2, userId?: string) {
  if (!userId) {
    return badRequest('User ID required');
  }

  // Get tenant context from authorization
  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return badRequest('Authorization context required');
  }

  const { tenantId } = auth.context;
  
  const cardId = event.pathParameters?.cardId;
  
  if (!cardId) {
    return badRequest('Missing cardId in path');
  }

  const body = parseBody(event);

  if (!body) {
    return badRequest('Invalid JSON body');
  }

  // 🔒 SECURITY: Prevent modification of immutable identifiers
  if ('lastFourDigits' in body) {
    return badRequest('Cannot modify lastFourDigits (immutable identifier)');
  }

  if ('network' in body) {
    return badRequest('Cannot modify network (immutable identifier)');
  }

  // Prevent modification of system fields
  if ('id' in body || 'userId' in body || 'tenantId' in body) {
    return badRequest('Cannot modify system fields');
  }

  // Validate numeric fields if provided
  if ('apr' in body && (body.apr < 0 || body.apr > 1)) {
    return badRequest('APR must be between 0 and 1');
  }

  if ('dueDayOfMonth' in body && (body.dueDayOfMonth < 1 || body.dueDayOfMonth > 28)) {
    return badRequest('dueDayOfMonth must be between 1 and 28');
  }

  try {
    // Build tenant-aware keys
    const pk = createTenantKey(tenantId, 'USER', userId);
    const sk = `CARD#${cardId}`;

    // Get existing card
    const existing = await getItem(CREDIT_CARDS_TABLE, pk, sk);

    if (!existing) {
      return notFound('Card not found');
    }

    // Verify ownership (double-check even though key includes userId)
    if (existing.userId !== userId) {
      console.error(`[SECURITY] User ${userId} attempted to update card ${cardId} owned by ${existing.userId}`);
      return badRequest('Card not found'); // Don't reveal that card exists
    }

    // Update only allowed fields
    await updateItem(CREDIT_CARDS_TABLE, pk, sk, body);

    // Get updated card to return full object
    const updatedCard = await getItem(CREDIT_CARDS_TABLE, pk, sk);

    if (!updatedCard) {
      return badRequest('Failed to retrieve updated card');
    }

    console.log(`[UpdateCard] userId=${userId} tenantId=${tenantId} cardId=${cardId} updates=${JSON.stringify(Object.keys(body))}`);

    return ok({ 
      card: updatedCard,
    });
  } catch (error) {
    console.error('[UpdateCard] Error:', error);
    return badRequest('Failed to update card');
  }
}

/**
 * Delete credit card
 * DELETE /v1/cards/{cardId}
 */
export async function deleteCard(event: APIGatewayProxyEventV2, userId?: string) {
  if (!userId) {
    return badRequest('User ID required');
  }

  // Get tenant context from authorization
  const auth = await authorize(event, 'user');
  if (!auth.authorized || !auth.context) {
    return badRequest('Authorization context required');
  }

  const { tenantId } = auth.context;
  
  const cardId = event.pathParameters?.cardId;
  
  if (!cardId) {
    return badRequest('Missing cardId in path');
  }

  try {
    // Build tenant-aware keys
    const pk = createTenantKey(tenantId, 'USER', userId);
    const sk = `CARD#${cardId}`;

    // Get existing card to verify ownership
    const existing = await getItem(CREDIT_CARDS_TABLE, pk, sk);

    if (!existing) {
      return notFound('Card not found');
    }

    // Verify ownership
    if (existing.userId !== userId) {
      console.error(`[SECURITY] User ${userId} attempted to delete card ${cardId} owned by ${existing.userId}`);
      return badRequest('Card not found');
    }

    // Delete from DynamoDB
    await deleteItem(CREDIT_CARDS_TABLE, pk, sk);

    console.log(`[DeleteCard] userId=${userId} tenantId=${tenantId} cardId=${cardId}`);

    return ok({ 
      message: 'Card deleted successfully',
      cardId,
    });
  } catch (error) {
    console.error('[DeleteCard] Error:', error);
    return badRequest('Failed to delete card');
  }
}
