# Tyche Finance - Architecture Deep Dive

> A comprehensive deep-dive into the architecture, design decisions, components, and development patterns of the Tyche Finance cross-platform AI-powered personal finance application.

**Last Updated**: October 16, 2025  
**Version**: 0.1.0 (Alpha - Backend Deployed, Authentication Complete)  
**Status**: ✅ **Backend live in AWS with HTTP API V2, SES Email, Auto-RBAC**  
**Live API**: https://841dg6itk5.execute-api.us-east-1.amazonaws.com/  
**Author**: Development Team

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Architecture Overview](#system-architecture-overview)
3. [Monorepo Structure](#monorepo-structure)
4. [Frontend Architecture](#frontend-architecture)
5. [Backend Architecture](#backend-architecture)
6. [AI Integration Layer](#ai-integration-layer)
7. [Data Models & Business Logic](#data-models--business-logic)
8. [Infrastructure as Code](#infrastructure-as-code)
9. [Security & Authentication](#security--authentication)
10. [Development Patterns](#development-patterns)
11. [Design Decisions & Trade-offs](#design-decisions--trade-offs)
12. [Performance Considerations](#performance-considerations)
13. [Scalability & Future Roadmap](#scalability--future-roadmap)

---

## Executive Summary

### What is Tyche Finance?

Tyche Finance is an **AI-powered personal finance application** designed to help users:
- **Manage budgets** with intelligent insights
- **Optimize credit card debt payoff** using proven strategies (avalanche, snowball)
- **Analyze spending habits** with AI-powered classification
- **Predict financial impact** of purchases on debt payoff schedules
- **Upload financial documents** (CSV, PDF, images) for automatic data extraction

### Technology Stack at a Glance

| Layer | Technologies |
|-------|-------------|
| **Frontend Web** | React 18.3, TypeScript 5.6, Vite 5.4 |
| **Frontend Mobile** | React Native 0.74, Expo 51, TypeScript |
| **Backend** | AWS Lambda (Node.js 20), **HTTP API V2**, TypeScript |
| **Database** | DynamoDB (NoSQL, serverless) |
| **Storage** | S3 (file uploads, document processing) |
| **Authentication** | AWS Cognito (JWT-based) |
| **AI Providers** | Anthropic Claude, OpenAI GPT-4 (6 AgentKit tools) |
| **Infrastructure** | AWS CDK 2.160 (TypeScript IaC) |
| **Build System** | npm workspaces, esbuild bundling |
| **Deployment** | ✅ **Live in us-east-1** |

### Core Principles

1. **Code Reusability**: Shared business logic across web, mobile, and backend
2. **Type Safety**: End-to-end TypeScript for compile-time error detection
3. **Serverless First**: Zero infrastructure management, pay-per-use pricing
4. **AI Flexibility**: Swappable AI models for experimentation and cost optimization
5. **Developer Experience**: Fast builds, hot reloading, comprehensive tooling

---

## System Architecture Overview

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
├──────────────────────────┬──────────────────────────────────────┤
│     Web App (React)      │    Mobile App (React Native)         │
│   - Vite bundler         │    - Expo framework                  │
│   - React 18.3           │    - React Native 0.74               │
│   - Dashboard UI         │    - Camera scanning                 │
│   - Charts & viz         │    - Offline-first                   │
└──────────┬───────────────┴─────────────┬────────────────────────┘
           │                             │
           │ HTTPS/REST                  │ HTTPS/REST
           │                             │
┌──────────▼─────────────────────────────▼────────────────────────┐
│                HTTP API V2 (AWS) - ⚡ 71% cheaper, 60% faster   │
│  - JWT authorization (Cognito)                                   │
│  - Request throttling & rate limiting                            │
│  - CORS configuration (automatic)                                │
│  - Catch-all routes: /public/{proxy+}, /v1/{proxy+}            │
└──────────┬──────────────────────────────────────────────────────┘
           │
           │ Invokes
           │
┌──────────▼──────────────────────────────────────────────────────┐
│          LAMBDA FUNCTION (Node.js 20) - 87.8kb bundled          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  API Router (services/api) - esbuild bundled single file   │ │
│  │  - Route matching & dispatch                               │ │
│  │  - Auth extraction from JWT                                │ │
│  │  - Error handling                                          │ │
│  └───┬─────────────────────────────────────────────────┬──────┘ │
│      │                                                 │          │
│  ┌───▼──────────────┐  ┌────────────────┐  ┌─────────▼───────┐ │
│  │  Health Check    │  │ Payoff Simulator│  │   AI Chat      │ │
│  │  /public/health  │  │ /v1/payoff/*   │  │   /v1/chat     │ │
│  └──────────────────┘  └────────┬───────┘  └─────┬───────────┘ │
│                                  │                 │             │
│  ┌──────────────────────────────▼─────────────────▼───────────┐ │
│  │       Bundled Dependencies (@tyche/* included)              │ │
│  │  - @tyche/types: TypeScript definitions                     │ │
│  │  - @tyche/core: Business logic (payoff algorithms)          │ │
│  │  - @tyche/ai: Multi-model AI adapter with AgentKit         │ │
│  └──────────────────────────────┬──────────────────────────────┘ │
└─────────────────────────────────┼─────────────────────────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
┌────────▼────────┐   ┌──────────▼────────┐   ┌──────────▼─────────┐
│  DynamoDB (7)   │   │    S3 Bucket      │   │  External AI APIs  │
│  - Users        │   │  - File uploads   │   │  - Anthropic ✅    │
│  - Transactions │   │  - Documents      │   │  - OpenAI ✅       │
│  - Credit Cards │   │  - Images/OCR     │   │                    │
│  - Audit Logs   │   │                   │   │  6 AgentKit Tools: │
│  - Snapshots    │   │  tyche-uploads-   │   │  • simulate_payoff │
│  - Goals        │   │  586794453404     │   │  • analyze_spending│
│  - Analytics    │   │                   │   │  • recommend_xfer  │
└─────────────────┘   └───────────────────┘   │  • optimize_pay    │
                                               │  • calc_credit     │
                                               │  • get_context     │
                                               └────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│             AWS COGNITO (Auth) - ✅ Deployed                     │
│  - User Pool: us-east-1_khi9CtS4e                               │
│  - Client ID: 49993ps4165cjqu161528up854                        │
│  - JWT token generation & validation                             │
│  - Custom attributes: tenantId, role, permissions               │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow Example: Debt Payoff Simulation

```
1. User enters credit card details in web/mobile app
   └─> POST /v1/payoff/simulate
       Body: { cards: [...], monthlyBudget: 500, strategy: "avalanche" }

2. API Gateway validates JWT token with Cognito
   └─> Extracts userId from token claims
   └─> Forwards to Lambda with userId in context

3. Lambda API Router matches route
   └─> Calls simulatePayoffHandler()
   └─> Validates input (card structure, positive budget)

4. Handler calls @tyche/core business logic
   └─> simulatePayoff(input, { strategy: "avalanche" })
   └─> Pure TypeScript calculation (no I/O)
   └─> Returns: { monthsToDebtFree: 18, totalInterest: 1247.32, steps: [...] }

5. Handler formats response
   └─> Adds recommendation text
   └─> Logs analytics (userId, strategy used)
   └─> Returns 200 OK with JSON

6. Client receives result
   └─> Renders payoff chart
   └─> Shows month-by-month breakdown
   └─> Displays total interest savings
```

### Key Architectural Decisions

#### 1. Monorepo with npm Workspaces

**Why?**
- Share TypeScript types across frontend/backend/mobile without publishing to npm
- Atomic commits that update multiple packages together
- Single `npm install` at root installs all dependencies
- Consistent build tooling across projects

**Alternatives Considered:**
- **Multi-repo**: Rejected due to complexity of versioning and cross-repo changes
- **pnpm workspaces**: Rejected for better npm ecosystem compatibility
- **Yarn workspaces**: Rejected; npm has caught up in features and is more universal

#### 2. Serverless Backend (AWS Lambda + API Gateway)

**Why?**
- **Zero infrastructure management**: No EC2 instances to patch or scale
- **Cost-effective**: Pay only for actual requests (free tier covers development)
- **Auto-scaling**: Handles 1 request or 10,000 requests/sec automatically
- **Fast deployment**: `cdk deploy` updates in ~30 seconds

**Alternatives Considered:**
- **EC2 + Express**: Rejected due to operational overhead, always-on costs
- **Fargate + ECS**: Rejected as overkill for API workload, slower cold starts
- **AWS Amplify**: Considered but rejected for less control over infrastructure

**Trade-offs:**
- ❌ Cold starts (mitigated with provisioned concurrency if needed)
- ❌ 15-minute max execution time (not an issue for our API endpoints)
- ✅ No DevOps burden
- ✅ Excellent AWS service integrations

#### 3. DynamoDB Over RDS

**Why?**
- **Serverless**: No database server to manage or scale
- **Performance**: Single-digit millisecond latency at any scale
- **Cost model**: Pay per request, not per hour
- **Schema flexibility**: Easy to add fields without migrations

**Data Model:**
```typescript
// Users Table
{
  userId: string;          // Partition Key
  email: string;
  name: string;
  createdAt: string;
  preferences: object;
}

// Transactions Table
{
  userId: string;          // Partition Key
  transactionId: string;   // Sort Key
  date: string;            // GSI: DateIndex
  amount: number;
  category: string;
  description: string;
}

// Credit Cards Table
{
  userId: string;          // Partition Key
  cardId: string;          // Sort Key
  name: string;
  balance: number;
  limit: number;
  apr: number;
  minPayment: number;
  dueDayOfMonth: number;
}
```

**Alternatives Considered:**
- **PostgreSQL RDS**: Rejected due to operational complexity, cost (always-on instance)
- **Aurora Serverless v2**: Considered but more expensive, overkill for our access patterns
- **MongoDB Atlas**: Rejected to stay within AWS ecosystem

**Trade-offs:**
- ❌ No complex SQL joins (we design around single-table patterns)
- ❌ Learning curve for NoSQL modeling
- ✅ Unlimited scalability
- ✅ Built-in encryption and backups

#### 4. Multi-Model AI Architecture

**Why?**
- **Cost optimization**: DeepSeek is 10x cheaper than GPT-4 for similar quality
- **Experimentation**: A/B test different models for specific use cases
- **Redundancy**: Fallback to another provider if one has an outage
- **Future-proofing**: New models (GPT-5, Claude 4) can be added without refactoring

**Provider Abstraction Pattern:**
```typescript
// Universal interface
interface AIProvider {
  chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>;
  chatWithTools(messages: Message[], tools: Tool[], options?: ChatOptions): Promise<ChatResponse>;
}

// Factory pattern
function createAIProvider(config: AIConfig): AIProvider {
  switch (config.provider) {
    case 'anthropic': return new AnthropicProvider(config.apiKey, config.model);
    case 'openai': return new OpenAIProvider(config.apiKey, config.model);
    case 'xai': return new XAIProvider(config.apiKey, config.model);
    case 'deepseek': return new DeepSeekProvider(config.apiKey, config.model);
  }
}

// Environment-based selection
const provider = createAIProvider(getModelConfig());
// Controlled by AI_PROVIDER and AI_MODEL env vars
```

**Alternatives Considered:**
- **Single provider (Claude only)**: Rejected to avoid vendor lock-in
- **LangChain**: Considered but adds unnecessary complexity for our use case
- **OpenAI SDK only**: Many providers have OpenAI-compatible APIs, but native clients are better

---

## Monorepo Structure

### Directory Layout

```
tyche/
├── package.json              # Root workspace configuration
├── tsconfig.base.json        # Shared TypeScript config
├── README.md                 # Project overview
├── .gitignore
│
├── packages/                 # Shared business logic
│   ├── types/                # @tyche/types
│   │   ├── src/
│   │   │   └── index.ts      # Currency, Income, Expense, CreditCardAccount, etc.
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── core/                 # @tyche/core
│   │   ├── src/
│   │   │   └── index.ts      # simulatePayoff(), avalanche, snowball algorithms
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── ai/                   # @tyche/ai
│       ├── src/
│       │   ├── index.ts      # Public API: createAgent()
│       │   ├── config.ts     # Model configuration
│       │   ├── provider.ts   # AIProvider interface
│       │   ├── factory.ts    # createAIProvider() factory
│       │   └── providers/
│       │       ├── anthropic.ts
│       │       ├── openai.ts
│       │       ├── xai.ts
│       │       └── deepseek.ts
│       ├── package.json
│       └── tsconfig.json
│
├── apps/                     # Frontend applications
│   ├── web/                  # @tyche/web
│   │   ├── src/
│   │   │   ├── main.tsx      # Vite entry point
│   │   │   └── App.tsx       # Root React component
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vite.config.ts
│   │
│   └── mobile/               # @tyche/mobile
│       ├── App.tsx           # Expo entry point
│       ├── index.js
│       ├── package.json
│       └── tsconfig.json
│
├── services/                 # Backend services
│   └── api/                  # @tyche/api
│       ├── src/
│       │   ├── index.ts      # Lambda main handler
│       │   ├── utils.ts      # Router, response helpers
│       │   └── handlers/
│       │       ├── health.ts
│       │       ├── payoff.ts
│       │       ├── chat.ts
│       │       └── cards.ts
│       ├── package.json
│       └── tsconfig.json
│
├── infrastructure/           # AWS CDK (IaC)
│   ├── lib/
│   │   ├── app.ts            # CDK app entry
│   │   └── tyche-stack.ts    # Resource definitions
│   ├── cdk.json
│   ├── package.json
│   └── tsconfig.json
│
└── docs/                     # Documentation
    ├── BUGS_AND_FIXES.md
    ├── ARCHITECTURE.md
    └── AGENTKIT_INTEGRATION.md
```

### Package Dependency Graph

```
┌─────────────┐
│ @tyche/types│ ← Pure TypeScript types (no dependencies)
└──────┬──────┘
       │
       │ depends on
       │
┌──────▼──────┐
│ @tyche/core │ ← Business logic (depends on types)
└──────┬──────┘
       │
       │ depends on
       │
┌──────▼──────┐
│  @tyche/ai  │ ← AI layer (depends on core and types)
└──────┬──────┘
       │
       │ consumed by
       │
   ┌───┴────┬────────┬────────┐
   │        │        │        │
┌──▼──┐ ┌──▼──┐ ┌───▼───┐ ┌──▼──┐
│ web │ │mobile│ │ api   │ │infra│
└─────┘ └─────┘ └───────┘ └─────┘
```

**Dependency Rules:**
1. **types** has zero dependencies (pure definitions)
2. **core** only depends on **types**
3. **ai** depends on **core** and **types**
4. Applications (web, mobile, api) can depend on any package
5. **No circular dependencies** enforced by TypeScript project references

### Build Order

TypeScript's project references ensure correct build order:

```bash
npm run build

# Executes in this order:
1. @tyche/types      (0 dependencies)
2. @tyche/core       (depends on types)
3. @tyche/ai         (depends on core, types)
4. @tyche/web        (depends on all packages)
5. @tyche/mobile     (depends on all packages)
6. @tyche/api        (depends on all packages)
7. @tyche/infrastructure (depends on all packages for Lambda code)
```

**Incremental Builds:**
- Changing `types` rebuilds everything (all packages depend on it)
- Changing `core` rebuilds ai, web, mobile, api
- Changing `ai` only rebuilds web, mobile, api
- Changing `web` only rebuilds web (leaf node)

---

## Frontend Architecture

### Web Application (React + Vite)

#### Technology Choices

**React 18.3.1**
- Latest stable release with concurrent features
- Automatic batching for better performance
- Suspense for data fetching (future use)

**Vite 5.4.0**
- Lightning-fast hot module replacement (HMR)
- Native ESM support (no bundling in dev)
- Optimized production builds with Rollup
- Better than Create React App (CRA) in every metric

**TypeScript 5.6.3**
- Full type safety from API to UI
- Autocomplete for shared packages
- Catch errors at compile time

#### Component Architecture (Planned)

```typescript
src/
├── main.tsx                  # App entry point
├── App.tsx                   # Root component with routing
│
├── components/               # Reusable UI components
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   └── Layout/
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       └── Footer.tsx
│
├── features/                 # Feature-based modules
│   ├── auth/
│   │   ├── LoginForm.tsx
│   │   ├── SignupForm.tsx
│   │   └── useAuth.ts        # Custom hook
│   │
│   ├── dashboard/
│   │   ├── Dashboard.tsx
│   │   ├── SummaryCard.tsx
│   │   └── useDashboardData.ts
│   │
│   ├── cards/
│   │   ├── CreditCardList.tsx
│   │   ├── CreditCardForm.tsx
│   │   ├── CreditCardDetail.tsx
│   │   └── useCards.ts
│   │
│   ├── payoff/
│   │   ├── PayoffSimulator.tsx
│   │   ├── PayoffChart.tsx    # Recharts visualization
│   │   ├── StrategyPicker.tsx
│   │   └── usePayoffSimulation.ts
│   │
│   └── chat/
│       ├── ChatInterface.tsx
│       ├── MessageList.tsx
│       ├── MessageInput.tsx
│       └── useChat.ts
│
├── lib/                      # Utilities
│   ├── api.ts                # API client (fetch wrapper)
│   ├── auth.ts               # Cognito integration
│   └── formatters.ts         # Currency, date formatting
│
├── hooks/                    # Shared custom hooks
│   ├── useApi.ts
│   ├── useLocalStorage.ts
│   └── useDebounce.ts
│
└── types/                    # Web-specific types
    └── index.ts              # (Re-exports from @tyche/types)
```

#### Implemented Pages (✅ Production Ready)

**1. Authentication Pages**

**LoginPage.tsx**
```typescript
// Features:
// - Email + password login
// - Cognito integration via AWS Amplify v6
// - Automatic JWT token management
// - Error handling with user-friendly messages
// - Remember me functionality
// - Link to signup page

interface LoginForm {
  email: string;
  password: string;
}

// Uses useAuth hook for Cognito signIn()
```

**SignUpPage.tsx**
```typescript
// Features:
// - Email + password registration
// - Email verification flow (SES)
// - Automatic group assignment ("Users" group via Lambda trigger)
// - Password strength validation
// - Terms of service acceptance
// - Redirect to email verification

interface SignUpForm {
  email: string;
  password: string;
  confirmPassword: string;
}

// Uses useAuth hook for Cognito signUp()
// Post-Confirmation Lambda auto-assigns cognito:groups claim
```

**2. Dashboard Page** ✅ **COMPLETE**

**DashboardPage.tsx**
```typescript
// Features:
// - Financial overview metrics (total debt, credit available, utilization)
// - Top 3 credit cards with utilization bars
// - Quick navigation to other features
// - Responsive grid layout
// - Real-time data from DynamoDB

// Data Flow:
// 1. useCreditCards() hook fetches cards via GET /v1/cards
// 2. Calculates aggregated metrics (total debt, available credit)
// 3. Displays top 3 cards by balance
// 4. Shows utilization percentage with color-coded bars
```

**3. Cards Page** ✅ **COMPLETE - FULL CRUD**

**CardsPage.tsx** (542 lines) - **Most Complex Component**
```typescript
// Features:
// ✅ CREATE: Add new credit cards with full validation
// ✅ READ: Display all cards with real-time data
// ⏳ UPDATE: Edit existing cards (UI ready, pending testing)
// ⏳ DELETE: Remove cards (UI ready, pending testing)

interface CreditCard {
  cardId: string;              // Unique identifier
  userId: string;              // Multi-tenant isolation
  name: string;                // User-friendly name
  network: 'Visa' | 'Mastercard' | 'American Express' | 'Discover' | 'Other';
  lastFourDigits: string;      // Last 4 digits (PCI compliance)
  balance: number;             // Current balance
  limit: number;               // Credit limit
  apr: number;                 // Interest rate (decimal: 0.1999 = 19.99%)
  minPayment: number;          // Minimum monthly payment
  dueDayOfMonth: number;       // Day of month payment is due (1-28)
  createdAt: string;           // ISO timestamp
  updatedAt: string;           // ISO timestamp
}

// Form Strategy (UX-focused):
interface CardFormData {
  cardName: string;            // String inputs for better UX
  network: string;
  lastFourDigits: string;
  balance: string;             // Prevents leading zeros
  creditLimit: string;         // User enters as string
  interestRate: string;        // User enters 19.99 (percentage)
  minimumPayment: string;
  dueDate: string;             // Day only (1-28)
}

// Key Functions:
function handleSubmit() {
  // 1. Validate all fields
  // 2. Convert strings to numbers
  // 3. Convert interest rate percentage to decimal (19.99 → 0.1999)
  // 4. Map form fields to API fields (cardName → name, creditLimit → limit)
  // 5. Call addCard() via useCreditCards hook
}

function handleEdit(card: CreditCard) {
  // 1. Convert API data back to form format
  // 2. Convert decimal to percentage (0.1999 → 19.99)
  // 3. Map API fields to form fields (name → cardName, limit → creditLimit)
  // 4. Populate form with existing values
  // 5. Switch to edit mode
}

// UI Features:
// - Metrics grid (total cards, total debt, total credit, avg utilization)
// - Color-coded utilization bars (green < 30%, yellow 30-70%, red > 70%)
// - Add/Edit form with validation
// - Card grid with network icons
// - Edit (✏️) and Delete (🗑️) buttons on each card
// - Error messages with clear feedback
// - Loading states
// - Empty state when no cards

// Data Flow:
// CREATE: Form → addCard() → POST /v1/cards → DynamoDB → State update → UI refresh
// READ: Mount → fetchCards() → GET /v1/cards → DynamoDB → State update → Display
// UPDATE: Edit button → Populate form → Update → PUT /v1/cards/:cardId → Refresh
// DELETE: Delete button → Confirm → DELETE /v1/cards/:cardId → Remove from state
```

**Cards.css** (342 lines) - Comprehensive styling:
```css
/* Features:
 * - Responsive grid layout (auto-fill, min 300px cards)
 * - Color-coded utilization bars with gradients
 * - Form validation states (error borders)
 * - Network-specific styling
 * - Smooth transitions and hover effects
 * - Mobile-responsive (stacks on small screens)
 * - Accessible (focus states, ARIA labels)
 */
```

**4. Placeholder Pages** ⏳ **COMING SOON**

**ChatPage.tsx** - AI conversation interface
```typescript
// Planned Features:
// - Message history display
// - Real-time typing indicators
// - AI tool usage display (when AI uses AgentKit tools)
// - File upload for document analysis
// - Code syntax highlighting for responses
// - Markdown rendering

// Will use useAIChat hook (already exists)
```

**AnalyticsPage.tsx** - Financial insights and charts
```typescript
// Planned Features:
// - Progress charts (debt payoff timeline)
// - Financial goals tracking
// - Spending patterns visualization
// - Snapshots timeline
// - Export data functionality

// Will use useAnalytics hook (already exists)
```

#### Page Routing Implementation

**App.tsx**
```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { DashboardPage } from './pages/DashboardPage';
import { CardsPage } from './pages/CardsPage';
// import { ChatPage } from './pages/ChatPage';  // Coming soon
// import { AnalyticsPage } from './pages/AnalyticsPage';  // Coming soon

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />
        
        {/* Protected routes */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/cards" element={<ProtectedRoute><CardsPage /></ProtectedRoute>} />
        {/* <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} /> */}
        {/* <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} /> */}
        
        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}

// Protected route wrapper (checks auth before rendering)
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  
  return <>{children}</>;
}
```

#### State Management Strategy

**No Redux** - Modern React patterns are sufficient:

1. **Server State**: React Query (TanStack Query)
   ```typescript
   import { useQuery, useMutation } from '@tanstack/react-query';
   
   function useCards() {
     const { data, isLoading } = useQuery({
       queryKey: ['cards'],
       queryFn: () => api.get('/v1/cards')
     });
     
     const addCard = useMutation({
       mutationFn: (card) => api.post('/v1/cards', card),
       onSuccess: () => queryClient.invalidateQueries(['cards'])
     });
     
     return { cards: data, isLoading, addCard };
   }
   ```

2. **UI State**: useState + useContext
   ```typescript
   const ThemeContext = createContext<Theme>('light');
   
   function App() {
     const [theme, setTheme] = useState<Theme>('light');
     return (
       <ThemeContext.Provider value={theme}>
         <Router />
       </ThemeContext.Provider>
     );
   }
   ```

3. **Form State**: React Hook Form
   ```typescript
   import { useForm } from 'react-hook-form';
   
   function CreditCardForm() {
     const { register, handleSubmit, errors } = useForm<CreditCardAccount>();
     
     const onSubmit = (data) => addCard.mutate(data);
     
     return (
       <form onSubmit={handleSubmit(onSubmit)}>
         <input {...register('name', { required: true })} />
         {errors.name && <span>Name is required</span>}
       </form>
     );
   }
   ```

#### API Integration Pattern

```typescript
// lib/api.ts
import { Amplify, Auth } from 'aws-amplify';

class ApiClient {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = import.meta.env.VITE_API_URL;
  }
  
  private async getAuthHeaders() {
    const session = await Auth.currentSession();
    const token = session.getIdToken().getJwtToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  }
  
  async get<T>(path: string): Promise<T> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}${path}`, { headers });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.data; // Unwrap { success: true, data: T }
  }
  
  async post<T>(path: string, body: unknown): Promise<T> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }
    
    const data = await response.json();
    return data.data;
  }
}

export const api = new ApiClient();
```

### Mobile Application (React Native + Expo)

#### Why Expo?

**Advantages:**
- ✅ Managed workflow (no Xcode/Android Studio required initially)
- ✅ Over-the-air (OTA) updates without app store review
- ✅ Excellent development experience (Expo Go app for testing)
- ✅ Built-in camera, file system, notifications APIs
- ✅ Can eject to bare React Native if needed

**Trade-offs:**
- ❌ Slightly larger app bundle size
- ❌ Some native modules require custom dev client
- ✅ But: 99% of features work with Expo Go

#### Mobile-Specific Features

```typescript
// Camera scanning for receipts
import { Camera } from 'expo-camera';
import { manipulateAsync } from 'expo-image-manipulator';

async function scanReceipt() {
  const { status } = await Camera.requestCameraPermissionsAsync();
  if (status !== 'granted') return;
  
  // Capture photo
  const photo = await cameraRef.current.takePictureAsync();
  
  // Optimize for OCR (grayscale, contrast)
  const processed = await manipulateAsync(
    photo.uri,
    [{ resize: { width: 1200 } }],
    { compress: 0.8, format: 'jpeg' }
  );
  
  // Upload to S3 for processing
  await uploadReceipt(processed.uri);
}
```

```typescript
// Offline-first data sync
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

async function syncTransactions() {
  const isOnline = await NetInfo.fetch().then(state => state.isConnected);
  
  if (isOnline) {
    // Fetch from API
    const transactions = await api.get('/v1/transactions');
    await AsyncStorage.setItem('transactions', JSON.stringify(transactions));
  } else {
    // Use cached data
    const cached = await AsyncStorage.getItem('transactions');
    return cached ? JSON.parse(cached) : [];
  }
}
```

#### Shared Logic Benefits

Both web and mobile apps use:
- `@tyche/core` for payoff calculations (runs locally, no API needed)
- `@tyche/types` for TypeScript definitions
- `@tyche/ai` for client-side AI features (if API key provided)

```typescript
// Same code works in both React and React Native!
import { simulatePayoff } from '@tyche/core';
import type { CreditCardAccount } from '@tyche/types';

function PayoffPreview({ cards }: { cards: CreditCardAccount[] }) {
  const result = simulatePayoff({
    cards,
    monthlyBudget: 500,
    strategy: 'avalanche'
  });
  
  return (
    <View>
      <Text>Debt-free in: {result.monthsToDebtFree} months</Text>
      <Text>Total interest: ${result.totalInterest.toFixed(2)}</Text>
    </View>
  );
}
```

---

## Backend Architecture

### Lambda Function Design

#### Single Lambda vs Multiple Lambdas

**Our Choice: Single Lambda with Router**

```typescript
// services/api/src/index.ts
export const handler = createRouter([
  { method: 'GET', path: '/public/health', handler: healthCheck, requireAuth: false },
  { method: 'POST', path: '/v1/payoff/simulate', handler: simulatePayoffHandler },
  { method: 'POST', path: '/v1/chat', handler: chatHandler },
  { method: 'GET', path: '/v1/cards', handler: getCards },
  { method: 'POST', path: '/v1/cards', handler: createCard },
  { method: 'PUT', path: '/v1/cards/{cardId}', handler: updateCard },
  { method: 'DELETE', path: '/v1/cards/{cardId}', handler: deleteCard },
]);
```

**Why Not Multiple Lambdas?**
- ❌ More cold starts (each Lambda has separate warm pool)
- ❌ More complex API Gateway configuration
- ❌ Harder to share code (need Lambda layers)
- ❌ More moving parts to monitor

**Why Single Lambda?**
- ✅ One warm instance serves all routes (faster after first request)
- ✅ Simpler deployment (one function to update)
- ✅ Easier to share utility code (router, auth, error handling)
- ✅ Can still scale to handle high traffic (Lambda scales horizontally)

**When to Split:**
- If endpoints have vastly different resource requirements (CPU/memory)
- If endpoints have different security/compliance requirements
- If one endpoint is called 1000x more than others (provision concurrency for it)

#### Router Implementation

```typescript
// services/api/src/utils.ts
interface Route {
  method: string;
  path: string;
  handler: RouteHandler;
  requireAuth?: boolean;
}

export function createRouter(routes: Route[]) {
  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    const { httpMethod, path } = event;
    
    // Find matching route
    const route = routes.find(r => 
      r.method === httpMethod && 
      matchPath(r.path, path)
    );
    
    if (!route) {
      return notFound('Route not found');
    }
    
    // Check authentication
    if (route.requireAuth !== false) {
      const userId = getUserId(event);
      if (!userId) {
        return unauthorized('Authentication required');
      }
    }
    
    try {
      // Call handler
      const userId = getUserId(event);
      return await route.handler(event, userId);
    } catch (error) {
      console.error('Handler error:', error);
      return serverError('Internal server error', error);
    }
  };
}
```

**Features:**
- Path pattern matching (supports `/v1/cards/{cardId}`)
- Automatic auth checking (opt-out with `requireAuth: false`)
- Centralized error handling
- Response formatting

#### Handler Pattern

```typescript
// services/api/src/handlers/payoff.ts
export async function simulatePayoffHandler(
  event: APIGatewayProxyEvent,
  userId?: string
): Promise<APIGatewayProxyResult> {
  // 1. Validate auth
  if (!userId) {
    return badRequest('User ID required');
  }
  
  // 2. Parse and validate input
  const body = parseBody(event);
  if (!body.cards || !Array.isArray(body.cards)) {
    return badRequest('Invalid cards array');
  }
  
  const { cards, monthlyBudget, strategy } = body;
  
  // 3. Call business logic
  const result = simulatePayoff({
    cards,
    monthlyBudget,
    strategy: strategy || 'avalanche'
  });
  
  // 4. Log for analytics
  console.log(`[${userId}] Simulated ${strategy} for ${cards.length} cards: ${result.monthsToDebtFree} months`);
  
  // 5. Format response
  return ok({
    strategy,
    result,
    recommendation: `Using the ${strategy} method, you'll be debt-free in ${formatMonths(result.monthsToDebtFree)} and pay $${result.totalInterest.toFixed(2)} in total interest.`
  });
}
```

**Benefits:**
- Early validation with clear error messages
- Logging for debugging and analytics
- Pure business logic separated from I/O
- Testable (mock `event` and `userId`)

### DynamoDB Access Patterns

#### Single-Table Design Principles

**Users Table:**
```typescript
{
  PK: 'USER#<userId>',
  SK: 'METADATA',
  email: string,
  name: string,
  createdAt: string
}
```

**Transactions Table:**
```typescript
{
  PK: 'USER#<userId>',
  SK: 'TXN#<transactionId>',
  date: string,          // GSI: DateIndex
  amount: number,
  category: string,
  description: string
}
```

**Credit Cards Table:**
```typescript
{
  PK: 'USER#<userId>',
  SK: 'CARD#<cardId>',
  name: string,
  balance: number,
  limit: number,
  apr: number
}
```

#### Query Patterns

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Get all cards for a user
async function getCards(userId: string) {
  const result = await client.send(new QueryCommand({
    TableName: 'tyche-credit-cards',
    KeyConditionExpression: 'userId = :userId',
    ExpressionAttributeValues: {
      ':userId': userId
    }
  }));
  
  return result.Items as CreditCardAccount[];
}

// Get transactions by date range
async function getTransactionsByDateRange(userId: string, startDate: string, endDate: string) {
  const result = await client.send(new QueryCommand({
    TableName: 'tyche-transactions',
    IndexName: 'DateIndex',
    KeyConditionExpression: 'userId = :userId AND #date BETWEEN :start AND :end',
    ExpressionAttributeNames: {
      '#date': 'date'
    },
    ExpressionAttributeValues: {
      ':userId': userId,
      ':start': startDate,
      ':end': endDate
    }
  }));
  
  return result.Items as Transaction[];
}
```

---

## AI Integration Layer

### Multi-Model Architecture

#### Provider Interface

```typescript
// packages/ai/src/provider.ts
export interface AIProvider {
  chat(
    messages: Message[],
    options?: ChatOptions
  ): Promise<ChatResponse>;
  
  chatWithTools(
    messages: Message[],
    tools: Tool[],
    options?: ChatOptions
  ): Promise<ChatResponse>;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: JSONSchema;
}

export interface ChatResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'tool_calls';
  toolCalls?: ToolCall[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}
```

#### Provider Implementations

**Anthropic Claude:**
```typescript
// packages/ai/src/providers/anthropic.ts
export class AnthropicProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private model: string = 'claude-3-5-sonnet-latest'
  ) {}
  
  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    const systemMessage = messages.find(m => m.role === 'system')?.content;
    const userMessages = messages.filter(m => m.role !== 'system');
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'anthropic-version': '2023-06-01',
        'x-api-key': this.apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: options?.maxTokens || 4096,
        system: systemMessage,
        messages: userMessages
      })
    });
    
    const data = await response.json();
    
    return {
      content: data.content[0].text,
      finishReason: this.mapFinishReason(data.stop_reason),
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens
      }
    };
  }
  
  async chatWithTools(messages: Message[], tools: Tool[], options?: ChatOptions): Promise<ChatResponse> {
    // Claude native tool calling
    const response = await this.makeRequest({
      model: this.model,
      max_tokens: options?.maxTokens || 4096,
      system: messages.find(m => m.role === 'system')?.content,
      messages: messages.filter(m => m.role !== 'system'),
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters
      }))
    });
    
    return this.formatResponse(response);
  }
}
```

**OpenAI GPT-4:**
```typescript
// packages/ai/src/providers/openai.ts
export class OpenAIProvider implements AIProvider {
  async chatWithTools(messages: Message[], tools: Tool[], options?: ChatOptions): Promise<ChatResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        tools: tools.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters
          }
        })),
        max_tokens: options?.maxTokens
      })
    });
    
    const data = await response.json();
    const message = data.choices[0].message;
    
    return {
      content: message.content || '',
      finishReason: message.finish_reason === 'tool_calls' ? 'tool_calls' : 'stop',
      toolCalls: message.tool_calls?.map(tc => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments)
      })),
      usage: {
        inputTokens: data.usage.prompt_tokens,
        outputTokens: data.usage.completion_tokens
      }
    };
  }
}
```

#### Agent Tool Execution

```typescript
// services/api/src/handlers/chat.ts
export async function chatHandler(
  event: APIGatewayProxyEvent,
  userId?: string
): Promise<APIGatewayProxyResult> {
  if (!userId) return badRequest('User ID required');
  
  const { messages, context } = parseBody(event);
  
  // Create agent with user context
  const agent = createAgent({ userId, ...context });
  
  // Define financial tools
  const tools: Tool[] = [
    {
      name: 'simulate_debt_payoff',
      description: 'Simulate credit card debt payoff strategies',
      parameters: {
        type: 'object',
        properties: {
          cards: { type: 'array' },
          monthlyBudget: { type: 'number' },
          strategy: { type: 'string', enum: ['avalanche', 'snowball'] }
        },
        required: ['cards', 'monthlyBudget']
      }
    }
  ];
  
  // First AI call
  let response = await agent.chatWithTools(messages, tools);
  
  // Execute tool calls
  if (response.toolCalls) {
    for (const toolCall of response.toolCalls) {
      if (toolCall.name === 'simulate_debt_payoff') {
        const result = simulatePayoff(toolCall.arguments);
        
        // Send tool result back to AI
        messages.push({
          role: 'assistant',
          content: `Tool called: ${toolCall.name}`
        });
        messages.push({
          role: 'user',
          content: `Tool result: ${JSON.stringify(result)}`
        });
        
        // Get final response
        response = await agent.chat(messages);
      }
    }
  }
  
  return ok({
    message: response.content,
    toolsUsed: response.toolCalls?.map(tc => tc.name) || []
  });
}
```

### Cost Optimization

**Model Pricing (as of Oct 2025):**

| Provider | Model | Input ($/1M tokens) | Output ($/1M tokens) |
|----------|-------|--------------------:|---------------------:|
| Anthropic | Claude 3.5 Sonnet | $3.00 | $15.00 |
| OpenAI | GPT-4 Turbo | $10.00 | $30.00 |
| xAI | Grok Beta | $5.00 | $15.00 |
| DeepSeek | DeepSeek Chat | $0.27 | $1.10 |

**Strategy:**
- Use **Claude** for complex financial reasoning (best quality)
- Use **DeepSeek** for transaction classification (10x cheaper)
- Use **Grok** when real-time data is needed
- Cache common queries to reduce API calls

---

## Infrastructure as Code

### AWS CDK Benefits

**Why CDK over CloudFormation or Terraform?**

1. **Type Safety**: TypeScript catches errors before deployment
2. **Reusability**: Create constructs once, reuse across stacks
3. **AWS Native**: First-class support for all AWS services
4. **Simpler Syntax**: Less verbose than CloudFormation YAML
5. **Testing**: Unit test infrastructure with Jest

### CDK Stack Structure

```typescript
// infrastructure/lib/tyche-stack.ts
export class TycheStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    
    // 1. Authentication
    const userPool = new cognito.UserPool(this, 'TycheUserPool', {
      userPoolName: 'tyche-users',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true
      }
    });
    
    // 2. Database Tables
    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'tyche-users',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      pointInTimeRecovery: true
    });
    
    // 3. File Storage
    const uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
      bucketName: `tyche-uploads-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT, s3.HttpMethods.POST],
        allowedOrigins: ['*'],
        allowedHeaders: ['*']
      }],
      lifecycleRules: [{
        prefix: 'temp/',
        expiration: Duration.days(90)
      }]
    });
    
    // 4. Lambda Function
    const apiLambda = new lambda.Function(this, 'ApiFunction', {
      functionName: 'tyche-api',
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../services/api/dist')),
      environment: {
        USERS_TABLE: usersTable.tableName,
        TRANSACTIONS_TABLE: transactionsTable.tableName,
        CARDS_TABLE: cardsTable.tableName,
        UPLOADS_BUCKET: uploadsBucket.bucketName,
        AI_PROVIDER: 'anthropic',
        AI_MODEL: 'claude-3-5-sonnet-latest'
      },
      timeout: Duration.seconds(30),
      memorySize: 512
    });
    
    // Grant permissions
    usersTable.grantReadWriteData(apiLambda);
    transactionsTable.grantReadWriteData(apiLambda);
    cardsTable.grantReadWriteData(apiLambda);
    uploadsBucket.grantReadWrite(apiLambda);
    
    // 5. API Gateway
    const api = new apigateway.RestApi(this, 'TycheApi', {
      restApiName: 'Tyche Finance API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS
      }
    });
    
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'Authorizer', {
      cognitoUserPools: [userPool]
    });
    
    const lambdaIntegration = new apigateway.LambdaIntegration(apiLambda);
    
    // Add catch-all proxy route
    api.root.addProxy({
      defaultIntegration: lambdaIntegration,
      anyMethod: true
    });
  }
}
```

### Deployment Process

```bash
# 1. Install dependencies
npm install

