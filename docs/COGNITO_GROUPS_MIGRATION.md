# Cognito User Groups Migration Guide

> Complete guide for migrating from custom attributes to Cognito User Groups for role-based access control (RBAC).

**Date**: October 16, 2025  
**Status**: ✅ Infrastructure updated, ready to deploy  
**Migration Type**: Non-breaking (backwards compatible)

---

## Table of Contents

1. [Overview](#overview)
2. [What Changed](#what-changed)
3. [Benefits](#benefits)
4. [Infrastructure Changes](#infrastructure-changes)
5. [Code Changes](#code-changes)
6. [Deployment Steps](#deployment-steps)
7. [User Migration Process](#user-migration-process)
8. [Testing](#testing)
9. [Rollback Plan](#rollback-plan)

---

## Overview

### Previous Approach (Custom Attributes)
- Used `custom:role` attribute in Cognito
- Required manual updates via AWS CLI or SDK
- Not visible in Cognito console groups UI
- Authorization logic entirely in application code

### New Approach (Cognito Groups)
- Use built-in Cognito Groups: `Admins`, `DevTeam`, `Users`
- Groups automatically included in JWT token
- Easier user management in AWS Console
- Industry-standard approach

### Migration Strategy
**Non-breaking migration** with backwards compatibility:
1. ✅ Create Cognito Groups in CDK
2. ✅ Update authorization middleware to check both groups and custom attributes
3. ⏳ Add new users to appropriate groups
4. ⏳ Migrate existing users from custom attributes to groups
5. ⏳ Remove fallback to custom attributes after migration complete

---

## What Changed

### Added Resources

**3 Cognito Groups**:
- `Admins` - Full system access (precedence: 1)
- `DevTeam` - Analytics and debugging (precedence: 2)
- `Users` - Standard user access (precedence: 3)

**Post-Confirmation Lambda**:
- Automatically adds new users to "Users" group after email confirmation
- Uses AWS SDK v3 (`@aws-sdk/client-cognito-identity-provider`)
- Fails gracefully if group assignment fails (user can be added manually)

### Modified Code

**1. Infrastructure** (`infrastructure/lib/tyche-stack.ts`):
- Added 3 `CfnUserPoolGroup` resources
- Kept `custom:role` attribute for backwards compatibility

**2. Authorization Middleware** (`services/api/src/middleware/authorize.ts`):
- Primary: Check `cognito:groups` claim
- Fallback: Check `custom:role` attribute (for existing users)
- Added `groups` field to `AuthContext`

**3. TypeScript Types** (`packages/types/src/index.ts`):
- Added `groups?: string[]` to `AuthContext` interface

---

## Benefits

### Operational Benefits

| Aspect | Before (Custom Attrs) | After (Groups) |
|--------|---------------------|----------------|
| **User Management** | AWS CLI only | AWS Console UI ✅ |
| **JWT Size** | Minimal | +50 bytes (negligible) |
| **Authorization Speed** | Same | Same |
| **Auditability** | Manual tracking | CloudTrail logs ✅ |
| **Standards Compliance** | Custom | Industry standard ✅ |

### Developer Benefits

✅ **Easier Debugging**: Groups visible in Cognito console  
✅ **Simpler Onboarding**: Standard AWS pattern  
✅ **Better Testing**: Can easily create test users in groups  
✅ **Future-Proof**: Compatible with Cognito advanced features  

### Cost Impact

**No additional cost!** Cognito Groups are included in the base Cognito pricing.

---

## Infrastructure Changes

### CDK Stack Updates

**File**: `infrastructure/lib/tyche-stack.ts`

```typescript
// ADDED: Admin Group
const adminGroup = new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
  userPoolId: userPool.userPoolId,
  groupName: 'Admins',
  description: 'Administrators with full system access',
  precedence: 1, // Highest priority
});

// ADDED: Dev Team Group
const devGroup = new cognito.CfnUserPoolGroup(this, 'DevGroup', {
  userPoolId: userPool.userPoolId,
  groupName: 'DevTeam',
  description: 'Developers with access to metrics and analytics',
  precedence: 2,
});

// ADDED: Users Group
const userGroup = new cognito.CfnUserPoolGroup(this, 'UserGroup', {
  userPoolId: userPool.userPoolId,
  groupName: 'Users',
  description: 'Standard users with access to their own data',
  precedence: 3,
});
```

**Kept for backwards compatibility**:
```typescript
customAttributes: {
  tenantId: new cognito.StringAttribute({ mutable: false }),
  role: new cognito.StringAttribute({ mutable: true }), // KEPT
  permissions: new cognito.StringAttribute({ mutable: true }),
}
```

---

## Code Changes

### Authorization Middleware

**File**: `services/api/src/middleware/authorize.ts`

**Before**:
```typescript
const role = (claims['custom:role'] || 'user') as UserRole;
```

**After (with fallback)**:
```typescript
// Primary: Check Cognito Groups
const groups = (claims['cognito:groups'] as string[]) || [];
let role: UserRole = 'user';

if (groups.includes('Admins')) {
  role = 'admin';
} else if (groups.includes('DevTeam')) {
  role = 'dev';
} else if (groups.includes('Users')) {
  role = 'user';
} else {
  // Fallback to custom attribute (backwards compatibility)
  role = (claims['custom:role'] || 'user') as UserRole;
}
```

### JWT Token Changes

**Before**:
```json
{
  "sub": "user-123",
  "email": "user@example.com",
  "custom:role": "admin",
  "custom:tenantId": "tenant-456",
  "custom:permissions": "export_data,manage_users"
}
```

**After**:
```json
{
  "sub": "user-123",
  "email": "user@example.com",
  "cognito:groups": ["Admins"],  // NEW!
  "custom:role": "admin",        // KEPT for backwards compatibility
  "custom:tenantId": "tenant-456",
  "custom:permissions": "export_data,manage_users"
}
```

**Token size impact**: ~50 bytes increase (negligible)

---

## Deployment Steps

### 1. Deploy Infrastructure Changes

```bash
cd infrastructure
npm run build
cdk diff  # Preview changes
cdk deploy  # Deploy groups
```

**Expected output**:
```
✅ TycheStack (deployed)

Resources
[+] AWS::Cognito::CfnUserPoolGroup AdminGroup
[+] AWS::Cognito::CfnUserPoolGroup DevGroup
[+] AWS::Cognito::CfnUserPoolGroup UserGroup
[+] AWS::Lambda::Function PostConfirmationLambda
[~] AWS::Cognito::UserPool TycheUserPool (trigger added)
```

### 2. Deploy Lambda Code Changes

```bash
cd services/api
npm run build
cd ../../infrastructure
cdk deploy  # Redeploy Lambda with updated code
```

### 3. Verify Groups Created

```bash
aws cognito-idp list-groups \
  --user-pool-id us-east-1_khi9CtS4e \
  --region us-east-1
```

**Expected output**:
```json
{
  "Groups": [
    {
      "GroupName": "Admins",
      "Description": "Administrators with full system access",
      "Precedence": 1
    },
    {
      "GroupName": "DevTeam",
      "Description": "Developers with access to metrics and analytics",
      "Precedence": 2
    },
    {
      "GroupName": "Users",
      "Description": "Standard users with access to their own data",
      "Precedence": 3
    }
  ]
}
```

---

## User Migration Process

### For New Users (Sign Up After Deployment)

✅ **Automatic!** New users are automatically added to the "Users" group by a Post-Confirmation Lambda trigger.

**What happens:**
1. User signs up → receives confirmation email
2. User confirms email → triggers `PostConfirmationLambda`
3. Lambda adds user to "Users" group automatically
4. User can now login with `cognito:groups: ["Users"]` in JWT

**Manual promotion to Admin/DevTeam:**

If you need to give a user higher privileges:

**Option 1: AWS Console**
1. Go to Cognito → User Pools → `us-east-1_khi9CtS4e`
2. Click **Users** tab
3. Select user
4. Click **Add to group**
5. Select `Admins` or `DevTeam`

**Option 2: AWS CLI**
```bash
# Promote user to Admins
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_khi9CtS4e \
  --username admin@example.com \
  --group-name Admins \
  --region us-east-1

# User can be in multiple groups - highest precedence wins
# Admins (precedence 1) > DevTeam (2) > Users (3)
```

### For Existing Users (Migration Script)

If you have existing users with `custom:role` attribute:

```bash
#!/bin/bash
# migrate-users-to-groups.sh

USER_POOL_ID="us-east-1_khi9CtS4e"
REGION="us-east-1"

# Get all users
aws cognito-idp list-users \
  --user-pool-id $USER_POOL_ID \
  --region $REGION \
  --query 'Users[*].[Username, Attributes]' \
  --output json > users.json

# Parse and migrate (requires jq)
cat users.json | jq -r '.[] | 
  select(.[1] | map(select(.Name == "custom:role")) | length > 0) | 
  [.[0], (.[1] | map(select(.Name == "custom:role"))[0].Value)] | 
  @tsv' | while IFS=$'\t' read -r username role; do
  
  case $role in
    admin)
      GROUP="Admins"
      ;;
    dev)
      GROUP="DevTeam"
      ;;
    *)
      GROUP="Users"
      ;;
  esac
  
  echo "Migrating $username to $GROUP..."
  aws cognito-idp admin-add-user-to-group \
    --user-pool-id $USER_POOL_ID \
    --username "$username" \
    --group-name "$GROUP" \
    --region $REGION
done

echo "Migration complete!"
```

### Verification

```bash
# Check user's groups
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id us-east-1_khi9CtS4e \
  --username user@example.com \
  --region us-east-1
```

---

## Testing

### 1. Test New User with Group

```bash
# Create test user
aws cognito-idp admin-create-user \
  --user-pool-id us-east-1_khi9CtS4e \
  --username testuser@example.com \
  --user-attributes Name=email,Value=testuser@example.com \
  --temporary-password "TempPass123!" \
  --region us-east-1

# Add to Users group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_khi9CtS4e \
  --username testuser@example.com \
  --group-name Users \
  --region us-east-1

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id us-east-1_khi9CtS4e \
  --username testuser@example.com \
  --password "SecurePass123!" \
  --permanent \
  --region us-east-1
```

### 2. Test JWT Token Contains Groups

Login and decode JWT token:

```bash
# Use your frontend or Postman to get JWT token
# Decode at https://jwt.io or use:
echo "YOUR_JWT_TOKEN" | jq -R 'split(".") | .[1] | @base64d | fromjson'
```

**Expected claims**:
```json
{
  "cognito:groups": ["Users"],
  "email": "testuser@example.com",
  // ... other claims
}
```

### 3. Test Authorization

```bash
# Test protected endpoint
curl -X GET \
  https://841dg6itk5.execute-api.us-east-1.amazonaws.com/v1/cards \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected**: 
- ✅ Users in `Users` group: Access to own cards
- ✅ Users in `Admins` group: Access to all cards
- ❌ Users not in any group: Fallback to `custom:role` (or default to 'user')

---

## Rollback Plan

If issues arise, rollback is simple because we kept backwards compatibility:

### Option 1: Keep Groups, Remove Fallback
Remove the fallback code after verifying all users migrated:

```typescript
// Remove this fallback section:
} else {
  role = (claims['custom:role'] || 'user') as UserRole;
}
```

### Option 2: Full Rollback (Delete Groups)
If you need to completely rollback:

```bash
# Delete groups via CDK
# 1. Comment out group creation in tyche-stack.ts
# 2. Revert authorize.ts changes
# 3. Deploy

cd infrastructure
cdk deploy
```

**Note**: Users will not lose access since we still check `custom:role`.

---

## Next Steps

### Immediate (After Deployment)

1. ✅ Deploy CDK stack with groups
2. ✅ Deploy Lambda with updated authorization
3. ⏳ Add test user to each group
4. ⏳ Verify JWT tokens contain `cognito:groups`
5. ⏳ Test authorization with each role

### Short-term (Next 7 days)

1. ⏳ Create migration script for existing users
2. ⏳ Run migration script
3. ⏳ Verify all users have correct groups
4. ⏳ Monitor CloudWatch logs for any fallback usage

### Long-term (After 30 days)

1. ⏳ Remove `custom:role` fallback code
2. ⏳ Consider removing `custom:role` attribute (optional)
3. ⏳ Update documentation to reflect groups-only approach

---

## FAQs

### Q: Will existing users lose access during migration?

**A**: No! The migration is backwards compatible. Users without groups will fallback to their `custom:role` attribute.

### Q: What happens if a user is in multiple groups?

**A**: The highest priority group wins (Admins=1, DevTeam=2, Users=3). Lower number = higher priority.

### Q: Can I assign custom IAM roles to groups?

**A**: Yes! You can attach IAM roles to Cognito groups for AWS resource access:

```typescript
const adminRole = new iam.Role(this, 'AdminRole', {
  assumedBy: new iam.FederatedPrincipal(
    'cognito-identity.amazonaws.com',
    {
      'StringEquals': {
        'cognito-identity.amazonaws.com:aud': identityPool.ref
      }
    },
    'sts:AssumeRoleWithWebIdentity'
  )
});

adminGroup.roleArn = adminRole.roleArn;
```

### Q: Should I remove the `custom:role` attribute?

**A**: Not yet! Keep it for:
1. Backwards compatibility during migration
2. Debugging (can compare group vs custom role)
3. Future flexibility (e.g., temporary role overrides)

Remove it only after all users are migrated and system is stable (30+ days).

### Q: How do I automate adding new users to the Users group?

**A**: ✅ **Already implemented!** A Post-Confirmation Lambda trigger automatically adds new users to the "Users" group after they confirm their email.

**How it works:**
1. User signs up and confirms email
2. Cognito triggers `PostConfirmationLambda`
3. Lambda adds user to "Users" group
4. User's next JWT token includes `cognito:groups: ["Users"]`

**Verification:**
```bash
# Check user's groups after signup
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id us-east-1_khi9CtS4e \
  --username user@example.com \
  --region us-east-1
```

**To promote a user to Admin or DevTeam:**
```bash
# Remove from Users group (optional)
aws cognito-idp admin-remove-user-from-group \
  --user-pool-id us-east-1_khi9CtS4e \
  --username user@example.com \
  --group-name Users \
  --region us-east-1

# Add to Admins group
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_khi9CtS4e \
  --username user@example.com \
  --group-name Admins \
  --region us-east-1
```

---

## Documentation Status

- [x] Infrastructure updated
- [x] Code updated
- [x] Migration guide created
- [ ] Deployed to production
- [ ] Users migrated
- [ ] Fallback code removed

**Last Updated**: October 16, 2025  
**Next Review**: After first production deployment
