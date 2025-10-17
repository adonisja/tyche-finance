# Tyche Finance

> AI-powered personal finance application to help users manage budgets and optimize credit card debt payoff strategies.

**Status**: ✅ **DEPLOYED** - Backend + Frontend Budget/Spending Features Complete!  
**Version**: 0.5.0 (Budget & Spending Dashboard UI)  
**Last Updated**: October 17, 2025  
**Live API**: https://841dg6itk5.execute-api.us-east-1.amazonaws.com/

## 🌟 Overview

Tyche Finance is a **cross-platform AI-powered personal finance application** that helps users:
- 💳 **Optimize credit card debt payoff** using proven strategies (avalanche, snowball)
- 📊 **Analyze spending habits** with AI-powered classification
- 🤖 **Get personalized financial advice** from multiple AI models (Claude, GPT-4, Grok, DeepSeek)
- 📱 **Access anywhere** via web app or mobile (iOS/Android)
- 📄 **Import data easily** from CSV, PDF, or camera-scanned receipts

## ✨ Current Features (October 2025)

### ✅ Authentication & Security
- **AWS Cognito** - Secure user authentication with email verification
- **Role-Based Access Control** - Automatic user group assignment (Admins, DevTeam, Users)
- **JWT Tokens** - Secure API authorization with cognito:groups claims
- **Amazon SES** - Professional email delivery (50K emails/day limit)

### ✅ Budget Setup Page (100% Complete)
- **Modern Layout** - Income and Expenses side-by-side, Visualization below
- **Income Breakdown** - 5 input fields: salary, bonuses, side income, investments, other
- **Expense Allocation** - 20 budget categories with real-time progress bars
- **D3.js Pie Chart** - Interactive full-width visualization with color-coded legend
- **Month Selector** - Create/edit budgets for any month
- **Auto-Distribute** - Automatically allocate budget using proven percentages
- **Real-Time Calculations** - Discretionary income and allocation percentages
- **Color Coding** - Green border for income, red border for expenses
- **API Integration** - Seamless save/load with authentication
- **Responsive Design** - Adapts beautifully to mobile, tablet, desktop
- **Route**: `/budget`

### ✅ Spending Dashboard (100% Complete)
- **Monthly Overview** - Income, spent, budgeted, net income cards
- **Spending Insights** - Daily average, projected spending, potential savings
- **Category Progress Bars** - Visual budgeted vs actual comparison (green/yellow/red)
- **Overspending Alerts** - Highlighted warnings for categories over budget
- **Transaction List** - Complete list with category filtering and sorting
- **Transaction Entry Form** - Add income or expenses with dynamic categories
  - **9 Income Categories**: salary, bonuses, freelance, investments, rental, refunds, gifts, side income, other
  - **19 Expense Categories**: groceries, dining, transportation, utilities, housing, healthcare, insurance, entertainment, shopping, personal care, education, childcare, pets, gifts, travel, subscriptions, debt payments, savings, miscellaneous
  - **Essential Flag**: Distinguish needs vs wants for better insights
  - **Notes Support**: Add context to any transaction
- **Month Selector** - View spending for any month with URL support
- **Empty States** - Helpful guidance for new users
- **Routes**: `/spending` and `/spending/:month`

### ✅ Main Dashboard (100% Complete)
- **Quick Action Cards** - Budget Setup, Credit Cards, Spending, AI Chat, Analytics
- **Budget Summary** - Current month overview if budget exists
- **Financial Metrics** - Total cards, debt, credit, utilization
- **Recent Cards Preview** - Top 3 cards with utilization bars
- **AI Insights Banner** - Call-to-action for personalized advice
- **Consistent Navigation** - Dashboard | Cards | Budget | Spending | AI Chat | Analytics
- **Route**: `/dashboard`

### ✅ Credit Cards Management (100% Complete)
- **Full CRUD Operations** - Create, Read, Update, Delete credit cards
- **Inline Editing** - Cards expand vertically for seamless editing experience
- **Auto-Scroll** - View automatically centers on card being edited
- **Recently-Edited Highlight** - Green border that fades over 3 seconds after save
- **View Toggle** - Display 6 cards by default, expand to view all
- **Metrics Dashboard** - Total debt, available credit, average utilization
- **Color-Coded Utilization** - Visual indicators (green/yellow/red) for credit usage
- **Immutable Field Protection** - Card name, network, last 4 digits cannot be changed
- **Real-Time Sync** - All data persists to DynamoDB with fast response times (20-150ms)
- **Responsive Design** - Works on mobile, tablet, and desktop

### ✅ Design System
- **Tailwind CSS Integration** - 40+ design tokens with HSL color system
- **Light/Dark Theme Support** - Ready for theme switching
- **Smooth Animations** - moveToTop, highlightPulse, highlightFade, slideDown
- **Finance-Specific Tokens** - Purple-blue gradient, card shadows, success/warning/danger colors
- **Consistent Styling** - All components use shared design variables