# 2. Build Lambda code
npm run build

# 3. Preview changes
cd infrastructure
npx cdk diff

# 4. Deploy
npx cdk deploy

# Output:
# TycheStack.ApiUrl = https://abc123.execute-api.us-east-1.amazonaws.com/prod/
# TycheStack.UserPoolId = us-east-1_ABC123
# TycheStack.UserPoolClientId = 1234567890abcdef
```

---

## Security & Authentication

### Cognito JWT Flow

```
1. User signs up
   └─> POST to Cognito User Pool
   └─> Verification email sent via Amazon SES (app.tyche.financial@gmail.com)
   └─> 50,000 emails/day capacity (vs 50/day with default Cognito)

2. User confirms email
   └─> Click link or enter 6-digit code
   └─> Post-Confirmation Lambda trigger fires
   └─> User automatically added to "Users" group (RBAC)
   └─> Account activated

3. User logs in
   └─> POST credentials to Cognito
   └─> Returns: { IdToken, AccessToken, RefreshToken }
   └─> IdToken contains cognito:groups claim (e.g., ["Users"])

4. Client stores tokens
   └─> IdToken used for API authentication
   └─> RefreshToken used to get new IdToken when expired
   └─> Tokens stored in browser localStorage (Amplify handles this)

5. Client makes API request
   └─> GET /v1/cards
   └─> Header: Authorization: Bearer <IdToken>

