# SES Email Setup - Quick Reference

**Date**: October 16, 2025  
**Status**: ✅ Configured, Pending Testing  

---

## What We Did

### 1. Created Dedicated Email Account
- **Email**: `app.tyche.financial@gmail.com`
- **Purpose**: Professional sender address for Cognito emails
- **Status**: ✅ Verified in Amazon SES

### 2. Verified Email in SES
```bash
aws ses verify-email-identity \
  --email-address app.tyche.financial@gmail.com \
  --region us-east-1 \
  --profile tyche-dev
```
- **Status**: ✅ "Success"

### 3. Created SES Sending Authorization Policy
```bash
aws ses put-identity-policy \
  --identity app.tyche.financial@gmail.com \
  --policy-name CognitoSendingPolicy \
  --policy '{...allows cognito-idp.amazonaws.com to send emails...}'
```
- **What it does**: Gives Cognito permission to send emails via SES
- **Status**: ✅ Created

### 4. Updated Cognito to Use SES
```bash
aws cognito-idp update-user-pool \
  --user-pool-id us-east-1_khi9CtS4e \
  --email-configuration "SourceArn=...,EmailSendingAccount=DEVELOPER,From=app.tyche.financial@gmail.com,..."
```
- **Changed from**: `COGNITO_DEFAULT` (50 emails/day)
- **Changed to**: `DEVELOPER` (SES - 50,000 emails/day)
- **Status**: ✅ Updated

---

## Current Configuration

```json
{
    "SourceArn": "arn:aws:ses:us-east-1:586794453404:identity/app.tyche.financial@gmail.com",
    "ReplyToEmailAddress": "app.tyche.financial@gmail.com",
    "EmailSendingAccount": "DEVELOPER",
    "From": "app.tyche.financial@gmail.com"
}
```

---

## Why Emails Might Not Be Delivered

### Sandbox Mode Limitation ⚠️
SES is currently in **SANDBOX MODE**, which means:
- ✅ Can send 50,000 emails per day
- ⚠️ **Can ONLY send TO verified email addresses**
- ⚠️ Maximum rate: 1 email/second

### Solution: Verify Recipient Email

**If testing with `tyrellakkeem@gmail.com`**:
```bash
# Verify your personal email in SES
aws ses verify-email-identity \
  --email-address tyrellakkeem@gmail.com \
  --region us-east-1 \
  --profile tyche-dev

# Check your email and click verification link

# Verify it's confirmed
aws ses get-identity-verification-attributes \
  --identities tyrellakkeem@gmail.com \
  --region us-east-1 \
  --profile tyche-dev
```

**After verification**, try signing up again - you should receive the email!

---

## Alternative: Admin Confirm User

If you just want to test the app without waiting for email:

```bash
# 1. Sign up user in frontend (will be UNCONFIRMED)

# 2. Admin confirm them manually
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id us-east-1_khi9CtS4e \
  --username tyrellakkeem@gmail.com \
  --region us-east-1 \
  --profile tyche-dev

# 3. Login immediately (no email needed)
```

---

## Moving to Production

**When ready to send to ANY email** (not just verified ones):

1. **Request SES Production Access**:
   - Go to: https://console.aws.amazon.com/ses/
   - Click "Request production access"
   - Fill out use case: "Tyche Finance - user verification emails"
   - Approval time: 24-48 hours

2. **Benefits**:
   - ✅ Send to ANY email address
   - ✅ Higher sending rates (14+ emails/second)
   - ✅ Better reputation management

---

## Testing Checklist

- [x] Email identity verified (`app.tyche.financial@gmail.com`)
- [x] SES sending policy created
- [x] Cognito updated to use SES
- [ ] **NEXT**: Verify recipient email in SES (if in sandbox)
- [ ] Test signup flow
- [ ] Confirm email received
- [ ] Test verification code
- [ ] Verify auto-assignment to "Users" group

---

## Quick Commands

```bash
# Check if email verified
aws ses get-identity-verification-attributes \
  --identities app.tyche.financial@gmail.com \
  --region us-east-1 \
  --profile tyche-dev

# Check SES quota
aws ses get-send-quota --region us-east-1 --profile tyche-dev

# List verified identities
aws ses list-identities --region us-east-1 --profile tyche-dev

# Admin confirm user (bypass email)
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id us-east-1_khi9CtS4e \
  --username tyrellakkeem@gmail.com \
  --region us-east-1 \
  --profile tyche-dev
```

---

## Full Documentation

See **[SES_EMAIL_SETUP.md](./SES_EMAIL_SETUP.md)** for complete guide including:
- Detailed setup steps
- Troubleshooting
- Best practices
- Cost breakdown
- Monitoring & metrics
- Production readiness checklist
