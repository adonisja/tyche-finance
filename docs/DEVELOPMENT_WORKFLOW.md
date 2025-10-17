# Development Workflow & Best Practices

**Created:** January 17, 2025  
**Purpose:** Standard procedures for development, documentation, and task completion

---

## Todo List Management

### ✅ When Marking a Todo as Complete

**ALWAYS update the following documentation files:**

1. **README.md** - Update feature list, deployment status, or getting started guide
2. **CHANGELOG.md** - Add entry describing what was completed and when
3. **Feature-specific docs** - Update relevant technical documentation:
   - Implementation guides
   - API documentation
   - Architecture diagrams
   - Schema definitions

### Documentation Update Checklist

Before marking a todo as complete, verify:

- [ ] README.md updated (if user-facing feature)
- [ ] CHANGELOG.md has new entry
- [ ] Technical docs updated (implementation details, schemas, etc.)
- [ ] Code comments added for complex logic
- [ ] Examples/usage added to docs
- [ ] Related files cross-referenced

### Example: Completing "Deploy Budget Tables" Todo

**Steps:**
1. ✅ Deploy infrastructure (tables created)
2. ✅ Verify deployment (tables ACTIVE)
3. 📝 Update **CHANGELOG.md**:
   ```markdown
   ## [0.4.0] - 2025-01-17
   ### Added
   - 4 new DynamoDB tables for budget/spending management
   - Budget schema documentation
   - TypeScript types for budgets, transactions, analytics
   ```
4. 📝 Create **BUDGET_DEPLOYMENT_SUMMARY.md** (deployment details)
5. 📝 Update **README.md** (add budget features to roadmap)
6. ✅ Mark todo as complete

---

## Documentation Standards

### When to Create New Documentation

**Create new doc files for:**
- Major feature implementations (e.g., `CARDS_PAGE_IMPLEMENTATION.md`)
- Complex technical designs (e.g., `BUDGET_SPENDING_SCHEMA.md`)
- Deployment summaries (e.g., `BUDGET_DEPLOYMENT_SUMMARY.md`)
- Integration guides (e.g., `AGENTKIT_INTEGRATION.md`)
- Testing procedures (e.g., `AUTH_TESTING_GUIDE.md`)

**Update existing docs for:**
- Minor feature additions
- Bug fixes
- Configuration changes
- Performance improvements

### Documentation File Naming

**Format:** `[FEATURE]_[TYPE].md`

**Examples:**
- `CARDS_PAGE_IMPLEMENTATION.md` - Implementation details
- `BUDGET_SPENDING_SCHEMA.md` - Database schema
- `AWS_SETUP_GUIDE.md` - Setup instructions
- `AUTH_TESTING_GUIDE.md` - Testing procedures
- `DEPLOYMENT_GUIDE.md` - Deployment steps

### Documentation Structure

**Every documentation file should include:**

```markdown
# Title

**Created:** YYYY-MM-DD
**Status:** [Design Phase | In Development | Completed | Archived]
**Related:** [Links to related docs]

## Overview
Brief description of the feature/system

## [Relevant Sections]
- Architecture
- Implementation
- API Reference
- Examples
- Testing
- Troubleshooting

## Related Documentation
- [Other docs this references]
```

---

## CHANGELOG.md Standards

### Format

```markdown
## [Version] - YYYY-MM-DD

### Added
- New features, endpoints, pages

### Changed
- Modifications to existing features

### Fixed
- Bug fixes, error corrections

### Removed
- Deprecated features

### Security
- Security-related changes
```

### When to Add CHANGELOG Entries

**ALWAYS for:**
- New features (pages, API endpoints, UI components)
- Infrastructure changes (new tables, services, deployments)
- Breaking changes (API changes, schema migrations)
- Major bug fixes

**Optional for:**
- Minor styling tweaks
- Documentation-only changes
- Refactoring (if no user impact)

---

## README.md Maintenance

### Sections to Update

1. **Features List** - Add new features as they're completed
2. **Getting Started** - Update setup steps if changed
3. **Deployment Status** - Mark features as deployed/in-progress
4. **Tech Stack** - Add new libraries or services
5. **API Endpoints** - Update endpoint list

### Feature Status Indicators

Use emoji to show status:
- ✅ Complete and deployed
- 🚧 In development
- 📋 Planned
- ❌ Deprecated/removed

---

## Git Commit Messages

### Format

```
<type>(<scope>): <description>

[optional body]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks (deps, config, etc.)
- `deploy`: Deployment-related changes

### Examples

```bash
feat(budget): add DynamoDB tables for budget tracking

- Created tyche-budgets table
- Created tyche-transaction-details table
- Updated Lambda permissions
- Added environment variables
```

```bash
docs(budget): add schema and deployment documentation