### ✅ Budget & Spending API (January 2025)
- **4 DynamoDB Tables** - tyche-budgets, tyche-transaction-details, tyche-spending-analytics, tyche-budget-goals
- **TypeScript Types** - 7 comprehensive types for budget management (373 lines)
- **15 REST API Endpoints** - Complete CRUD for budgets, categories, transactions, analytics
- **Multi-Tenant Design** - Budget isolation per tenant with GSIs for flexible querying
- **Schema Documentation** - Complete database design with access patterns (650+ lines)
- **API Documentation** - Full REST API reference with examples (850+ lines)
- **AI Integration Ready** - `availableForDebtPayoff` field enables personalized recommendations

### ✅ Data Visualization
- **D3.js Integration** - 132 packages for powerful visualization and statistics
- **Pie Charts** - Budget distribution by category with interactive legend
- **Progress Bars** - Visual spending comparison with color coding
- **Custom Animations** - Smooth transitions and hover effects
- **Responsive Charts** - Adapts to all screen sizes

### 🚧 In Progress
- **AI Chat Page** - Conversation interface with AgentKit tools (90% Complete!)
  - ✅ get_user_context tool working (fetches real credit card data)
  - 🔲 5 more tools to test (debt payoff simulation, spending analysis, etc.)
- **AI Budget Integration** - Update get_user_context to fetch budget data for personalized recommendations

### 📋 Planned Features
- **Analytics Page** - Progress charts, financial goals, spending trends with D3.js
- **Transaction Editing** - Edit/delete existing transactions
- **Recurring Transactions** - Auto-generate expected transactions (rent, subscriptions, bills)
- **CSV Import** - Bulk import bank transactions
- **Budget Goals** - Set and track savings goals with milestone notifications
- **Spending Predictions** - AI-powered forecasting of end-of-month spending
- **Budget Recommendations** - AI suggests budget adjustments based on spending patterns
- **Mobile App** - React Native + Expo version with full feature parity
- **Receipt Scanning** - Camera-based receipt capture with AI categorization

## 🏗️ Architecture

**Monorepo Structure** with shared business logic:
```
tyche/
├── packages/          # Shared libraries
│   ├── types/        # TypeScript definitions
│   ├── core/         # Business logic (payoff algorithms)
│   └── ai/           # Multi-model AI adapter
├── apps/             # Frontend applications
│   ├── web/          # React + Vite
│   └── mobile/       # React Native + Expo
├── services/         # Backend services
│   └── api/          # Lambda handlers
├── infrastructure/   # AWS CDK (IaC)
└── docs/            # Comprehensive documentation
```

**Tech Stack**:
- **Frontend**: React 18.3 + Vite 5.4 | React Native 0.74 + Expo 51
- **Backend**: AWS Lambda (Node.js 20) + **HTTP API V2** + DynamoDB (11 tables)
- **AI**: Anthropic Claude, OpenAI GPT-4 (6 AgentKit tools)
- **Infrastructure**: AWS CDK 2.160 (TypeScript IaC)
- **Build System**: npm workspaces + TypeScript 5.6 + esbuild
- **Auth**: AWS Cognito with JWT tokens
- **Database**: 
  - 7 core tables: users, cards, transactions, goals, snapshots, analytics, audit logs
  - 4 budget tables: budgets, transaction-details, spending-analytics, budget-goals
- **Cost**: $2-5/month at low scale (HTTP API V2 = 71% cheaper!)

## 📚 Documentation

Comprehensive documentation available in `/docs`:

