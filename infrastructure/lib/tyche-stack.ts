import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class TycheStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ========================================
    // COGNITO - Authentication
    // ========================================
    // What: User pool for authentication
    // Why: Managed auth service with MFA, password policies, social login
    // Alternative: Auth0 (third-party), custom JWT (more work)
    
    const userPool = new cognito.UserPool(this, 'TycheUserPool', {
      userPoolName: 'tyche-users',
      selfSignUpEnabled: true,
      signInAliases: {
        email: true,
        username: false, // Email-only login for simplicity
      },
      autoVerify: {
        email: true, // Users must verify email before login
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false, // Keep it user-friendly
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // WARNING: Dev only! Use RETAIN in prod
      // ========================================
      // SES EMAIL CONFIGURATION
      // ========================================
      // What: Use Amazon SES for sending emails instead of Cognito default
      // Why: Higher sending limits (50K/day vs 50/day), better deliverability, custom FROM address
      // Alternative: COGNITO_DEFAULT (unreliable, limited to 50 emails/day)
      email: cognito.UserPoolEmail.withSES({
        fromEmail: 'app.tyche.financial@gmail.com',
        fromName: 'Tyche Financial Assistant',
        replyTo: 'app.tyche.financial@gmail.com',
      }),
      // 🔐 Multi-tenancy: Custom attributes for RBAC
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        // Tenant ID - cannot be changed after user creation (security)
        tenantId: new cognito.StringAttribute({ mutable: false }),
        // DEPRECATED: role attribute (migrated to Cognito Groups)
        // Kept for backwards compatibility during migration
        role: new cognito.StringAttribute({ mutable: true }),
        // Fine-grained permissions - for specific features beyond role
        // e.g., "export_data", "view_all_tenants", "manage_billing"
        permissions: new cognito.StringAttribute({ mutable: true }),
      },
    });

    // ========================================
    // COGNITO GROUPS - Role-Based Access Control (RBAC)
    // ========================================
    // What: Cognito groups for organizing users by role
    // Why: Built-in support, automatic JWT inclusion, easier user management
    // Alternative: Custom attributes (previous approach), Amazon Verified Permissions (overkill)
    
    // Admin Group - Full system access
    const adminGroup = new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Admins',
      description: 'Administrators with full system access (user management, audit logs, system config)',
      precedence: 1, // Lower number = higher priority when user is in multiple groups
    });

    // Dev Team Group - Analytics and debugging access
    const devGroup = new cognito.CfnUserPoolGroup(this, 'DevGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'DevTeam',
      description: 'Developers with access to metrics, analytics, and debugging tools',
      precedence: 2,
    });

    // Users Group - Standard user access (default for all users)
    const userGroup = new cognito.CfnUserPoolGroup(this, 'UserGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'Users',
      description: 'Standard users with access to their own financial data',
      precedence: 3,
    });

    // User pool client for web/mobile apps
    const userPoolClient = userPool.addClient('TycheWebClient', {
      authFlows: {
        userPassword: true,
        userSrp: true, // Secure Remote Password (recommended)
      },
      generateSecret: false, // Public clients (web/mobile) don't use secrets
    });

    // ========================================
    // COGNITO POST-CONFIRMATION TRIGGER
    // ========================================
    // What: Lambda function that runs after user confirms email
    // Why: Automatically add new users to the "Users" group
    // Alternative: Manually add users (error-prone, bad UX)
    // NOTE: Deployed via AWS CLI (see setup-post-confirmation.sh) to avoid circular dependency
    // TODO: Research if CDK v2 has a way to avoid circular dependency with User Pool triggers
    
    /*
    const postConfirmationFn = new lambda.Function(this, 'PostConfirmationLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        const { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } = require('@aws-sdk/client-cognito-identity-provider');
        const client = new CognitoIdentityProviderClient();
        
        exports.handler = async (event) => {
          console.log('Post-confirmation trigger:', JSON.stringify(event, null, 2));
          
          try {
            // Add user to default "Users" group
            const command = new AdminAddUserToGroupCommand({
              UserPoolId: event.userPoolId,
              Username: event.userName,
              GroupName: 'Users'
            });
            
            await client.send(command);
            console.log(\`Successfully added user \${event.userName} to Users group\`);
          } catch (error) {
            console.error('Error adding user to group:', error);
            // Don't fail confirmation if group assignment fails
            // User can still be manually added to group later
          }
          
          return event;
        };
      `),
      description: 'Automatically adds new users to the Users group after email confirmation',
      timeout: cdk.Duration.seconds(10),
    });

    // Grant Lambda permission to add users to groups
    postConfirmationFn.addToRolePolicy(new iam.PolicyStatement({
      actions: ['cognito-idp:AdminAddUserToGroup'],
      resources: [userPool.userPoolArn],
    }));

    // Attach trigger to user pool
    userPool.addTrigger(
      cognito.UserPoolOperation.POST_CONFIRMATION,
      postConfirmationFn
    );
    */

    // ========================================
    // DYNAMODB - Data Storage
    // ========================================
    // What: NoSQL tables for user data
    // Why: Serverless, fast, auto-scaling, pay-per-use
    // Alternative: RDS/PostgreSQL (better for complex queries but more ops overhead)

    // Users table - stores user profiles and preferences
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'tyche-users',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // TENANT#tenantId#USER#userId
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },       // METADATA or other entity types
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // Auto-scaling, no capacity planning
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: { // Fixed deprecated property
        pointInTimeRecoveryEnabled: true // Enable backups
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Dev only!
    });

    // GSI for email lookups (for login, user search)
    usersTable.addGlobalSecondaryIndex({
      indexName: 'EmailIndex',
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for role-based queries (for admin listing users by role)
    usersTable.addGlobalSecondaryIndex({
      indexName: 'RoleIndex',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'role', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Transactions table - stores income/expenses
    const transactionsTable = new dynamodb.Table(this, 'TransactionsTable', {
      tableName: 'tyche-transactions',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // TENANT#tenantId#USER#userId
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },       // TRANSACTION#transactionId
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for querying by date
    transactionsTable.addGlobalSecondaryIndex({
      indexName: 'DateIndex',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'date', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Credit cards table - stores card details and balances
    const creditCardsTable = new dynamodb.Table(this, 'CreditCardsTable', {
      tableName: 'tyche-credit-cards',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // TENANT#tenantId#USER#userId
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },       // CARD#cardId
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Audit logs table - stores all admin/dev actions for compliance
    const auditLogsTable = new dynamodb.Table(this, 'AuditLogsTable', {
      tableName: 'tyche-audit-logs',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // TENANT#tenantId
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },       // LOG#timestamp#randomId
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl', // Auto-delete logs after 90 days
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // GSI for querying logs by user (who performed the action)
    auditLogsTable.addGlobalSecondaryIndex({
      indexName: 'UserIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI for querying logs by action type
    auditLogsTable.addGlobalSecondaryIndex({
      indexName: 'ActionIndex',
      partitionKey: { name: 'tenantId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'action', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Financial Snapshots table - stores periodic financial health metrics
    const snapshotsTable = new dynamodb.Table(this, 'FinancialSnapshotsTable', {
      tableName: 'tyche-financial-snapshots',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // TENANT#tenantId#USER#userId
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },       // SNAPSHOT#timestamp#snapshotId
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // GSI for querying snapshots by timestamp (for trend analysis)
    snapshotsTable.addGlobalSecondaryIndex({
      indexName: 'TimestampIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Financial Goals table - stores user debt payoff and savings goals
    const goalsTable = new dynamodb.Table(this, 'FinancialGoalsTable', {
      tableName: 'tyche-goals',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // TENANT#tenantId#USER#userId
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },       // GOAL#timestamp#goalId
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // GSI for querying goals by status
    goalsTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // User Analytics table - stores engagement and behavior metrics
    const analyticsTable = new dynamodb.Table(this, 'UserAnalyticsTable', {
      tableName: 'tyche-user-analytics',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // TENANT#tenantId#USER#userId
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },       // PERIOD#periodStart#periodEnd
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl', // Optional: auto-delete old analytics after N days
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ========================================
    // BUDGET & SPENDING MANAGEMENT TABLES
    // ========================================
    // What: Tables for budget tracking, transactions, and spending analytics
    // Why: Foundation for personalized debt payoff recommendations based on real spending
    // See: docs/BUDGET_SPENDING_SCHEMA.md for detailed schema design

    // Budgets table - stores monthly budgets, categories, and recurring transactions
    const budgetsTable = new dynamodb.Table(this, 'BudgetsTable', {
      tableName: 'tyche-budgets',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // TENANT#tenantId#USER#userId
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },       // BUDGET#YYYY-MM | CATEGORY#categoryId | RECURRING#recurringId
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // GSI for user-level budget queries
    budgetsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING }, // USER#userId
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },       // BUDGET#YYYY-MM | CATEGORY#type | RECURRING#nextDue
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Transaction Details table - stores all spending/income transactions with categorization
    const transactionDetailsTable = new dynamodb.Table(this, 'TransactionDetailsTable', {
      tableName: 'tyche-transaction-details',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // TENANT#tenantId#USER#userId
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },       // TXN#YYYY-MM-DD#timestamp#txnId
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // GSI1 for category-level queries (all transactions in a budget month + category)
    transactionDetailsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING }, // BUDGET#YYYY-MM#CATEGORY#categoryType
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },       // TXN#YYYY-MM-DD#timestamp
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // GSI2 for merchant-level queries (spending patterns by merchant)
    transactionDetailsTable.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING }, // MERCHANT#merchantName
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },       // TXN#YYYY-MM-DD#timestamp
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Spending Analytics table - stores pre-calculated spending insights
    const spendingAnalyticsTable = new dynamodb.Table(this, 'SpendingAnalyticsTable', {
      tableName: 'tyche-spending-analytics',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // TENANT#tenantId#USER#userId
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },       // ANALYTICS#YYYY-MM
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      timeToLiveAttribute: 'ttl', // Optional: auto-delete old analytics after 24 months
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // GSI for user analytics queries across time periods
    spendingAnalyticsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING }, // USER#userId
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },       // ANALYTICS#YYYY-MM
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Budget Goals table - stores savings and spending reduction goals
    const budgetGoalsTable = new dynamodb.Table(this, 'BudgetGoalsTable', {
      tableName: 'tyche-budget-goals',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING }, // TENANT#tenantId#USER#userId
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },       // GOAL#goalId
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // GSI for querying goals by status and target date
    budgetGoalsTable.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING }, // USER#userId
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },       // GOAL#status#targetDate
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ========================================
    // S3 - File Storage
    // ========================================
    // What: Object storage for uploaded files (CSV, PDF, images)
    // Why: Cheap, durable, integrates with Textract for OCR
    // Alternative: Store in DynamoDB (only for small files <400KB)

    const uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: `tyche-uploads-${this.account}`, // Must be globally unique
      encryption: s3.BucketEncryption.S3_MANAGED,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
          allowedOrigins: ['*'], // Restrict in production to your domains
          allowedHeaders: ['*'],
        },
      ],
      lifecycleRules: [
        {
          // Auto-delete old uploads after 90 days
          expiration: cdk.Duration.days(90),
          prefix: 'temp/', // Only applies to temp uploads
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Dev only!
      autoDeleteObjects: true, // Allow CDK to clean up on stack delete
    });

    // ========================================
    // LAMBDA - API Functions
    // ========================================
    // What: Serverless functions for API logic
    // Why: No servers to manage, auto-scales, pay per invocation
    // Alternative: ECS/Fargate (for long-running processes)

    // Shared Lambda execution role with necessary permissions
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    });

    // Grant Lambda access to DynamoDB tables
    usersTable.grantReadWriteData(lambdaRole);
    transactionsTable.grantReadWriteData(lambdaRole);
    creditCardsTable.grantReadWriteData(lambdaRole);
    auditLogsTable.grantReadWriteData(lambdaRole);
    snapshotsTable.grantReadWriteData(lambdaRole);
    goalsTable.grantReadWriteData(lambdaRole);
    analyticsTable.grantReadWriteData(lambdaRole);
    budgetsTable.grantReadWriteData(lambdaRole);
    transactionDetailsTable.grantReadWriteData(lambdaRole);
    spendingAnalyticsTable.grantReadWriteData(lambdaRole);
    budgetGoalsTable.grantReadWriteData(lambdaRole);
    
    // Grant Lambda access to S3
    uploadsBucket.grantReadWrite(lambdaRole);

    // Environment variables shared by all Lambdas
    const lambdaEnvironment = {
      USERS_TABLE: usersTable.tableName,
      TRANSACTIONS_TABLE: transactionsTable.tableName,
      CREDIT_CARDS_TABLE: creditCardsTable.tableName,
      AUDIT_LOGS_TABLE: auditLogsTable.tableName,
      SNAPSHOTS_TABLE: snapshotsTable.tableName,
      GOALS_TABLE: goalsTable.tableName,
      ANALYTICS_TABLE: analyticsTable.tableName,
      BUDGETS_TABLE: budgetsTable.tableName,
      TRANSACTION_DETAILS_TABLE: transactionDetailsTable.tableName,
      SPENDING_ANALYTICS_TABLE: spendingAnalyticsTable.tableName,
      BUDGET_GOALS_TABLE: budgetGoalsTable.tableName,
      UPLOADS_BUCKET: uploadsBucket.bucketName,
      USER_POOL_ID: userPool.userPoolId,
      USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
      AI_PROVIDER: process.env.AI_PROVIDER || 'anthropic',
      AI_MODEL: process.env.AI_MODEL || 'claude-3-5-sonnet-latest',
      // AI API Keys - set these in your environment before deploying
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      XAI_API_KEY: process.env.XAI_API_KEY || '',
      DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || '',
    };

    // Main API Lambda - handles most endpoints
    const apiLambda = new lambda.Function(this, 'ApiLambda', {
      functionName: 'tyche-api',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../services/api/dist')),
      environment: lambdaEnvironment,
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      memorySize: 512, // MB - adjust based on actual usage
    });

    // ========================================
    // HTTP API (V2) - Modern, Fast, Cheap!
    // ========================================
    // What: HTTP API that routes requests to Lambda
    // Why: 71% cheaper ($1 vs $3.50 per million), 60% faster, simpler
    // Alternative: REST API (more features but slower/expensive)

    // JWT Authorizer for Cognito
    const authorizer = new HttpJwtAuthorizer('CognitoAuthorizer', 
      `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
      {
        jwtAudience: [userPoolClient.userPoolClientId],
      }
    );

    // Lambda integration
    const apiIntegration = new HttpLambdaIntegration('LambdaIntegration', apiLambda);

    // Create HTTP API
    const api = new apigatewayv2.HttpApi(this, 'TycheHttpApi', {
      apiName: 'Tyche API',
      description: 'Tyche budgeting app HTTP API (V2)',
      corsPreflight: {
        allowOrigins: ['*'], // Restrict in production!
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization'],
        maxAge: cdk.Duration.days(1),
      },
    });

    // Add routes with Lambda proxy integration
    // Note: HTTP API V2 uses catch-all routes, so the Lambda handles all routing internally
    
    // Public routes (no auth)
    api.addRoutes({
      path: '/public/{proxy+}',
      methods: [apigatewayv2.HttpMethod.ANY],
      integration: apiIntegration,
    });

    // OPTIONS route - no auth required (CORS preflight)
    api.addRoutes({
      path: '/v1/{proxy+}',
      methods: [apigatewayv2.HttpMethod.OPTIONS],
      integration: apiIntegration,
      // No authorizer for OPTIONS - allows CORS preflight to succeed
    });

    // Protected routes (require JWT auth for GET, POST, PUT, DELETE)
    api.addRoutes({
      path: '/v1/{proxy+}',
      methods: [
        apigatewayv2.HttpMethod.GET,
        apigatewayv2.HttpMethod.POST,
        apigatewayv2.HttpMethod.PUT,
        apigatewayv2.HttpMethod.DELETE,
      ],
      integration: apiIntegration,
      authorizer: authorizer,
    });

    // ========================================
    // OUTPUTS - Important values to export
    // ========================================
    // What: CloudFormation outputs displayed after deployment
    // Why: Frontend needs these values to connect to backend

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
      description: 'Cognito User Pool ID',
      exportName: 'TycheUserPoolId',
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
      description: 'Cognito User Pool Client ID',
      exportName: 'TycheUserPoolClientId',
    });

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url!,
      description: 'HTTP API Gateway URL',
      exportName: 'TycheApiUrl',
    });

    new cdk.CfnOutput(this, 'UploadsBucketName', {
      value: uploadsBucket.bucketName,
      description: 'S3 Uploads Bucket Name',
      exportName: 'TycheUploadsBucket',
    });
  }
}
