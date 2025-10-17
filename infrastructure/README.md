# Tyche AWS Infrastructure

AWS CDK infrastructure for Tyche budgeting app backend.

## Architecture

```
┌──────────────┐
│   Users      │
│ (Web/Mobile) │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│  API Gateway │ ◄── HTTPS endpoints
│  + Cognito   │     JWT authentication
└──────┬───────┘
       │
       ▼
┌──────────────┐
│    Lambda    │ ◄── Node.js 20
│   Functions  │     TypeScript
└──────┬───────┘
       │
   ┌───┴────────────────┐
   │                    │
   ▼                    ▼
┌─────────┐      ┌──────────┐
│DynamoDB │      │    S3    │
│ Tables  │      │  Bucket  │
└─────────┘      └──────────┘
```

## Resources Created

### Authentication
- **Cognito User Pool**: Email-based auth with password policies
- **User Pool Client**: For web and mobile apps

### Data Storage
- **Users Table** (`tyche-users`): User profiles and preferences
- **Transactions Table** (`tyche-transactions`): Income and expenses with date index
- **Credit Cards Table** (`tyche-credit-cards`): Card details and balances

### File Storage
- **S3 Bucket** (`tyche-uploads-{accountId}`): CSV/PDF/image uploads with CORS

### Compute
- **API Lambda**: Handles all API routes (Node.js 20.x)

### API
- **REST API Gateway**: Routes with Cognito authorization
  - `GET /public/health` - Health check (no auth)
  - `POST /v1/payoff/simulate` - Debt payoff simulation
  - `POST /v1/chat` - AI chat with financial tools
  - `GET/POST /v1/cards` - Credit card management
  - `PUT/DELETE /v1/cards/{id}` - Update/delete cards

## Prerequisites

### 1. AWS Account Setup

```bash
# Install AWS CLI (if not installed)
brew install awscli  # macOS
# or download from: https://aws.amazon.com/cli/

# Configure AWS credentials
aws configure
# Enter:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region: us-east-1 (or your preferred region)
# - Output format: json
```

### 2. Bootstrap CDK (one-time per AWS account/region)

```bash
cd infrastructure
npm run bootstrap
```

This creates an S3 bucket and IAM roles CDK needs for deployments.

### 3. Set AI Provider API Key

Choose your AI provider and set the API key as an environment variable:

**Option A: Claude (Anthropic) - Recommended**
```bash
export AI_PROVIDER=anthropic
export AI_MODEL=claude-3-5-sonnet-latest
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Option B: GPT-4 (OpenAI)**
```bash
export AI_PROVIDER=openai
export AI_MODEL=gpt-4-turbo-preview
export OPENAI_API_KEY=sk-your-key-here
```

**Option C: Grok (xAI)**
```bash
export AI_PROVIDER=xai
export AI_MODEL=grok-beta
export XAI_API_KEY=xai-your-key-here
```

**Option D: DeepSeek**
```bash
export AI_PROVIDER=deepseek
export AI_MODEL=deepseek-chat
export DEEPSEEK_API_KEY=sk-your-key-here
```

## Deployment

### Build Lambda Code

```bash
# From repo root
npm run build
```

This compiles all TypeScript packages including the API service.

### Deploy Infrastructure

```bash
cd infrastructure

# Preview changes (optional)
npm run diff

# Deploy to AWS
npm run deploy
```

Deployment takes ~3-5 minutes. You'll see progress and CloudFormation events.

### Deployment Output

After successful deployment, note these values:

```
Outputs:
TycheStack.UserPoolId = us-east-1_ABC123
TycheStack.UserPoolClientId = 1234567890abcdef
TycheStack.ApiUrl = https://abc123.execute-api.us-east-1.amazonaws.com/prod/
TycheStack.UploadsBucketName = tyche-uploads-123456789012
```

Save these - your frontend needs them!

## Testing the API

### 1. Test Health Check (no auth)

```bash
API_URL="https://your-api-id.execute-api.us-east-1.amazonaws.com/prod"

curl $API_URL/public/health
```

Expected response:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "aiProvider": {
      "provider": "anthropic",
      "model": "claude-3-5-sonnet-latest",
      "configured": true
    }
  }
}
```

### 2. Create Test User

```bash
# Install AWS CLI if not already
aws cognito-idp sign-up \
  --client-id YOUR_USER_POOL_CLIENT_ID \
  --username test@example.com \
  --password TestPassword123! \
  --user-attributes Name=email,Value=test@example.com

# Confirm user (admin command, skip email verification)
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id YOUR_USER_POOL_ID \
  --username test@example.com
```

### 3. Get Auth Token

```bash
aws cognito-idp initiate-auth \
  --client-id YOUR_USER_POOL_CLIENT_ID \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=test@example.com,PASSWORD=TestPassword123!
```

Copy the `IdToken` from the response.

### 4. Test Payoff Simulation (requires auth)