| Document | Description | Status |
|----------|-------------|--------|
| **[BUDGET_API_REFERENCE.md](docs/BUDGET_API_REFERENCE.md)** | 📡 **Budget REST API** - 15 endpoints with examples (850+ lines) | ✅ **NEW!** |
| **[BUDGET_DEPLOYMENT_SUMMARY.md](docs/BUDGET_DEPLOYMENT_SUMMARY.md)** | 💰 **Budget infrastructure deployment** - 4 tables, types, schema (v0.4.0) | ✅ Complete |
| **[BUDGET_SPENDING_SCHEMA.md](docs/BUDGET_SPENDING_SCHEMA.md)** | 📊 **DynamoDB schema** for budget/spending (650+ lines with access patterns) | ✅ Complete |
| **[DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md)** | 📋 **Dev workflow** - Documentation standards, todo completion checklist | ✅ Complete |
| **[DEPLOYMENT_COMPLETE.md](docs/DEPLOYMENT_COMPLETE.md)** | 🎉 **Complete deployment summary** with live URLs, testing guide | ✅ Complete |
| **[CARDS_PAGE_IMPLEMENTATION.md](docs/CARDS_PAGE_IMPLEMENTATION.md)** | 💳 **Complete Cards page** - Full CRUD, inline editing, animations, design system | ✅ Complete |
| **[HTTP_API_MIGRATION.md](docs/HTTP_API_MIGRATION.md)** | REST API → HTTP API V2 migration (71% cost savings, 60% faster) | ✅ Complete |
| **[COGNITO_GROUPS_MIGRATION.md](docs/COGNITO_GROUPS_MIGRATION.md)** | 👥 Cognito Groups RBAC migration with auto-assignment | ✅ Complete |
| **[COGNITO_USER_IDENTIFIERS.md](docs/COGNITO_USER_IDENTIFIERS.md)** | 🆔 Cognito user identifiers guide (sub vs username vs email) | ✅ Complete |
| **[SES_EMAIL_SETUP.md](docs/SES_EMAIL_SETUP.md)** | 📧 Amazon SES email configuration for Cognito (50K emails/day) | ✅ Complete |
| **[AUTH_TESTING_GUIDE.md](docs/AUTH_TESTING_GUIDE.md)** | 🔐 Step-by-step authentication testing checklist | ✅ Complete |
| **[FRONTEND_BUILD_SUMMARY.md](docs/FRONTEND_BUILD_SUMMARY.md)** | Complete frontend build walkthrough with React hooks | ✅ Complete |
| **[FRONTEND_INTEGRATION.md](docs/FRONTEND_INTEGRATION.md)** | Frontend-backend integration guide with code examples | ✅ Complete |
| **[CHANGELOG.md](docs/CHANGELOG.md)** | 📝 All notable changes and version history | ✅ **UPDATED!** |
| **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** | Deep-dive into system design, components, and patterns | 📖 Complete |
| **[AGENTKIT_INTEGRATION.md](docs/AGENTKIT_INTEGRATION.md)** | 6 AI tools implementation (payoff, analysis, recommendations) | 📖 Complete |
| **[MULTI_TENANCY.md](docs/MULTI_TENANCY.md)** | Multi-tenant RBAC with admin/dev/user roles | 📖 Complete |
| **[ANALYTICS_SYSTEM.md](docs/ANALYTICS_SYSTEM.md)** | Progress tracking, goals, and snapshots system | 📖 Complete |
| **[LEARNING_GUIDE.md](docs/LEARNING_GUIDE.md)** | Educational guide for TypeScript, JWT, security patterns | 🎓 Complete |
| **[DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md)** | Development workflows and code patterns | 📖 Complete |
| **[DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md)** | AWS deployment guide with troubleshooting | 🚀 Complete |
| **[AWS_SETUP_GUIDE.md](docs/AWS_SETUP_GUIDE.md)** | Complete AWS account setup instructions | 📖 Complete |
| **[BUGS_AND_FIXES.md](docs/BUGS_AND_FIXES.md)** | Bug tracking and resolution history | 📖 **UPDATED!** |

## 🚀 Quick Start

### Prerequisites

- Node.js 20+ and npm 9+
- AWS CLI configured with credentials
- AI API key (Anthropic/OpenAI/xAI/DeepSeek)

### Installation

```bash
# Clone repository
git clone https://github.com/yourusername/tyche.git
cd tyche

# Install dependencies
npm install

# Build all packages
npm run build
```

### Development

```bash
# Start web app (dev server)
cd apps/web
npm run dev
# Open http://localhost:5173

# Start mobile app (Expo)
cd apps/mobile
npm start
# Scan QR code with Expo Go app
```

### Deployment

```bash
# Configure API keys (already done!)
export OPENAI_API_KEY=sk-proj-your-key-here
export ANTHROPIC_API_KEY=sk-ant-your-key-here

# Deploy to AWS (already deployed!)
cd infrastructure
npx cdk deploy --profile tyche-dev

# Deployment outputs:
# ✅ API URL: https://841dg6itk5.execute-api.us-east-1.amazonaws.com/
# ✅ User Pool ID: us-east-1_khi9CtS4e
# ✅ Client ID: 49993ps4165cjqu161528up854
```

### Test the Live API

```bash
# Health check (no auth required)
curl https://841dg6itk5.execute-api.us-east-1.amazonaws.com/public/health

# Expected response:
# {"success":true,"data":{"status":"healthy",...}}
```

# Bootstrap CDK (one-time setup)
cd infrastructure
npm run bootstrap

# Deploy to AWS
npm run deploy

# Output:
# ApiUrl: https://abc123.execute-api.us-east-1.amazonaws.com/prod/
# UserPoolId: us-east-1_ABC123
```

See [infrastructure/README.md](infrastructure/README.md) for detailed deployment instructions.

## 🧪 Testing

```bash
# Run all tests
npm test

# Test specific package
cd packages/core
npm test