6. API Gateway validates token
   └─> Checks signature with Cognito public key (JWKS)
   └─> Validates expiration (typically 1 hour)
   └─> Extracts user claims (sub, email, cognito:groups)

7. Lambda receives event
   └─> event.requestContext.authorizer.claims.sub = userId (permanent UUID)
   └─> event.requestContext.authorizer.claims['cognito:groups'] = ["Users"]
   └─> Handler uses userId to query user's data
   └─> Middleware checks group membership for admin endpoints
```

### Cognito User Identifiers

Cognito provides three different identifiers for users. Understanding which to use is critical:

| Identifier | Type | Example | Mutable? | Use Case |
|------------|------|---------|----------|----------|
| **`sub`** | UUID | `8448b4d8-20b1-7062-caba-1ab4ab081277` | ❌ Never changes | **PRIMARY KEY** - Use for database userId |
| **`username`** | String | Same as sub in our config | ❌ Never changes | Cognito internal reference |
| **`email`** | String | `user@example.com` | ✅ Can change | Display name, communication |

**Why We Use `sub` as `userId`:**
```typescript
// apps/web/src/hooks/useAuth.ts
const fetchUser = async (): Promise<User | null> => {
  const session = await fetchAuthSession();
  if (!session.tokens) return null;

  // Extract sub from JWT token - this is the permanent user identifier
  const sub = session.tokens.idToken?.payload.sub as string;

  const currentUser = await getCurrentUser();
  return {
    userId: sub,  // Using sub (UUID) as the permanent userId
    email: currentUser.signInDetails?.loginId ?? '',
    emailVerified: true,
  };
};
```

**Best Practices:**
- ✅ **DO** use `sub` as the primary key in databases
- ✅ **DO** use `email` for display and communication
- ✅ **DO** allow users to change their email without data loss
- ❌ **DON'T** use `email` as a primary key (it can change)
- ❌ **DON'T** assume `username` and `email` are the same

See [COGNITO_USER_IDENTIFIERS.md](./COGNITO_USER_IDENTIFIERS.md) for comprehensive guide.

### Email Configuration (Amazon SES)

**Configuration:**
- **Sender Email**: `app.tyche.financial@gmail.com` (verified in SES)
- **Service**: Amazon SES (Simple Email Service)
- **Region**: us-east-1
- **Current Mode**: Sandbox (verified recipients only)
- **Production Capacity**: 50,000 emails/day, 14 emails/second (after approval)

**SES Sending Authorization Policy:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "cognito-idp.amazonaws.com"
      },
      "Action": [
        "ses:SendEmail",
        "ses:SendRawEmail"
      ],
      "Resource": "arn:aws:ses:us-east-1:586794453404:identity/app.tyche.financial@gmail.com"
    }
  ]
}
```