- Created BUDGET_SPENDING_SCHEMA.md
- Created BUDGET_DEPLOYMENT_SUMMARY.md
- Updated CHANGELOG.md
```

---

## Code Review Checklist

Before marking work as complete:

### Functionality
- [ ] Feature works as expected
- [ ] Edge cases handled
- [ ] Error handling implemented
- [ ] Loading states added (UI)

### Code Quality
- [ ] No console.log statements in production code
- [ ] TypeScript types defined (no `any`)
- [ ] Functions have clear names and single responsibility
- [ ] Complex logic has comments

### Testing
- [ ] Manual testing completed
- [ ] API endpoints tested (Postman/curl)
- [ ] UI tested in multiple browsers
- [ ] Mobile responsive (if UI)

### Documentation
- [ ] README.md updated ✅ **REQUIRED**
- [ ] CHANGELOG.md updated ✅ **REQUIRED**
- [ ] Technical docs updated ✅ **REQUIRED**
- [ ] Code comments added
- [ ] Examples provided

### Deployment
- [ ] Environment variables configured
- [ ] CDK stack updated (if infrastructure)
- [ ] Frontend built without errors
- [ ] Backend deployed successfully

---

## Feature Development Workflow

### Standard Process

1. **Planning Phase**
   - Create feature branch: `git checkout -b feature/budget-setup`
   - Update todo list with specific tasks
   - Review related documentation

2. **Implementation Phase**
   - Write code (types → API → UI)
   - Add tests as you go
   - Commit frequently with clear messages

3. **Testing Phase**
   - Manual testing (happy path + edge cases)
   - API testing (Postman)
   - UI testing (browser + mobile)
   - Fix bugs found

4. **Documentation Phase** ✅ **CRITICAL**
   - Update CHANGELOG.md
   - Update README.md
   - Create/update technical docs
   - Add code comments

5. **Completion Phase**
   - Final review (code quality + docs)
   - Merge to main: `git merge feature/budget-setup`
   - Mark todo as complete
   - Deploy if needed

---

## When Completing Major Features

**Example: Budget Management Feature**

### 1. Code Completion
- ✅ Types defined
- ✅ DynamoDB tables deployed
- ✅ API handlers implemented
- ✅ UI pages built
- ✅ Testing complete

### 2. Documentation Requirements

**Must Update:**
1. **CHANGELOG.md** - New feature entry
   ```markdown
   ## [0.4.0] - 2025-01-17
   ### Added
   - Budget management system with monthly budgets
   - Transaction tracking with auto-categorization
   - Spending analytics dashboard
   - 4 new DynamoDB tables
   - Budget API handlers (12 endpoints)
   - Budget Setup and Spending Dashboard pages
   ```

2. **README.md** - Update features section
   ```markdown
   ### Budget & Spending Management ✅
   - Monthly budget creation with income/expense tracking
   - Transaction categorization (21 standard categories)
   - Spending analytics with visualizations
   - Budget goals with milestone tracking
   ```

3. **Create Feature Docs:**
   - `BUDGET_SPENDING_SCHEMA.md` - Database design
   - `BUDGET_API_REFERENCE.md` - API endpoints and examples
   - `BUDGET_USER_GUIDE.md` - How to use the feature
   - `BUDGET_DEPLOYMENT_SUMMARY.md` - Deployment details

4. **Update Existing Docs:**
   - `ARCHITECTURE.md` - Add budget system to architecture diagram
   - `DEPLOYMENT_GUIDE.md` - Add budget tables to deployment steps
   - `DEVELOPER_GUIDE.md` - Add budget development notes

### 3. Verification
- [ ] All documentation is accurate and up-to-date
- [ ] Cross-references between docs are correct
- [ ] Examples in docs actually work
- [ ] No broken links

---

## Documentation Templates

### Feature Implementation Doc Template

```markdown
# [Feature Name] - Implementation Guide

**Created:** YYYY-MM-DD
**Status:** [Design Phase | In Development | Completed]
**Related:** [Links to related docs]

## Overview
Brief description of what this feature does and why it exists.

## Architecture
- Components involved
- Data flow
- Dependencies

## Implementation Details

### Backend
- API endpoints
- Database schema
- Business logic

### Frontend
- Pages/components
- State management
- User interactions

## API Reference
Endpoint documentation with examples

## Testing
How to test this feature

## Deployment
Deployment steps and verification

## Troubleshooting
Common issues and solutions

## Future Enhancements
Planned improvements
```

### Deployment Summary Template

```markdown
# [Feature] - Deployment Summary

**Deployed:** YYYY-MM-DD
**Status:** ✅ Complete
**Next Steps:** [What's next]

## Deployment Overview
What was deployed and why

## Changes Made
- Infrastructure changes
- Code changes
- Configuration changes

## Verification
How to verify deployment was successful

## Rollback Procedure
How to rollback if needed

## Monitoring
What to monitor post-deployment

## Known Issues
Any known issues or limitations

## Next Steps
What to do next
```

---

## Quick Reference

### Before Marking Todo Complete

1. ✅ Feature works correctly
2. 📝 CHANGELOG.md updated
3. 📝 README.md updated
4. 📝 Technical docs created/updated
5. 🧪 Testing complete
6. 🚀 Deployed (if needed)

### Documentation Files to Check

**Always Update:**
- `README.md` - User-facing features
- `CHANGELOG.md` - All completions

**Update When Relevant:**
- `ARCHITECTURE.md` - New systems/services
- `DEPLOYMENT_GUIDE.md` - Infrastructure changes
- `DEVELOPER_GUIDE.md` - Development tips
- Feature-specific docs

---

## Enforcement

**This workflow is mandatory for:**
- Completing todos from the todo list
- Merging feature branches
- Creating releases
- Deploying to production

**AI Assistant Reminder:**
When marking a todo as complete, ALWAYS update documentation first, then update the todo list. Documentation is not optional - it's part of the completion criteria!

---

**Last Updated:** January 17, 2025  
**Next Review:** February 2025