```bash
TOKEN="your-id-token-here"

curl -X POST $API_URL/v1/payoff/simulate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "cards": [
      {
        "id": "card1",
        "name": "Chase",
        "balance": 5000,
        "limit": 10000,
        "apr": 0.1999,
        "minPayment": 100,
        "dueDayOfMonth": 15
      },
      {
        "id": "card2",
        "name": "Amex",
        "balance": 2000,
        "limit": 5000,
        "apr": 0.2499,
        "minPayment": 50,
        "dueDayOfMonth": 10
      }
    ],
    "monthlyBudget": 500,
    "strategy": "avalanche"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "strategy": "avalanche",
    "result": {
      "monthsToDebtFree": 18,
      "totalInterest": 1247.32,
      "steps": [...]
    },
    "recommendation": "Using the avalanche method, you'll be debt-free in 1 year and 6 months and pay $1247.32 in total interest."
  }
}
```

### 5. Test AI Chat (requires auth and AI API key)

```bash
curl -X POST $API_URL/v1/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": "I have $5000 debt at 19.99% APR and $2000 at 24.99% APR. I can pay $500/month extra. What should I do?"
      }
    ],
    "context": {
      "cards": [
        {
          "id": "card1",
          "name": "Card 1",
          "balance": 5000,
          "apr": 0.1999,
          "minPayment": 100,
          "limit": 10000,
          "dueDayOfMonth": 15
        },
        {
          "id": "card2",
          "name": "Card 2",
          "balance": 2000,
          "apr": 0.2499,
          "minPayment": 50,
          "limit": 5000,
          "dueDayOfMonth": 10
        }
      ]
    }
  }'
```

The AI will:
1. Analyze your situation
2. Call the `simulate_debt_payoff` tool
3. Return personalized advice with specific numbers

## Updating the API

After making code changes:

```bash
# Rebuild Lambda code
npm run build

# Redeploy (only updates changed resources)
cd infrastructure
npm run deploy
```

Hot tip: Lambda deployment is fast (~30 seconds) if only code changed.

## Monitoring & Logs

### View Lambda Logs

```bash
# Stream logs in real-time
aws logs tail /aws/lambda/tyche-api --follow

# Or use CloudWatch in AWS Console
```

### Check API Gateway Metrics

AWS Console → API Gateway → Your API → Dashboard

Monitor:
- Request count
- Error rate (4xx, 5xx)
- Latency (p50, p99)

## Cost Estimate

Based on moderate usage:

| Service | Usage | Monthly Cost |
|---------|-------|--------------|
| Lambda | 1M requests, 512MB, 1s avg | $5 |
| API Gateway | 1M requests | $3.50 |
| DynamoDB | 1GB storage, on-demand | $1.25 |
| S3 | 10GB storage, 1K uploads | $0.30 |
| Cognito | 1K active users | Free |
| **AI (Claude)** | 10M tokens input, 2M output | **~$60** |
| **Total** | | **~$70/month** |

**Cost optimization tips**:
- Use DeepSeek instead of Claude: Reduces AI cost to ~$3/month
- Enable DynamoDB auto-scaling for production
- Set S3 lifecycle rules (already configured for temp files)

## Cleanup

To delete all resources:

```bash
cd infrastructure
npm run destroy
```

⚠️ **Warning**: This deletes all data (tables, S3 files, users). Use with caution!

## Troubleshooting

### Lambda returns 500 error

Check logs:
```bash
aws logs tail /aws/lambda/tyche-api --follow
```

Common issues:
- Missing AI API key → Set `ANTHROPIC_API_KEY` env var in Lambda console
- DynamoDB permissions → Check IAM role has access
- TypeScript not compiled → Run `npm run build`

### AI chat not working

1. Verify API key is set in Lambda environment variables
2. Check provider is available in your region
3. Test with health endpoint to see AI config status

### CORS errors from frontend

Update API Gateway CORS settings in `infrastructure/lib/tyche-stack.ts`:
```typescript
allowOrigins: ['https://yourdomain.com'] // Instead of '*'
```

## Next Steps

1. ✅ Infrastructure deployed
2. 🔄 Wire up DynamoDB operations (currently mocked)
3. 🔄 Add file upload/OCR processing
4. 🔄 Implement transactions endpoints
5. 🔄 Add user profile management
6. 🔄 Build frontend integration
7. 🔄 Add monitoring and alerts

## Architecture Decisions

### Why single Lambda for all routes?
- **Simpler**: One function, one deployment
- **Cold starts**: Warm function serves all routes
- **Cost**: No per-function overhead
- **Trade-off**: Can split later if needed

### Why Cognito over Auth0/custom?
- **Integrated**: Native AWS integration
- **Secure**: Managed MFA, password policies
- **Cost**: Free tier covers most use cases
- **Trade-off**: Less customizable UI

### Why DynamoDB over RDS?
- **Serverless**: Auto-scales, no ops
- **Fast**: Single-digit ms latency
- **Cost**: Pay per request
- **Trade-off**: No complex SQL queries (but we don't need them)

### Why REST over GraphQL?
- **Simpler**: Everyone knows REST
- **Tools**: curl, Postman work out of box
- **Learning**: Easier for students
- **Trade-off**: More endpoints, but clearer contracts

## Support

Questions? Check:
- AWS CDK Docs: https://docs.aws.amazon.com/cdk/
- Cognito Guide: https://docs.aws.amazon.com/cognito/
- Lambda Best Practices: https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html