# E2E tests (after deployment)
cd apps/web
npm run test:e2e
```

## 🎯 Features

### ✅ Completed

- [x] Monorepo with npm workspaces
- [x] TypeScript configuration with project references
- [x] Shared business logic (@tyche/core, @tyche/types)
- [x] Multi-model AI provider system (Claude, GPT-4, Grok, DeepSeek)
- [x] AWS CDK infrastructure definitions
- [x] Lambda API with routing and authentication
- [x] Multi-tenancy with role-based access control (admin/dev/user)
- [x] Authorization middleware and audit logging
- [x] Admin user management endpoints (all 6 handlers)
- [x] Developer system monitoring endpoints (all 4 handlers)
- [x] Debt payoff simulation (avalanche, snowball)
- [x] AI chat with tool calling (AgentKit patterns)
- [x] Credit card CRUD endpoints (all handlers wired with DynamoDB)
- [x] Database utilities for tenant-aware operations
- [x] Comprehensive documentation (7 major guides)
- [x] Full project builds successfully with zero TypeScript errors

### � Ready for Deployment

**All code complete!** Infrastructure and handlers ready to deploy. Only prerequisites needed:
- [ ] Configure AWS credentials (`aws configure`)
- [ ] Set AI API key (ANTHROPIC_API_KEY or similar)
- [ ] Bootstrap CDK (`cd infrastructure && cdk bootstrap`)
- [ ] Deploy stack (`cdk deploy`)

See [DEPLOYMENT_GUIDE.md](docs/DEPLOYMENT_GUIDE.md) for detailed instructions.

### 📋 Planned (Post-Deployment)

- [ ] File processing (CSV/PDF/OCR)
- [ ] Advanced optimization (hybrid strategies, balance transfers)
- [ ] React web frontend UI (dashboard, admin panel)
- [ ] React Native mobile app UI
- [ ] Transaction classification and spending analysis
- [ ] Real-time notifications
- [ ] Rate limiting per tenant/user

## 🏛️ Architecture Highlights

### Multi-Model AI System

Swappable AI providers with environment-based configuration:

```typescript
// Switch models via environment variables
export AI_PROVIDER=anthropic  # or openai, xai, deepseek
export AI_MODEL=claude-3-5-sonnet-latest

// Usage in code
const agent = createAgent({ userId });
const response = await agent.chatWithTools(messages, tools);
```

**Supported Models**:
- **Claude 3.5 Sonnet** (Anthropic): Best for financial reasoning
- **GPT-4 Turbo** (OpenAI): Fast and conversational
- **Grok Beta** (xAI): Real-time data access
- **DeepSeek Chat**: Cost-effective (10x cheaper)

### Serverless Backend

**AWS Lambda + API Gateway** for zero-ops infrastructure:
- Auto-scaling from 0 to 1000s of concurrent requests
- Pay-per-use (free tier covers development)
- Single Lambda with router (avoids cold start issues)

### Type-Safe Monorepo

**Shared packages** prevent code duplication:
- `@tyche/types`: Financial domain types used everywhere
- `@tyche/core`: Pure TypeScript business logic (no dependencies)
- `@tyche/ai`: Provider-agnostic AI adapter

Benefits: Change `CreditCardAccount` type once, updates web + mobile + API automatically.

## 🔐 Security & Multi-Tenancy

### Role-Based Access Control

Three user roles with escalating permissions:

| Role | Permissions |
|------|------------|
| **User** | Manage own cards, transactions, chat with AI |
| **Dev** | View system metrics, test AI models, access anonymized data |
| **Admin** | View all users, manage roles, access audit logs, impersonate users |

### Data Isolation

Row-level security with tenant-based partitioning:
```typescript
// All queries filtered by tenantId + userId
PK: 'TENANT#personal#USER#user-123'
SK: 'CARD#card-456'
```

Prevents cross-tenant data access at database level.

### Audit Logging

All admin actions logged with TTL (90-day retention):
```typescript
await auditLog({
  tenantId: user.tenantId,
  userId: adminUserId,
  action: 'view_user_cards',
  targetUserId: 'user-123',
  success: true
});
```

## 📊 Development Stats

**Lines of Code**: ~8,000+ (TypeScript)  
**Packages**: 7 (3 shared, 2 apps, 2 services)  
**Dependencies**: 1,298 packages  
**Build Time**: ~5 seconds (incremental)  
**Bundle Size**: 143.94 KB (web app, gzipped: 46.39 KB)

## 🤝 Contributing

This is a learning project, but contributions are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read [ARCHITECTURE.md](docs/ARCHITECTURE.md) to understand system design before contributing.

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- **Anthropic** for Claude AI
- **AWS CDK** team for excellent IaC tooling
- **React** and **React Native** communities
- **OpenAI AgentKit** for agent design patterns

---

**Built with ❤️ for better financial health**