**Cognito Email Configuration:**
```bash
aws cognito-idp update-user-pool \
  --user-pool-id us-east-1_khi9CtS4e \
  --email-configuration \
    EmailSendingAccount=DEVELOPER,\
    SourceArn=arn:aws:ses:us-east-1:586794453404:identity/app.tyche.financial@gmail.com,\
    ConfigurationSet=tyche-email-config
```

**Benefits:**
- 📧 Professional sender email (not noreply@verificationemail.com)
- 📊 Email delivery metrics and bounce tracking
- 🚀 High sending limits (50K/day vs 50/day default)
- ✅ Verified sender reputation
- 🔔 Customizable email templates (future enhancement)

See [SES_EMAIL_SETUP.md](./SES_EMAIL_SETUP.md) for complete setup guide.

### Post-Confirmation Lambda Trigger

**Purpose**: Automatically assign new users to the "Users" group after email verification.

**Architecture:**
```
User confirms email
  └─> Cognito fires Post-Confirmation trigger
    └─> Invokes tyche-post-confirmation Lambda
      └─> Lambda uses AWS SDK v3
        └─> AdminAddUserToGroup
          └─> User added to "Users" group
            └─> Future logins include cognito:groups claim
```

**Lambda Function:**
```javascript
// infrastructure/lambda-post-confirmation/index.js
const { CognitoIdentityProviderClient, AdminAddUserToGroupCommand } = 
  require('@aws-sdk/client-cognito-identity-provider');

exports.handler = async (event) => {
  const userPoolId = event.userPoolId;
  const username = event.userName;

  const client = new CognitoIdentityProviderClient({ region: 'us-east-1' });
  
  try {
    const command = new AdminAddUserToGroupCommand({
      UserPoolId: userPoolId,
      Username: username,
      GroupName: 'Users'  // Add to "Users" group by default
    });
    
    await client.send(command);
    console.log(`✅ Added user ${username} to Users group`);
  } catch (error) {
    console.error(`❌ Error adding user to group:`, error);
    // Don't throw - allow confirmation to complete even if group assignment fails
  }
  
  return event;  // Must return event for Cognito
};
```

