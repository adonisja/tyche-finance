# Tyche Finance - Changelog

> Record of all notable changes to the Tyche Finance project.

**Format**: Based on [Keep a Changelog](https://keepachangelog.com/)  
**Versioning**: [Semantic Versioning](https://semver.org/)

---

## [0.5.0] - 2025-10-17

### Added - Budget & Spending Frontend Complete! 🎉

#### 🎨 Budget Setup Page (BudgetSetupPage.tsx - 593 lines)
- **Redesigned Layout**: Income and Expenses side-by-side, Visualization below
- **Income Breakdown Section**: 5 input fields (salary, bonuses, side income, investments, other)
- **Expenses Section**: 20 budget categories with visual progress bars (changed label from "Budget Categories" to "Expenses")
- **D3.js Pie Chart Visualization**: Full-width chart showing budget distribution with interactive legend
- **Month Selector**: Create/edit budgets for any month
- **Budget Overview Cards**: Total income, allocated, discretionary income display
- **Auto-Distribute Button**: Automatically allocate budget using default percentages
- **Form Validation**: Real-time calculation of discretionary income and allocation percentages
- **API Integration**: GET/POST/PUT /v1/budgets with authentication via fetchAuthSession()
- **Visual Design**: Color-coded borders (green for income, red for expenses), custom scrollbar for expenses
- **Responsive Design**: Stacks vertically on tablets and mobile devices
- **Route**: `/budget`

#### 💸 Spending Dashboard (SpendingDashboard.tsx - 731 lines)
- **Monthly Overview Cards**: Total income, total spent, budgeted amount, net income (color-coded)
- **Spending Insights**: Daily average, projected monthly, potential savings, transaction count
- **Category Progress Bars**: Visual comparison of budgeted vs actual spending with color coding
  - Green: Under budget
  - Yellow: Near budget (80-100%)
  - Red: Over budget with overflow animation
- **Overspending Alerts**: Warning banner listing categories over budget
- **Transaction List**: Complete list with category filtering and date sorting
- **Transaction Entry Form**: Full modal with dynamic fields
  - Income/Expense toggle with visual feedback (green/red gradient buttons)
  - **9 Income Categories**: salary, bonuses, side_income, freelance, investments, rental_income, refunds, gifts_received, other_income
  - **19 Expense Categories**: groceries, dining, transportation, utilities, housing, healthcare, insurance, entertainment, shopping, personal_care, education, childcare, pets, gifts, travel, subscriptions, debt_payments, savings, miscellaneous
  - Essential checkbox for expenses (needs vs wants)
  - Date picker, description, amount ($), notes
  - Form validation and error handling
  - Auto-refresh after successful submission
- **Month Selector**: View spending for any month with URL support
- **Empty State**: Helpful guidance when no budget or transactions exist
- **Routes**: `/spending` and `/spending/:month`

#### 🏠 Enhanced Main Dashboard (DashboardPage.tsx - 337 lines)
- **Quick Action Cards**: Budget Setup, Credit Cards, Spending Dashboard, AI Chat, Analytics
- **Budget Summary Integration**: Shows current month's budget overview if exists
- **Financial Overview**: Total cards, debt, credit, utilization
- **Recent Cards Preview**: Top 3 cards with utilization bars
- **AI Insights Banner**: Call-to-action for AI chat
- **Empty State Banner**: Guides new users to add cards or create budget
- **Navigation**: Dashboard | Cards | Budget | Spending | AI Chat | Analytics (consistent across all pages)

### Changed - UI/UX Improvements

#### Budget Setup Page Layout Redesign
- **Old Layout**: 2-column (Income+Expenses left, Visualization right)
- **New Layout**: Top row (Income left, Expenses right), Bottom row (Visualization full-width)
- **Benefits**: Better visual balance, natural comparison flow, larger chart, equal section prominence
- **Color Coding**: Green border for income section, red border for expenses section
- **Scrolling**: Expenses grid scrolls if >8 categories, income stays fixed
- **Label Update**: "Budget Categories" → "Expenses" (more intuitive)

#### Transaction Form Dynamic Behavior
- **Category Dropdown**: Changes based on Income/Expense selection
- **Income Mode**: Shows 9 income subcategories, hides "Essential" checkbox
- **Expense Mode**: Shows 19 expense categories, displays "Essential" checkbox
- **Smart Defaults**: Auto-selects "other_income" for income, "miscellaneous" for expenses
- **Button Text**: "💵 Add Income" (green) vs "💸 Add Expense" (red)

### Fixed
- **Authentication**: Changed from `user?.getIdToken()` to `fetchAuthSession()` across all pages
- **Budget Page Crash**: Added null-safe handling for `populateFormFromBudget(budget: MonthlyBudget | null)`
- **Navigation Consistency**: Added Budget and Spending links to all pages
- **Type Error**: Fixed `largestTransactions` type mismatch in budgets.ts handler
- **Category Validation**: Removed invalid categories (fitness, pet_care), kept valid 'pets'

### Documentation Added
- `BUDGET_SETUP_PAGE_IMPLEMENTATION.md` - Complete guide to Budget Setup page (520+ lines)
- `SPENDING_DASHBOARD_IMPLEMENTATION.md` - Complete guide to Spending Dashboard (400+ lines)
- `TRANSACTION_ENTRY_FEATURE.md` - Transaction form documentation (300+ lines)
- `INCOME_EXPENSE_CATEGORIES.md` - Category classification system (400+ lines)
- `BUDGET_UI_IMPROVEMENTS.md` - Layout redesign documentation (300+ lines)

### Technical
- **D3.js Installed**: 132 packages for visualization and statistical analysis
- **TypeScript**: 0 compilation errors across all new pages
- **CSS**: 1,700+ lines of responsive styles (BudgetSetup.css + SpendingDashboard.css)
- **Routes Added**: `/budget`, `/spending`, `/spending/:month`
- **API Integration**: All endpoints tested and working with proper authentication

---

## [0.4.0] - 2025-01-17

### Added
- **Budget & Spending Management Infrastructure** ✅
  - 4 new DynamoDB tables deployed:
    - `tyche-budgets` - Monthly budgets, categories, and recurring transactions
    - `tyche-transaction-details` - Spending/income transactions with categorization
    - `tyche-spending-analytics` - Pre-calculated insights and recommendations
    - `tyche-budget-goals` - Savings goals with milestone tracking
  - Lambda environment variables: BUDGETS_TABLE, TRANSACTION_DETAILS_TABLE, SPENDING_ANALYTICS_TABLE, BUDGET_GOALS_TABLE
  - IAM permissions for Lambda to access all new tables
  - Global Secondary Indexes (GSIs) for flexible querying
  - Point-in-time recovery enabled on budgets and transaction tables
  - Multi-tenant isolation via partition key design
- **Budget Type Definitions** (373 lines in packages/types/src/index.ts)
  - `BudgetCategoryType` - 21 standard budget categories
  - `BudgetCategory` - Category configuration with spending limits
  - `MonthlyBudget` - Monthly budget plan with income/expense tracking
  - `TransactionRecord` - Transaction details with categorization
  - `SpendingAnalytics` - Pre-calculated spending insights
  - `RecurringTransaction` - Recurring income/expense templates
  - `BudgetGoal` - Savings goals with progress tracking
- **Budget API Handlers** (850+ lines in services/api/src/handlers/budgets.ts) ✅
  - 15 new REST API endpoints for budget management
  - Monthly budget CRUD: Create, read, update, delete (archive) budgets
  - Category management: Create, update, delete budget categories
  - Transaction tracking: Create, update, delete transactions with filtering
  - Spending analytics: Auto-generate insights, category breakdowns, trends
  - Multi-tenant isolation with user-level authorization
  - Automatic calculation of `discretionaryIncome` and `availableForDebtPayoff`
- **API Routes** (services/api/src/index.ts)
  - GET/POST /v1/budgets - List and create budgets
  - GET/PUT/DELETE /v1/budgets/:month - Budget operations
  - GET/POST /v1/categories - Category management
  - PUT/DELETE /v1/categories/:id - Category updates
  - GET/POST /v1/transactions - Transaction list and creation
  - PUT/DELETE /v1/transactions/:id - Transaction updates
  - GET /v1/spending/analytics/:month - Get analytics
  - POST /v1/spending/analytics/:month/generate - Generate analytics
- **Documentation**
  - `BUDGET_SPENDING_SCHEMA.md` - Complete DynamoDB schema design (650+ lines)
  - `BUDGET_DEPLOYMENT_SUMMARY.md` - Deployment details and implementation roadmap
  - `BUDGET_API_REFERENCE.md` - Complete API documentation with examples (850+ lines)
  - `DEVELOPMENT_WORKFLOW.md` - Development best practices and documentation standards
- **Key Feature Enabler**: `availableForDebtPayoff` field in MonthlyBudget
  - AI can now access real budget data for personalized debt payoff recommendations
  - Foundation for truly personalized financial advice

### Technical Details
- Deployment time: 106 seconds (infrastructure), 34 seconds (API update)
- Total DynamoDB tables: 11 (7 core + 4 budget)
- Total API endpoints: 47 (32 existing + 15 budget)
- On-demand billing mode for auto-scaling
- AWS managed encryption for all tables
- GSI projection type: ALL (for flexible queries)

---

## [Unreleased]

### Added
- Cognito User Groups for role-based access control (Admins, DevTeam, Users)
- Post-Confirmation Lambda trigger to automatically add new users to "Users" group
- **Amazon SES email configuration** for Cognito
  - Dedicated email: `app.tyche.financial@gmail.com`
  - 50,000 emails/day limit (vs 50/day with Cognito default)
  - Better deliverability and professional branding
  - SES sending authorization policy for Cognito integration
  - SES configuration set for monitoring and compliance
- Password visibility toggles on SignUp and Login pages (👁️/🙈 emoji icons)
- Comprehensive migration guide (COGNITO_GROUPS_MIGRATION.md)
- Detailed deployment documentation (DEPLOYMENT_COMPLETE.md)
- HTTP API V2 migration documentation
- **SES_EMAIL_SETUP.md** - Complete SES configuration guide (500+ lines)
- **SES_PRODUCTION_ACCESS_REQUEST.md** - Template for requesting production access
- **SES_QUICK_REFERENCE.md** - Quick commands and troubleshooting
- Hooks barrel export (`hooks/index.ts`) for cleaner imports
- **CardsPage.tsx** - ✅ **COMPLETE** - Full credit card management interface (728 lines)
  - CREATE ✅: Add new credit cards with comprehensive validation
  - READ ✅: Display all cards with real-time data from DynamoDB
  - UPDATE ✅: Edit existing cards with inline editing
  - DELETE ✅: Remove cards with confirmation dialogs
  - **Inline editing**: Cards expand vertically to show edit form within themselves
  - **Auto-scroll**: View automatically centers on card being edited
  - **Recently-edited highlight**: Green border that fades over 3 seconds after save
  - **View All/Show Less toggle**: Display 6 cards by default, expand to all on click
  - Metrics dashboard (total cards, debt, credit, utilization)
  - Color-coded utilization bars (green/yellow/red)
  - Network icons (Visa, Mastercard, Amex, Discover)
  - Responsive grid layout with smooth animations
- **Cards.css** - Advanced styling with animations (748 lines)
  - Responsive card grid with auto-fill and grid isolation for editing
  - Inline edit form with slideDown animation
  - moveToTop animation for editing cards
  - highlightPulse and highlightFade animations for recently-edited state
  - View All/Show Less toggle button styling
  - Form validation states
  - Color-coded utilization indicators
  - Mobile-friendly layout with single breakpoint
- **index.css** - Complete design system (118 lines)
  - Tailwind CSS directives (@tailwind base/components/utilities)
  - 40+ HSL color design tokens (background, foreground, primary, etc.)
  - Light and dark theme support
  - Finance-specific tokens (gradient, shadows, success/warning/danger)
  - Smooth transitions and border radius tokens
  - Sidebar tokens for future use
- **tailwind.config.js** - Tailwind CSS configuration
  - Dark mode with class strategy
  - All design tokens mapped to Tailwind utilities
  - Custom gradients, shadows, and border radius
  - Content paths configured for Vite
- **postcss.config.js** - PostCSS configuration for Vite + Tailwind
- **useCreditCards hook** - Complete CRUD operations
  - fetchCards() - GET /v1/cards ✅
  - addCard() - POST /v1/cards ✅
  - updateCard() - PUT /v1/cards/:cardId ✅
  - deleteCard() - DELETE /v1/cards/:cardId ✅
  - Proper response parsing for nested API structure

### Changed
- **BREAKING (Internal)**: Authorization now uses `cognito:groups` instead of `custom:role`
  - Backwards compatible: Falls back to `custom:role` for existing users
  - All new users automatically assigned to "Users" group
- **Email Delivery**: Switched from `COGNITO_DEFAULT` to Amazon SES
  - Source: `app.tyche.financial@gmail.com`
  - Configured via AWS CLI (CDK has circular dependency with Post-Confirmation Lambda)
- **Amplify Configuration**: Switched from modular imports to full `aws-amplify` package
  - Fixes "UserPool not configured" errors
  - Moved configuration to `main.tsx` (runs before React app)
  - Added `loginWith.email` configuration for Amplify v6
- Migrated from REST API (V1) to HTTP API V2
  - 71% cost savings ($3.50 → $1.00 per million requests)
  - 60% performance improvement (100-150ms → 50-80ms latency)
- Lambda bundle size optimized with esbuild (100+ MB → 88.1 KB)
- Password requirements updated to: "At least 8 characters with uppercase, lowercase, and digit"
- **API Gateway CORS Configuration** - Split OPTIONS route from authenticated routes
  - OPTIONS `/v1/{proxy+}` - No JWT authorizer (allows CORS preflight)
  - GET/POST/PUT/DELETE `/v1/{proxy+}` - With JWT authorizer (requires auth)
  - Fixes: Browser preflight requests no longer blocked
- **Interest Rate UX** - Users enter percentage (19.99) instead of decimal (0.1999)
  - Form accepts percentage input
  - Converts to decimal for API/database storage
  - Converts back to percentage for display when editing
- **Form Input Strategy** - Changed to string-based inputs
  - Prevents leading zeros in number fields
  - Better validation control
  - Converts to proper types on submit
- **CardsPage.tsx** - Multiple critical fixes
  - Added React keys to all sibling elements (metrics, header, form rows) - eliminates warnings
  - Fixed response parsing: `response.data.cards` for GET, `response.data.card` for POST/PUT
  - Split CREATE/UPDATE logic: UPDATE now excludes immutable fields (name, network, lastFourDigits)
  - Improved UPDATE UX: Immutable fields shown as read-only display instead of disabled inputs
  - Fixed UPDATE crash: Lambda now returns full card object after update
- **Path Parameters** - Added manual extraction for HTTP API V2
  - HTTP API V2 doesn't auto-populate `event.pathParameters` like REST API V1
  - Router extracts cardId from `/v1/cards/card-abc123` before handler execution
  - Fixes DELETE operation "Missing cardId in path" error
- **Lambda Response Structure** - updateCard() returns full card object
  - Previously returned: `{ message, cardId, updatedFields }`
  - Now returns: `{ card: updatedCard }` (full object after retrieval from DynamoDB)
  - Prevents frontend crashes from undefined properties when recalculating metrics
- CDK bootstrap bucket missing (CloudFormation drift issue)
- Lambda ES module syntax error (switched to CommonJS)
- Lambda missing dependencies (implemented esbuild bundling)
- API Gateway event structure mismatch (V1 vs V2)
- CloudFormation resource type change error
- **Deprecated DynamoDB property**: Changed `pointInTimeRecovery` to `pointInTimeRecoverySpecification`
- **Email delivery issues**: 
  - Added SES sending authorization policy for Cognito
  - Re-enabled auto-verification on User Pool (was disabled during SES config)
  - Verified recipient email in SES (sandbox mode requirement)
- **Amplify configuration issues**:
  - Fixed "UserPool not configured" error with proper Amplify v6 config structure
  - Fixed TypeScript import errors with hooks barrel export
  - Moved Amplify.configure() to main.tsx before React renders
- **CORS blocking all API requests** (CRITICAL FIX)
  - Split `/v1/{proxy+}` into two separate routes in API Gateway
  - OPTIONS route without JWT authorizer (allows preflight)
  - GET/POST/PUT/DELETE routes with JWT authorizer (requires auth)
  - Result: CORS preflight now succeeds, actual requests still protected
- **Cards not displaying despite API success**
  - Fixed response parsing in useCreditCards hook
  - Changed from `data.cards` to `response.data.cards` extraction
  - API returns nested structure: `{ success: true, data: { cards: [...] } }`
  - Applied same fix to all CRUD operations (create, read, update, delete)
- **React key warnings** across multiple components
  - Added unique keys to all sibling elements
  - Fixed: Metrics grid, header elements, form rows, conditional sections
  - Result: Zero React warnings in console
- **Form UX issues**
  - Interest rate confusion (decimal vs percentage)
  - Leading zeros in number inputs
  - Statement date field removed (backend only needs dueDayOfMonth 1-28)
- **Path parameters not extracted in HTTP API V2** (DELETE/UPDATE fix)
  - HTTP API V2 doesn't auto-populate `event.pathParameters` like REST API V1
  - Added manual extraction in router for `/v1/cards/:cardId` paths
  - Extract `cardId` from URL string before handler execution
  - Result: DELETE and UPDATE operations now work correctly

### Infrastructure
- User Pool: `us-east-1_khi9CtS4e`
- Client ID: `49993ps4165cjqu161528up854`
- API URL: https://841dg6itk5.execute-api.us-east-1.amazonaws.com/
- 7 DynamoDB tables deployed
- S3 bucket: `tyche-uploads-586794453404`
- **SES Email**: `app.tyche.financial@gmail.com` (verified, sandbox mode)
- **SES Configuration Set**: `tyche-email-config` (for monitoring)
- **Test Email Verified**: `tyrellakkeem@gmail.com` (sandbox recipient)

---

## [0.1.0] - 2025-10-16

### Added - Initial Deployment

#### Backend Infrastructure
- AWS Cognito User Pool with email-based authentication
- 7 DynamoDB tables:
  - `tyche-users` - User profiles and preferences
  - `tyche-credit-cards` - Credit card accounts
  - `tyche-transactions` - Transaction history
  - `tyche-audit-logs` - Audit trail (90-day TTL)
  - `tyche-financial-snapshots` - Periodic financial metrics
  - `tyche-goals` - Financial goals
  - `tyche-user-analytics` - User behavior analytics
- S3 bucket for file uploads
- HTTP API V2 with JWT authorization
- Lambda function with 6 API handlers:
  - Health check (public)
  - Credit cards CRUD
  - AI chat with AgentKit
  - Payoff simulator
  - Analytics endpoints
  - Admin/dev tools

#### AI Integration
- Multi-provider AI support (Anthropic Claude, OpenAI GPT-4)
- 6 AgentKit tools:
  - `simulate_debt_payoff` - Calculate payoff strategies
  - `get_user_context` - Retrieve user financial data
  - `analyze_spending_patterns` - Identify spending insights
  - `recommend_balance_transfer` - Suggest optimal transfers
  - `optimize_payment_timing` - Best payment dates
  - `calculate_credit_impact` - Credit score predictions

#### Frontend (Partial)
- React 18.3 with TypeScript 5.6
- Vite 5.4 build system
- Pages completed:
  - Login page with Cognito integration
  - Sign-up page with email verification
  - Dashboard page (skeleton)
- Custom hooks:
  - `useAuth` - Authentication state management
  - `useAIChat` - AI conversation interface
  - `useCreditCards` - Card CRUD operations
  - `useAnalytics` - Analytics data fetching
- AWS Amplify Auth integration

#### Security Features
- PCI DSS compliant data storage (no full card numbers or CVV)
- JWT-based authentication with Cognito
- Multi-tenancy support with tenant isolation
- Audit logging for all admin/dev actions
- IAM role-based Lambda permissions

#### Development Tools
- TypeScript monorepo with npm workspaces
- AWS CDK for infrastructure as code
- esbuild for Lambda bundling
- Comprehensive documentation:
  - Architecture deep dive
  - Deployment guide
  - Developer guide
  - Learning resources
  - Bug tracking log

### Performance Metrics
- Lambda cold start: ~500ms
- Lambda bundle size: 88.1 KB
- API latency: 50-80ms (p50)
- Monthly cost (dev): ~$2
- Monthly cost (1M requests): ~$10

### Known Issues
- Frontend pages incomplete (Cards, Chat, Analytics need implementation)
- Authentication flow not tested end-to-end
- No automated tests yet
- Documentation needs examples and screenshots

---

## [0.0.1] - 2025-10-15

### Added - Project Setup
- Initial project structure with monorepo
- TypeScript configuration
- Package scaffolding
- Basic type definitions
- Security improvements (PCI DSS compliance)
- Credit card data model (secure, no sensitive data storage)

---

## Template for Future Entries

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing features

### Deprecated
- Features scheduled for removal

### Removed
- Features removed

### Fixed
- Bug fixes

### Security
- Security improvements
```

---

**Note**: This changelog is maintained manually. All notable changes should be documented here before release.
