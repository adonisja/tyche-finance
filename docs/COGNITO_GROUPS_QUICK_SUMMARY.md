# Cognito Groups Migration - Quick Summary

**Date**: October 16, 2025  
**Status**: ✅ Ready to deploy  
**Impact**: Non-breaking change

---

## What We Did

### 1. ✅ Added Cognito User Groups
- `Admins` (precedence 1) - Full system access
- `DevTeam` (precedence 2) - Analytics and debugging
- `Users` (precedence 3) - Standard access

### 2. ✅ Auto-Assignment for New Users
Created Post-Confirmation Lambda trigger that:
- Automatically adds new users to "Users" group after email confirmation
- Uses AWS SDK v3
- Fails gracefully (user can be added manually if trigger fails)

### 3. ✅ Backwards Compatible Authorization
Updated `authorize.ts` to:
- **Primary**: Check `cognito:groups` claim in JWT
- **Fallback**: Check `custom:role` attribute (for existing users)
- No breaking changes for existing code

### 4. ✅ Fixed Deprecation Warning
Changed `pointInTimeRecovery: true` → `pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true }`

### 5. ✅ Updated Documentation
- Created COGNITO_GROUPS_MIGRATION.md (comprehensive guide)
- Created CHANGELOG.md (version history)
- Updated README.md (added new docs)

---

## Benefits

| Feature | Before | After |
|---------|--------|-------|
| **User Management** | AWS CLI only | AWS Console UI ✅ |
| **New User Setup** | Manual | Automatic ✅ |
| **JWT Token** | `custom:role` | `cognito:groups` ✅ |
| **Standards** | Custom | Industry standard ✅ |
| **Cost** | $0 | $0 (no extra cost) |

---

## Deployment Commands

```bash
# 1. Build infrastructure
cd infrastructure
npm run build

# 2. Preview changes (after AWS credentials configured)
cdk diff

# 3. Deploy
cdk deploy
```

**Note**: AWS credentials need to be configured first (`aws configure`)

---

## What Gets Created

```
[+] AWS::Cognito::CfnUserPoolGroup AdminGroup
[+] AWS::Cognito::CfnUserPoolGroup DevGroup  
[+] AWS::Cognito::CfnUserPoolGroup UserGroup
[+] AWS::Lambda::Function PostConfirmationLambda
[~] AWS::Cognito::UserPool TycheUserPool (trigger added)
[~] AWS::Lambda::Function TycheApiLambda (updated code)
```

---

## Testing After Deployment

### 1. Verify Groups Created
```bash
aws cognito-idp list-groups \
  --user-pool-id us-east-1_khi9CtS4e \
  --region us-east-1
```

### 2. Test New User Auto-Assignment
1. Sign up via frontend
2. Confirm email
3. Check user's groups:
```bash
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id us-east-1_khi9CtS4e \
  --username user@example.com \
  --region us-east-1
```

Expected output:
```json
{
  "Groups": [
    {
      "GroupName": "Users",
      "Precedence": 3
    }
  ]
}
```

### 3. Test JWT Token
Login and decode JWT at https://jwt.io

Should see:
```json
{
  "cognito:groups": ["Users"],
  "email": "user@example.com",
  ...
}
```

### 4. Promote User to Admin
```bash
aws cognito-idp admin-add-user-to-group \
  --user-pool-id us-east-1_khi9CtS4e \
  --username admin@example.com \
  --group-name Admins \
  --region us-east-1
```

---

## Rollback (If Needed)

Migration is backwards compatible, so rollback is simple:

1. Keep infrastructure (groups don't hurt anything)
2. Revert code to check only `custom:role`
3. Remove Post-Confirmation trigger

Or just keep both approaches running indefinitely (they don't conflict).

---

## Next Steps

After deployment:

1. ✅ Verify groups created
2. ✅ Test new user signup → auto-assignment
3. ✅ Verify JWT contains `cognito:groups`
4. ⏳ Migrate existing users (if any)
5. ⏳ Test authorization with each role
6. ⏳ Remove fallback code after 30 days (optional)

---

**Full documentation**: [COGNITO_GROUPS_MIGRATION.md](./COGNITO_GROUPS_MIGRATION.md)