**Deployment Package:**
- **Size**: 3.2MB (includes AWS SDK v3)
- **Dependencies**: `@aws-sdk/client-cognito-identity-provider` v3.675.0
- **Handler**: `index.handler`
- **Runtime**: Node.js 20.x

**Why This Approach?**
1. **Automatic RBAC**: New users get baseline permissions immediately
2. **No Manual Work**: Admins don't need to assign groups manually
3. **Consistent**: Every user follows the same onboarding path
4. **Auditable**: CloudWatch logs track all group assignments
5. **Resilient**: Errors logged but don't prevent account confirmation

**IAM Permissions:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cognito-idp:AdminAddUserToGroup"
      ],
      "Resource": "arn:aws:cognito-idp:us-east-1:586794453404:userpool/us-east-1_khi9CtS4e"
    }
  ]
}
```

See [COGNITO_GROUPS_MIGRATION.md](./COGNITO_GROUPS_MIGRATION.md) for RBAC details.

### Security Best Practices

**1. IAM Principle of Least Privilege:**
```typescript
// Lambda only gets what it needs
usersTable.grantReadWriteData(apiLambda);  // Not grantFullAccess
uploadsBucket.grantReadWrite(apiLambda);   // Not grantPublicAccess
```

**2. Environment Variables for Secrets:**
```typescript
// Never hardcode API keys
const anthropicKey = process.env.ANTHROPIC_API_KEY;
if (!anthropicKey) {
  throw new Error('ANTHROPIC_API_KEY not configured');
}
```

**3. Input Validation:**
```typescript
// Validate before processing
if (!body.cards || !Array.isArray(body.cards)) {
  return badRequest('Invalid input');
}

// Sanitize user input
const sanitized = DOMPurify.sanitize(body.description);
```

**4. Row-Level Security:**
```typescript
// Always filter by userId
const cards = await db.query({
  TableName: 'tyche-credit-cards',
  KeyConditionExpression: 'userId = :userId',  // ← Prevents accessing other users' data
  ExpressionAttributeValues: {
    ':userId': userId
  }
});
```

**5. PCI DSS Compliance - Credit Card Data Security:**

Tyche Finance **never stores full credit card numbers, CVV codes, or expiration dates** to comply with PCI DSS (Payment Card Industry Data Security Standard) and protect users from data breaches.

```typescript
// ✅ SECURE: Only store non-sensitive identifiers
export interface CreditCardAccount {
  id: string;
  name: string;
  network: CardNetwork;      // 'Visa' | 'Mastercard' | 'American Express' | 'Discover' | 'Other'
  lastFourDigits: string;    // EXACTLY 4 digits (e.g., "4532")
  limit: number;
  balance: number;
  apr: number;
  // ... other account info
}

// ❌ NEVER STORED:
// - Full card number (e.g., 4532-1234-5678-9012)
// - CVV security code (e.g., 123)
// - Expiration date (we don't need it for optimization calculations)
```

**Why This Approach?**
1. **PCI DSS Scope Reduction**: Not storing full card numbers means we don't need expensive PCI certification
2. **Breach Protection**: Even if our database is compromised, attackers get no usable payment information
3. **Zero Liability**: We cannot be liable for card fraud since we never had the card numbers
4. **User Trust**: Demonstrates security-first design philosophy
5. **Sufficient for Our Use Case**: We only need to identify cards and calculate optimal payoff strategies

**Validation Enforcement:**
```typescript
// services/api/src/handlers/cards.ts
export async function createCard(event, userId?) {
  const { network, lastFourDigits, ...rest } = parseBody(event);
  
  // Validate network is a known card type
  const validNetworks: CardNetwork[] = ['Visa', 'Mastercard', 'American Express', 'Discover', 'Other'];
  if (!validNetworks.includes(network)) {
    return badRequest(`Invalid network. Must be one of: ${validNetworks.join(', ')}`);
  }
  
  // Validate exactly 4 digits
  if (!/^\d{4}$/.test(lastFourDigits)) {
    return badRequest('lastFourDigits must be exactly 4 digits');
  }
  
  // 🔒 Security check: Reject if suspiciously long
  if (lastFourDigits.length > 4) {
    console.error(`[SECURITY] Attempt to store more than 4 digits. userId=${userId}`);
    return badRequest('Security error: Only last 4 digits allowed');
  }
  
  // Safe to store
  const card = {
    id: generateId(),
    userId,
    network,
    lastFourDigits,
    ...rest,
    createdAt: new Date().toISOString()
  };
  
  await db.put({ TableName: 'tyche-credit-cards', Item: card });
  
  // Log with masked digits for privacy
  console.log(`[CreateCard] userId=${userId} network=${network} lastFour=****${lastFourDigits}`);
  
  return created(card);
}
```

**Update Protection:**
```typescript
// Prevent modification of immutable identifiers
export async function updateCard(event, userId?) {
  const body = parseBody(event);
  
  // 🔒 SECURITY: lastFourDigits and network cannot be changed
  if ('lastFourDigits' in body) {
    return badRequest('Cannot modify lastFourDigits (immutable identifier)');
  }
  
  if ('network' in body) {
    return badRequest('Cannot modify network (immutable identifier)');
  }
  
  // Only allow updates to mutable fields (balance, limit, APR, etc.)
  // ...
}
```

**Frontend Usage:**
```typescript
// Frontend form collects only safe data
<form onSubmit={handleCreateCard}>
  <input name="name" placeholder="Card nickname (e.g., Chase Freedom)" />
  
  <select name="network">
    <option value="Visa">Visa</option>
    <option value="Mastercard">Mastercard</option>
    <option value="American Express">American Express</option>
    <option value="Discover">Discover</option>
    <option value="Other">Other</option>
  </select>
  
  <input 
    name="lastFourDigits" 
    placeholder="Last 4 digits" 
    pattern="\d{4}" 
    maxLength={4}
    required 
  />
  
  {/* NO FULL CARD NUMBER INPUT */}
  {/* NO CVV INPUT */}
  {/* NO EXPIRATION DATE INPUT */}
  
  <input name="balance" type="number" placeholder="Current balance" />
  <input name="limit" type="number" placeholder="Credit limit" />
  <input name="apr" type="number" step="0.0001" placeholder="APR (e.g., 0.1999)" />
  
  <button type="submit">Add Card</button>
</form>
```

**Benefits for Users:**
- ✅ Never have to enter full card number
- ✅ Fast card identification by name + last 4 digits
- ✅ Peace of mind knowing sensitive data is never stored
- ✅ Full optimization features without security compromise

---

## Multi-Tenancy & Role-Based Access Control (RBAC)

**Added:** October 15, 2025  
**Status:** ✅ Implemented (authorization middleware, handlers, audit logging)

### Overview

Tyche Finance implements a **multi-tenant architecture with role-based access control** to support:
- Multiple organizations (tenants) sharing the same infrastructure
- Three user roles with different permission levels
- Complete data isolation between tenants
- Comprehensive audit logging for compliance

### Architecture Pattern: Row-Level Isolation

```typescript
// ❌ INSECURE: No tenant isolation
DynamoDB Item: {
  PK: "USER#user-123",
  SK: "METADATA",
  email: "john@example.com"
}

// ✅ SECURE: Tenant-isolated keys
DynamoDB Item: {
  PK: "TENANT#acme-corp#USER#user-123",  // Composite partition key
  SK: "METADATA",
  tenantId: "acme-corp",
  email: "john@example.com"
}
```

**Key Insight:** By including `tenantId` in the partition key, we achieve:
1. **Physical separation** at the database level
2. **Query-time isolation** (must know tenantId to access data)
3. **Protection against bugs** (wrong tenantId = query returns empty)

### Role Hierarchy

```typescript
// packages/types/src/index.ts
export type UserRole = 'user' | 'dev' | 'admin';

const ROLE_HIERARCHY: Record<UserRole, number> = {
  user: 1,   // Self-service only
  dev: 2,    // + System monitoring
  admin: 3   // + User management, full access
};
```

**Permission Matrix:**

| Resource | User | Dev | Admin |
|----------|------|-----|-------|
| Own cards/transactions | ✅ Read/Write | ✅ Read/Write | ✅ Full |
| AI chat | ✅ | ✅ | ✅ |
| System metrics | ❌ | ✅ Read | ✅ Read |
| Error logs | ❌ | ✅ Read | ✅ Read/Write |
| User management | ❌ | ❌ | ✅ Full |
| Audit logs | ❌ | ❌ | ✅ Read |
| Cross-user data | ❌ | ❌ | ✅ Read |

### Authorization Middleware

**Location:** `services/api/src/middleware/authorize.ts`

```typescript
/**
 * Authorization flow:
 * 1. Extract JWT claims from API Gateway event
 * 2. Parse user role, tenantId, permissions
 * 3. Check role hierarchy (user < dev < admin)
 * 4. Optionally check fine-grained permissions
 * 5. Return authorized=true/false + user context
 */
export async function authorize(
  event: APIGatewayProxyEventV2,
  requiredRole: UserRole = 'user',
  requiredPermission?: string
): Promise<AuthorizationResult> {
  const context = extractAuthContext(event);
  
  if (!context) {
    return { authorized: false, reason: 'No valid JWT token' };
  }
  
  if (!hasRole(context.role, requiredRole)) {
    return { 
      authorized: false, 
      reason: `Insufficient privileges. Required: ${requiredRole}, User: ${context.role}` 
    };
  }
  
  if (requiredPermission && !hasPermission(context, requiredPermission)) {
    return { 
      authorized: false, 
      reason: `Missing permission: ${requiredPermission}` 
    };
  }
  
  return { authorized: true, user, context };
}
```

**Usage in Handlers:**

```typescript
// Admin-only endpoint
export async function listAllUsers(event, _userId?) {
  const auth = await authorize(event, 'admin');
  
  if (!auth.authorized) {
    return forbidden(auth.reason);
  }
  
  const { user, context } = auth;
  
  // Now safe to proceed with admin operations
  const users = await queryAllUsers(context.tenantId);
  
  // Log admin action
  await auditLog({
    tenantId: context.tenantId,
    userId: context.userId,
    role: context.role,
    action: 'list_all_users',
    resource: 'users',
    success: true
  });
  
  return ok({ users });
}
```

### JWT Custom Claims

**Cognito Configuration (CDK):**

```typescript
// infrastructure/lib/tyche-stack.ts
const userPool = new cognito.UserPool(this, 'TycheUserPool', {
  userPoolName: 'tyche-users',
  customAttributes: {
    // Cannot be changed after user creation (security)
    tenantId: new cognito.StringAttribute({ mutable: false }),
    
    // Can be modified by admins
    role: new cognito.StringAttribute({ mutable: true }),
    permissions: new cognito.StringAttribute({ mutable: true })
  }
});
```

**JWT Payload Structure:**

```json
{
  "sub": "user-123",                        // Standard: User ID
  "email": "john@acme.com",                 // Standard: Email
  "custom:tenantId": "acme-corp",           // Custom: Tenant ID
  "custom:role": "admin",                   // Custom: User role
  "custom:permissions": "users:write,cards:read",  // Custom: Permissions
  "iss": "https://cognito-idp.us-east-1.amazonaws.com/...",
  "exp": 1729012800,                        // Expiration timestamp
  "iat": 1729009200                         // Issued at
}
```

**Security Properties:**
- Claims are **cryptographically signed** by Cognito
- Tampering invalidates the signature → token rejected
- Expiration (`exp`) limits damage from stolen tokens
- Stateless (no database lookup needed for authorization)

### Audit Logging

**Location:** `services/api/src/utils/audit.ts`

**Purpose:**
1. **Security:** Detect unauthorized access attempts
2. **Compliance:** GDPR, HIPAA, SOC2 require audit trails
3. **Debugging:** "What happened before it broke?"
4. **Trust:** Users can see who accessed their data

**Implementation:**

```typescript
export async function auditLog(entry: Omit<AuditLogEntry, 'timestamp'>) {
  const timestamp = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60);  // 90 days
  
  await docClient.send(new PutCommand({
    TableName: 'tyche-audit-logs',
    Item: {
      PK: `TENANT#${entry.tenantId}`,
      SK: `LOG#${timestamp}#${randomId}`,
      ...entry,
      timestamp,
      ttl  // Auto-delete after 90 days
    }
  }));
  
  // Also log to CloudWatch for real-time monitoring
  console.log('[AUDIT]', JSON.stringify({ ...entry, timestamp }));
}
```

**Logged Events:**
- ✅ Admin viewing another user's data (`admin_view_cards`)
- ✅ Role changes (`change_user_role`)
- ✅ Account suspension (`suspend_user`)
- ✅ Failed authorization attempts (`unauthorized_access`)
- ✅ Data exports (`export_data`)
- ✅ User impersonation (`impersonate_start`, `impersonate_stop`)

### Admin & Dev Endpoints

**Admin Endpoints** (`/v1/admin/*`):

```typescript
// services/api/src/handlers/admin/users.ts

GET    /v1/admin/users              // List all users in tenant
GET    /v1/admin/users/{userId}     // Get user details
PUT    /v1/admin/users/{userId}/role         // Change user role
POST   /v1/admin/users/{userId}/suspend      // Suspend account
POST   /v1/admin/users/{userId}/activate     // Reactivate account
GET    /v1/admin/users/stats        // User statistics
```

**Dev Endpoints** (`/v1/dev/*`):

```typescript
// services/api/src/handlers/dev/metrics.ts

GET    /v1/dev/metrics              // System performance metrics
GET    /v1/dev/logs                 // Recent error logs
POST   /v1/dev/test/ai              // Test AI provider connectivity
GET    /v1/dev/analytics/usage      // Usage analytics (anonymized)
```

### Tenant Key Helpers

```typescript
// services/api/src/middleware/authorize.ts

// Create tenant-aware partition key
export function createTenantKey(
  tenantId: string,
  entityType: string,
  entityId: string
): string {
  return `TENANT#${tenantId}#${entityType}#${entityId}`;
}

// Usage:
const userKey = createTenantKey('acme-corp', 'USER', 'user-123');
// Returns: "TENANT#acme-corp#USER#user-123"

const cardKey = createTenantKey('acme-corp', 'USER', 'user-123');
const cardSort = `CARD#${cardId}`;
// Query: PK = cardKey, SK begins_with "CARD#"
```

### Security Considerations

**1. Never Trust Client Input:**
```typescript
// ❌ DANGER: Trusting user-provided tenantId
const body = JSON.parse(event.body);
const tenantId = body.tenantId;  // Attacker can modify!

// ✅ SAFE: Always use JWT's tenantId
const auth = await authorize(event, 'user');
const tenantId = auth.context.tenantId;  // Cryptographically verified
```

**2. Prevent Self-Harm:**
```typescript
// Don't let admin suspend their own account
if (targetUserId === context.userId) {
  return badRequest('Cannot suspend your own account');
}
```

**3. Resource Ownership Validation:**
```typescript
// Fetch card from database
const card = await getCard(context.tenantId, userId, cardId);

// Verify ownership before allowing modification
if (card.userId !== context.userId && context.role !== 'admin') {
  return forbidden('You do not own this card');
}
```

### Database Schema Updates

**All DynamoDB tables now use tenant-aware keys:**

```typescript
// Users table
{
  PK: "TENANT#acme-corp#USER#user-123",
  SK: "METADATA",
  tenantId: "acme-corp",
  userId: "user-123",
  email: "...",
  role: "user"
}

// Cards table
{
  PK: "TENANT#acme-corp#USER#user-123",
  SK: "CARD#card-456",
  tenantId: "acme-corp",
  userId: "user-123",
  cardId: "card-456",
  name: "Chase Sapphire",
  balance: 5000
}

// Audit logs table (new)
{
  PK: "TENANT#acme-corp",
  SK: "LOG#2025-10-15T14:30:00Z#abc123",
  tenantId: "acme-corp",
  userId: "admin-123",
  role: "admin",
  action: "view_user_cards",
  targetUserId: "user-456",
  timestamp: "2025-10-15T14:30:00Z",
  ttl: 1737043800  // Auto-delete after 90 days
}
```

### Implementation Status

✅ **Completed:**
- [x] Deploy Cognito custom attributes via CDK (tenantId, role, permissions)
- [x] Create audit logs DynamoDB table (with 90-day TTL)
- [x] Wire up real DynamoDB queries in handlers (all handlers complete)
- [x] Add GSIs for EmailIndex, RoleIndex, UserIndex, ActionIndex
- [x] Implement all admin user management handlers
- [x] Implement all dev system monitoring handlers

📋 **Pending:**
- [ ] Implement admin UI in React web app
- [ ] Add rate limiting per tenant/user
- [ ] Implement user impersonation feature (for support)
- [ ] Deploy to AWS and test with real infrastructure

### Related Documentation

- Full RBAC design: [`MULTI_TENANCY.md`](./MULTI_TENANCY.md)
- Learning guide: [`LEARNING_GUIDE.md`](./LEARNING_GUIDE.md)
- Developer quick reference: [`DEVELOPER_GUIDE.md`](./DEVELOPER_GUIDE.md)
- Deployment procedures: [`DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md)

---

## Development Patterns

### Error Handling

**Backend (Lambda):**
```typescript
try {
  const result = await riskyOperation();
  return ok(result);
} catch (error) {
  console.error('Error in handler:', error);
  
  if (error instanceof ValidationError) {
    return badRequest(error.message);
  }
  
  if (error instanceof NotFoundError) {
    return notFound(error.message);
  }
  
  return serverError('Internal server error', error);
}
```

**Frontend (React):**
```typescript
import { useQuery } from '@tanstack/react-query';

function Dashboard() {
  const { data, error, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
    retry: 3,
    staleTime: 5 * 60 * 1000  // 5 minutes
  });
  
  if (isLoading) return <Spinner />;
  if (error) return <ErrorAlert message={error.message} />;
  
  return <DashboardView data={data} />;
}
```

### Testing Strategy

**Unit Tests (Vitest):**
```typescript
// packages/core/src/index.test.ts
import { describe, it, expect } from 'vitest';
import { simulatePayoff } from './index';

describe('simulatePayoff', () => {
  it('should calculate avalanche correctly', () => {
    const result = simulatePayoff({
      cards: [
        { id: '1', balance: 5000, apr: 0.15, minPayment: 100 },
        { id: '2', balance: 2000, apr: 0.25, minPayment: 50 }
      ],
      monthlyBudget: 500,
      strategy: 'avalanche'
    });
    
    expect(result.monthsToDebtFree).toBeGreaterThan(0);
    expect(result.totalInterest).toBeGreaterThan(0);
  });
});
```

**Integration Tests (Lambda Local):**
```typescript
// services/api/src/handlers/payoff.test.ts
import { simulatePayoffHandler } from './payoff';

it('should return 400 for invalid input', async () => {
  const event = {
    body: JSON.stringify({ cards: 'invalid' })
  };
  
  const response = await simulatePayoffHandler(event, 'user-123');
  
  expect(response.statusCode).toBe(400);
  expect(JSON.parse(response.body).error).toContain('Invalid');
});
```

**E2E Tests (Playwright):**
```typescript
// apps/web/tests/e2e/payoff.spec.ts
import { test, expect } from '@playwright/test';

test('user can simulate debt payoff', async ({ page }) => {
  await page.goto('/dashboard');
  await page.click('text=Add Credit Card');
  await page.fill('[name="name"]', 'Chase Sapphire');
  await page.fill('[name="balance"]', '5000');
  await page.fill('[name="apr"]', '19.99');
  await page.click('text=Simulate Payoff');
  
  await expect(page.locator('.payoff-result')).toContainText('months');
});
```

---

## Design Decisions & Trade-offs

### 1. TypeScript Over JavaScript

**Decision**: Use TypeScript exclusively across monorepo

**Reasoning**:
- ✅ Catch errors at compile time (saves hours of debugging)
- ✅ Better IDE autocomplete and refactoring
- ✅ Self-documenting code (types as documentation)
- ✅ Easier onboarding (new developers can understand code faster)

**Trade-offs**:
- ❌ Initial setup complexity (tsconfig, project references)
- ❌ Slightly slower builds (type checking overhead)
- ✅ But: 100% worth it for medium+ projects

### 2. Serverless Over Traditional Servers

**Decision**: AWS Lambda + API Gateway instead of EC2 + Express

**Reasoning**:
- ✅ Zero ops: No servers to patch, scale, or monitor
- ✅ Cost: Free tier covers dev, production scales to zero when unused
- ✅ Performance: Auto-scales to handle traffic spikes

**Trade-offs**:
- ❌ Cold starts (~500ms for Node.js Lambda)
- ❌ 15-minute execution limit (not an issue for API endpoints)
- ✅ Mitigations: Provisioned concurrency, keep-warm pings

### 3. DynamoDB Over PostgreSQL

**Decision**: NoSQL (DynamoDB) instead of relational (RDS PostgreSQL)

**Reasoning**:
- ✅ Serverless: No database instance to manage
- ✅ Performance: Consistent single-digit ms latency
- ✅ Cost: Pay-per-request cheaper for variable workloads

**Trade-offs**:
- ❌ No SQL joins (must denormalize data)
- ❌ Learning curve for access patterns
- ✅ But: Our app doesn't need complex joins

### 4. Multi-Model AI vs Single Provider

**Decision**: Support multiple AI providers (Claude, GPT-4, Grok, DeepSeek)

**Reasoning**:
- ✅ Cost optimization: DeepSeek 10x cheaper for simple tasks
- ✅ Experimentation: A/B test quality vs cost
- ✅ Redundancy: Failover if one provider has outage

**Trade-offs**:
- ❌ More code to maintain (4 provider implementations)
- ❌ Testing complexity (must test each provider)
- ✅ But: Abstraction makes adding providers easy

### 5. Monorepo vs Multi-Repo

**Decision**: Single monorepo for all packages

**Reasoning**:
- ✅ Atomic changes: Update API contract and clients in one PR
- ✅ Simplified dependency management: One `package-lock.json`
- ✅ Code sharing: Shared types and logic without publishing

**Trade-offs**:
- ❌ Larger git repo size
- ❌ CI/CD needs to be smart (only build changed packages)
- ✅ But: Benefits outweigh for projects under 100 packages

---

## Performance Considerations

### Frontend Performance

**Code Splitting:**
```typescript
// Lazy load routes
const Dashboard = lazy(() => import('./features/dashboard/Dashboard'));
const Cards = lazy(() => import('./features/cards/CreditCardList'));

function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/cards" element={<Cards />} />
      </Routes>
    </Suspense>
  );
}
```

**Memoization:**
```typescript
import { useMemo } from 'react';

function PayoffChart({ steps }: { steps: PayoffStep[] }) {
  const chartData = useMemo(() => {
    return steps.map(step => ({
      month: step.month,
      balance: step.remainingBalance
    }));
  }, [steps]);
  
  return <LineChart data={chartData} />;
}
```

### Backend Performance

**Lambda Warm Start Optimization:**
```typescript
// Initialize AWS SDK clients outside handler
const dynamoDB = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoDB);

// Handler reuses clients across invocations
export const handler = async (event: APIGatewayProxyEvent) => {
  // Cold start: ~500ms (includes SDK init)
  // Warm start: ~50ms (clients already initialized)
  const result = await docClient.send(new GetCommand({ ... }));
};
```

**DynamoDB Query Optimization:**
```typescript
// BAD: Scan entire table
const allUsers = await docClient.send(new ScanCommand({
  TableName: 'tyche-users'
}));
// Cost: Reads every item, very expensive

// GOOD: Query with partition key
const userCards = await docClient.send(new QueryCommand({
  TableName: 'tyche-credit-cards',
  KeyConditionExpression: 'userId = :userId',
  ExpressionAttributeValues: { ':userId': userId }
}));
// Cost: Only reads user's cards, fast and cheap
```

---

## Analytics Architecture

### Overview

The analytics system transforms Tyche from a simple calculator into an intelligent financial coach by tracking user improvement over time, identifying successful strategies, and providing data-driven insights.

### Design Goals

1. **Track Financial Progress**: Show users concrete evidence of debt reduction
2. **Measure Strategy Effectiveness**: Identify which payoff methods work best
3. **Maintain Motivation**: Gamification through milestones and visible progress
4. **Enable Data-Driven Decisions**: Provide insights for product improvements

### Core Components

#### 1. Financial Health Snapshots

**What**: Immutable time-series records of user financial state

```typescript
interface FinancialHealthSnapshot {
  id: string;
  userId: string;
  tenantId: string;
  timestamp: string;
  totalDebt: number;
  creditUtilization: number;
  averageAPR: number;
  debtReductionFromLastMonth?: number;
  snapshotType: 'daily' | 'weekly' | 'monthly' | 'milestone' | 'manual';
}
```

**Why This Design:**
- ✅ **Immutable History**: Can't accidentally overwrite past data
- ✅ **Trend Analysis**: Multiple snapshots create time series for charts
- ✅ **Lightweight**: Store metrics, not raw card data (reduces storage)
- ✅ **Performance**: Query by timestamp range using GSI

**Alternative Rejected:**
- ❌ **Store only current state**: Loses all historical data, can't show improvement
- ❌ **Event sourcing**: Too complex, harder to query for trends
- ❌ **Real-time aggregation**: Slow queries, expensive to recalculate metrics

**DynamoDB Schema:**
```
PK: "TENANT#acme-corp#USER#user-123"
SK: "SNAPSHOT#2025-10-15T10:00:00Z#abc123"
GSI: TimestampIndex
  PK: userId
  SK: timestamp (for efficient date-range queries)
```

**Snapshot Creation Triggers:**
- User logs payment
- Card balance updated
- Monthly automatic snapshot (cron job)
- User manually requests snapshot

#### 2. Financial Goals

**What**: User-defined targets with progress tracking

```typescript
interface FinancialGoal {
  id: string;
  type: 'debt_payoff' | 'savings' | 'credit_score';
  targetDate: string;
  startingAmount: number;
  currentAmount: number;
  progress: number;  // 0-1
  isOnTrack: boolean;
  preferredStrategy?: 'avalanche' | 'snowball';
}
```

**Why Separate from Snapshots:**
- **Different Access Patterns**: Snapshots are append-only time-series; goals are CRUD
- **User Intent**: Goals = future aspirations, Snapshots = past achievements
- **Flexibility**: Multiple concurrent goals (debt + savings + credit score)

**Progress Calculation Logic:**
```typescript
// ✅ Good: Shows 0% at start, 100% at completion
progress = (startingAmount - currentAmount) / (startingAmount - targetAmount)

// ❌ Bad: Would show 100% at start
progress = currentAmount / targetAmount
```

**On-Track Calculation:**
```typescript
const daysElapsed = now - goalCreatedDate;
const daysTotal = targetDate - goalCreatedDate;
const expectedProgress = daysElapsed / daysTotal;

isOnTrack = actualProgress >= expectedProgress;
```

#### 3. Weighted Average APR

**Why Weighted (Not Simple Average):**

**Problem:** A simple average treats all cards equally:
```typescript
// ❌ Bad: Simple average
const simpleAvg = (19% + 22% + 15%) / 3 = 18.67%
```

**Solution:** Weight by balance (cards with higher debt have more impact):
```typescript
// ✅ Good: Weighted average
Card A: $10,000 @ 22% → weighted contribution: $2,200
Card B: $500   @ 15% → weighted contribution: $75
Total debt: $10,500
Weighted APR: ($2,200 + $75) / $10,500 = 21.67%
```

**Implementation:**
```typescript
const totalWeightedAPR = cards.reduce(
  (sum, card) => sum + (card.balance * card.apr),
  0
);
const averageAPR = totalDebt > 0 ? totalWeightedAPR / totalDebt : 0;
```

**Why This Matters:**
Using simple average would underestimate interest costs by ~3% in the example above, leading to:
- ❌ Overly optimistic debt-free date projections
- ❌ User disappointment when actual interest is higher
- ❌ Inaccurate payoff simulations

#### 4. Trend Analysis Algorithms

**Improvement Calculation:**
```typescript
function calculateImprovement(snapshots: Snapshot[]) {
  // Sort by timestamp (oldest first)
  const sorted = snapshots.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const oldest = sorted[0];
  const latest = sorted[sorted.length - 1];
  
  return {
    debtChange: oldest.totalDebt - latest.totalDebt,
    debtChangePercentage: ((oldest.totalDebt - latest.totalDebt) / oldest.totalDebt) * 100,
    utilizationChange: oldest.creditUtilization - latest.creditUtilization,
    daysTracked: Math.floor((latest.timestamp - oldest.timestamp) / DAY_MS)
  };
}
```

**Why Simple Subtraction (Not Linear Regression):**
- ✅ Easy to understand: "You reduced $3,450 in 90 days"
- ✅ Works with any number of data points (2 to 1000)
- ✅ Robust to outliers (temporary balance spike doesn't skew trend)
- ❌ Linear regression would be overkill for typical 3-12 months of data
- ❌ Harder to explain to non-technical users

**Average Monthly Reduction:**
```typescript
function calculateAvgMonthlyReduction(snapshots: Snapshot[]): number {
  let totalReduction = 0;
  let monthsCount = 0;
  
  // Compare consecutive snapshots
  for (let i = 1; i < snapshots.length; i++) {
    const reduction = snapshots[i - 1].totalDebt - snapshots[i].totalDebt;
    if (reduction > 0) {
      totalReduction += reduction;
      monthsCount++;
    }
  }
  
  return monthsCount > 0 ? totalReduction / monthsCount : 0;
}
```

**Use Case:** "At your current pace of $380/month reduction, you'll be debt-free in 18 months"

#### 5. Debt-Free Date Projections

**Algorithm:**
```typescript
function calculateProjections(snapshots: Snapshot[]) {
  const avgReduction = calculateAvgMonthlyReduction(snapshots);
  const currentDebt = snapshots[snapshots.length - 1].totalDebt;
  
  // Edge cases
  if (avgReduction <= 0 || currentDebt <= 0) return null;
  
  // Conservative estimate (round up)
  const monthsRemaining = Math.ceil(currentDebt / avgReduction);
  const debtFreeDate = addMonths(new Date(), monthsRemaining);
  
  return { monthsRemaining, debtFreeDate, avgReduction };
}
```

**Why `Math.ceil()` (Round Up):**
- ✅ Better to underestimate than overpromise
- ✅ User exceeding expectation feels good
- ✅ Accounts for life events (emergency expenses)

**Why Based on Actual History (Not Declared Plans):**
- ❌ Users overestimate their payment ability
- ❌ "I'll pay $1000/month" often becomes $600/month
- ✅ Past behavior is the best predictor of future behavior

#### 6. Milestone System (Gamification)

**Purpose:** Keep users engaged with small, achievable wins

**Milestone Types:**

```typescript
function calculateMilestones(snapshots: Snapshot[]): string[] {
  const milestones: string[] = [];
  const latest = snapshots[snapshots.length - 1];
  
  // Utilization milestones (credit score impact)
  if (latest.creditUtilization < 0.3) {
    milestones.push('🎉 Under 30% credit utilization');
  }
  if (latest.creditUtilization < 0.1) {
    milestones.push('⭐ Under 10% credit utilization');
  }
  
  // Time-based engagement
  if (snapshots.length >= 30) {
    milestones.push('📅 30 days of tracking');
  }
  if (snapshots.length >= 90) {
    milestones.push('🏆 90 days of tracking');
  }
  
  // Debt reduction
  const improvement = calculateImprovement(snapshots);
  if (improvement.debtChange > 1000) {
    milestones.push('💰 $1,000+ in debt paid off');
  }
  
  return milestones;
}
```

**Behavioral Psychology:**
- **Dopamine Hits**: Small wins release dopamine, reinforcing positive behavior
- **Progress Markers**: Long-term goals (2 years) feel far; milestones show progress
- **Social Proof**: "Share your milestone" encourages viral growth

**Milestone Design Principles:**
1. ✅ **Achievable**: 30 days (easy) not 365 days (discouraging)
2. ✅ **Meaningful**: 30% utilization matters for credit scores
3. ✅ **Variety**: Time-based, metric-based, action-based
4. ✅ **Incremental**: Multiple tiers (30%, 20%, 10% utilization)

#### 7. Cohort Analysis (Future ML)

**Purpose:** Identify patterns in user success to personalize recommendations

```typescript
interface UserCohort {
  cohortId: string;
  criteria: {
    startingDebtRange: { min: number; max: number };
    numberOfCards: { min: number; max: number };
    strategy?: 'avalanche' | 'snowball';
  };
  avgDebtReduction: number;
  completionRate: number;
  avgTimeToDebtFree: number;
}
```

**Example Insights:**
```
Cohort: $10k-$20k debt, 3-4 cards, using avalanche
- Completion rate: 78%
- Average time: 14 months
- Average interest saved: $3,200

Cohort: $10k-$20k debt, 3-4 cards, using snowball
- Completion rate: 72%
- Average time: 16 months
- Average interest saved: $2,100

→ Recommend avalanche to new users in this cohort
```

**Machine Learning Applications:**
1. **Churn Prediction**: Identify users at risk of abandoning app
2. **Success Prediction**: "You have 85% chance of success with avalanche"
3. **Personalized Recommendations**: Suggest strategies based on similar users
4. **Feature Effectiveness**: Which features correlate with user success?

### DynamoDB Schema Design

**Tables:**

```typescript
// Financial Snapshots
tyche-financial-snapshots
  PK: "TENANT#tid#USER#uid"
  SK: "SNAPSHOT#2025-10-15T10:00:00Z#id"
  GSI: TimestampIndex (userId, timestamp)

// Financial Goals  
tyche-goals
  PK: "TENANT#tid#USER#uid"
  SK: "GOAL#2025-10-15T10:00:00Z#id"
  GSI: StatusIndex (userId, status)

// User Analytics
tyche-user-analytics
  PK: "TENANT#tid#USER#uid"
  SK: "PERIOD#2025-10-01#2025-10-31"
  TTL: 90 days (optional, for GDPR compliance)
```

**Why Composite Keys:**
```typescript
PK: "TENANT#acme-corp#USER#user-123"
```

**Benefits:**
- ✅ **Tenant Isolation**: Physical separation prevents cross-tenant data leaks
- ✅ **Security**: Even with bug in code, can't query other tenants
- ✅ **Performance**: Partition key groups all user's data together
- ✅ **SaaS-Ready**: Enterprise clients get isolated data

**GSI Strategy:**

**Without GSI (Bad):**
```typescript
// Scan entire table, filter by userId (SLOW, EXPENSIVE)
scan({ FilterExpression: 'userId = :uid' })
// Cost: $0.25 per 1M items scanned
// Speed: Seconds for large tables
```

**With GSI (Good):**
```typescript
// Query partition directly (FAST, CHEAP)
query({
  IndexName: 'TimestampIndex',
  KeyConditionExpression: 'userId = :uid AND #ts BETWEEN :start AND :end'
})
// Cost: $0.25 per 1M items read (only reads what you need)
// Speed: <100ms
```

### API Endpoints

```typescript
// User endpoints (all users)
POST   /v1/analytics/snapshot         // Create snapshot
GET    /v1/analytics/snapshots        // Get historical snapshots
POST   /v1/analytics/goal             // Create goal
GET    /v1/analytics/goals            // Get goals
PUT    /v1/analytics/goal/{goalId}    // Update goal
GET    /v1/analytics/progress         // Comprehensive progress report

// Dev/Admin endpoints (analytics team)
GET    /v1/analytics/insights         // Aggregate analytics across users
```

**Why Separate Endpoints (Not 1 Monolith):**
- ✅ **Single Responsibility**: Each does one thing well
- ✅ **Performance**: Fetching snapshots doesn't need goals data
- ✅ **Permissions**: Insights endpoint is dev-only
- ✅ **Caching**: Cache snapshots (rarely change) separately from progress

### Performance Optimizations

**1. Snapshot Frequency:**
```typescript
// ❌ Bad: Snapshot on every card update (100+ per day)
// ✅ Good: Snapshot once per day + on major events (payment, goal milestone)
```

**2. Query Limits:**
```typescript
// Default: Return last 30 snapshots
// User can request more via ?limit=90
GET /v1/analytics/snapshots?limit=30&startDate=2025-01-01
```

**3. Projection (Select Only Needed Fields):**
```typescript
query({
  ProjectionExpression: 'timestamp, totalDebt, creditUtilization'
  // Don't fetch all 20 fields if only need 3
})
```

### Scalability

**Current Performance:**
- **Snapshot Creation**: <100ms
- **Query 30 Snapshots**: <50ms
- **Progress Report**: <200ms (queries snapshots + goals + calculations)

**At Scale (1M users):**
- **DynamoDB**: Auto-scales, no changes needed
- **Lambda**: Concurrent executions handle load
- **Cost**: ~$0.001 per user per month (~$1,000/month for 1M users)

**Future Optimizations:**
- [ ] ElastiCache for hot data (active users)
- [ ] Pre-calculate aggregations (run nightly)
- [ ] Lambda@Edge for geo-distributed queries

### Monitoring & Alerts

**CloudWatch Metrics:**
- Snapshot creation rate (per user, per day)
- Goal completion rate
- Progress report latency
- Failed snapshot creation (indicates issues with card data)

**Alerts:**
- Snapshot creation failures > 5%
- Progress report latency > 500ms
- Goal update failures (may indicate bad data)

### Privacy & Compliance

**Data Retention:**
- Snapshots: Indefinite (or until user requests deletion)
- Analytics: 90-day TTL (GDPR compliance)
- Audit logs: 90-day TTL

**PII Handling:**
- Snapshots contain no PII (only metrics)
- Cross-tenant queries impossible (composite key isolation)
- Admin access logged in audit table

### Future Enhancements

**Phase 2:**
- [ ] AI-powered insights: "Your debt reduction is slowing. Consider increasing payments by $100/month"
- [ ] Predictive alerts: "Based on spending patterns, you may miss your goal"
- [ ] Comparative analytics: "You're reducing debt 20% faster than average"

**Phase 3:**
- [ ] Export data (CSV, PDF reports)
- [ ] Share progress with financial advisors
- [ ] Integration with financial institutions (Plaid)

---

## Scalability & Future Roadmap

### Current Limits

| Resource | Limit | Headroom |
|----------|-------|----------|
| Lambda Concurrent Executions | 1,000 (default) | Can request increase to 10,000+ |
| API Gateway RPS | 10,000 (default) | Can request increase |
| DynamoDB RCU/WCU | Unlimited (on-demand) | Auto-scales |
| S3 Storage | Unlimited | Unlimited |
| Cognito Users | 50,000 (soft limit) | Can request increase |

**Bottlenecks:**
- ⚠️ API Gateway throttling (10k RPS)
- ⚠️ Lambda concurrent executions (1k default)
- ✅ DynamoDB and S3 scale automatically

### Horizontal Scaling

**Lambda:**
- Automatically scales to handle concurrent requests
- Each request gets its own instance
- Limit is account-level, not function-level

**DynamoDB:**
- On-demand mode scales automatically
- No provisioned capacity to manage
- Can handle "unlimited" RPS

**API Gateway:**
- Distributes load across multiple Availability Zones
- Can handle sudden traffic spikes

### Future Enhancements

**Phase 2: Advanced Features**
- [ ] Transaction categorization with ML
- [ ] Automated savings recommendations
- [ ] Bill negotiation assistant (AI calls companies)
- [ ] Investment portfolio integration (Plaid)

**Phase 3: Enterprise Features**
- [ ] White-label version for banks
- [ ] Family/household accounts
- [ ] Financial advisor dashboard
- [ ] HIPAA/SOC2 compliance

**Phase 4: Scale Optimizations**
- [ ] CloudFront CDN for static assets
- [ ] Lambda@Edge for geo-routing
- [ ] ElastiCache for hot data
- [ ] SQS for async processing (OCR, heavy computations)

---

## Conclusion

Tyche Finance's architecture prioritizes:

1. **Developer Experience**: Fast builds, hot reloading, type safety
2. **Code Reusability**: Shared packages across web, mobile, backend
3. **Operational Simplicity**: Serverless architecture, no servers to manage
4. **Cost Efficiency**: Pay-per-use, free tier covers dev and small production
5. **Flexibility**: Swappable AI models, extensible design patterns

The combination of **TypeScript monorepo**, **AWS serverless**, and **multi-model AI** creates a foundation that is:
- ✅ Easy to develop locally
- ✅ Simple to deploy (one command)
- ✅ Cheap to run (under $100/month for 1000s of users)
- ✅ Ready to scale (to millions of users with minimal changes)

---

**Document Maintenance**: This is a living document. Update as architecture evolves.

**Contributors**: Add your name when making significant architectural changes.

**Last Reviewed**: October 15, 2025
