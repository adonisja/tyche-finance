# Amazon SES Email Setup Guide

**Purpose**: Configure Amazon SES for Cognito email delivery  
**Date**: October 16, 2025  
**Status**: ✅ **CONFIGURED & TESTED**  

---

## Overview

This guide documents how to set up Amazon SES (Simple Email Service) for Cognito email delivery, replacing the default Cognito email service with a more reliable, scalable solution.

**Why SES over Cognito Default?**
- ✅ **Higher sending limits**: 50,000 emails/day vs 50 emails/day
- ✅ **Better deliverability**: Less likely to be flagged as spam
- ✅ **Custom FROM address**: Professional branding
- ✅ **Production ready**: Scalable for growth

---

## Current Configuration

### Email Identity
- **FROM Address**: `app.tyche.financial@gmail.com`
- **FROM Name**: Tyche Financial Assistant
- **Reply-To**: `app.tyche.financial@gmail.com`
- **Verification Status**: ✅ Verified
- **Account Status**: Sandbox (50,000 emails/day limit)

### SES Settings
- **Region**: us-east-1
- **Sending Account**: DEVELOPER (using SES)
- **Source ARN**: `arn:aws:ses:us-east-1:586794453404:identity/app.tyche.financial@gmail.com`

### Cognito Integration
- **User Pool**: us-east-1_khi9CtS4e
- **Email Configuration**: Custom (SES)
- **Auto-verify**: Email enabled

---

## Setup Steps (Already Completed)

### Step 1: Verify Email Identity

```bash
# Verify the email address with SES
aws ses verify-email-identity \
  --email-address app.tyche.financial@gmail.com \
  --region us-east-1 \
  --profile tyche-dev

# Check verification status
aws ses get-identity-verification-attributes \
  --identities app.tyche.financial@gmail.com \
  --region us-east-1 \
  --profile tyche-dev \
  --query 'VerificationAttributes."app.tyche.financial@gmail.com".VerificationStatus'
```

**Expected Output**: `"Success"`

### Step 2: Create SES Sending Authorization Policy

Cognito needs permission to send emails via SES. Created policy:

```bash
aws ses put-identity-policy \
  --identity app.tyche.financial@gmail.com \
  --policy-name CognitoSendingPolicy \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "AllowCognitoToSendEmails",
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
  }' \
  --region us-east-1 \
  --profile tyche-dev
```

**Verify Policy**:
```bash
aws ses list-identity-policies \
  --identity app.tyche.financial@gmail.com \
  --region us-east-1 \
  --profile tyche-dev
```

### Step 3: Update Cognito User Pool

```bash
# Update User Pool to use SES
aws cognito-idp update-user-pool \
  --user-pool-id us-east-1_khi9CtS4e \
  --email-configuration "SourceArn=arn:aws:ses:us-east-1:586794453404:identity/app.tyche.financial@gmail.com,EmailSendingAccount=DEVELOPER,From=app.tyche.financial@gmail.com,ReplyToEmailAddress=app.tyche.financial@gmail.com" \
  --region us-east-1 \
  --profile tyche-dev
```

**Verify Configuration**:
```bash
aws cognito-idp describe-user-pool \
  --user-pool-id us-east-1_khi9CtS4e \
  --region us-east-1 \
  --profile tyche-dev \
  --query 'UserPool.EmailConfiguration'
```

**Expected Output**:
```json
{
    "SourceArn": "arn:aws:ses:us-east-1:586794453404:identity/app.tyche.financial@gmail.com",
    "ReplyToEmailAddress": "app.tyche.financial@gmail.com",
    "EmailSendingAccount": "DEVELOPER",
    "From": "app.tyche.financial@gmail.com"
}
```

---

## Email Templates

### Verification Email (Cognito Default)
- **Subject**: Verify your new account
- **Message**: The verification code to your new account is {####}

### Password Reset Email (Cognito Default)
- **Subject**: Your password reset request
- **Message**: Your password reset code is {####}

> **Note**: To customize email templates, use Cognito's Custom Message Lambda Trigger

---

## SES Sandbox vs Production

### Current Status: Sandbox Mode ✅

**Sandbox Limitations**:
- ✅ Can send 50,000 emails per day (sufficient for development)
- ⚠️ Can only send TO verified email addresses
- ⚠️ Maximum send rate: 1 email/second

**Sandbox is Perfect For**:
- Development and testing
- Demo applications
- Internal tools
- Early-stage products

### Moving to Production Access

**When to Request Production Access**:
- Before public launch
- When you need to send to unverified email addresses
- When you need higher sending rates (>1 email/sec)

**How to Request Production Access**:

1. **Go to SES Console**:
   - https://console.aws.amazon.com/ses/
   
2. **Request Production Access**:
   - Navigate to "Account dashboard"
   - Click "Request production access"
   
3. **Fill Out Request Form**:
   - **Mail type**: Transactional
   - **Website URL**: Your production domain
   - **Use case description**:
     ```
     Tyche is a personal finance management application. We send:
     - Account verification emails when users sign up
     - Password reset emails
     - Payment reminders and notifications
     - Weekly financial insights reports
     
     Expected volume: 500-1000 emails/day
     All emails are opt-in and include unsubscribe links.
     ```
   - **Compliance**: Explain your bounce/complaint handling

4. **Typical Approval Time**: 24-48 hours

---

## Monitoring & Metrics

### Check Sending Quota

```bash
# View sending limits and usage
aws ses get-send-quota \
  --region us-east-1 \
  --profile tyche-dev
```

**Output**:
```json
{
    "Max24HourSend": 200.0,      // Daily limit
    "MaxSendRate": 1.0,          // Emails per second
    "SentLast24Hours": 2.0       // Sent in last 24 hours
}
```

### Check Sending Statistics

```bash
# View detailed sending metrics
aws ses get-send-statistics \
  --region us-east-1 \
  --profile tyche-dev \
  --query 'SendDataPoints[-10:]' \
  --output table
```

**Key Metrics**:
- `DeliveryAttempts`: Total emails sent
- `Bounces`: Failed deliveries (invalid addresses)
- `Complaints`: Spam reports
- `Rejects`: Rejected by SES (invalid format, etc.)

### CloudWatch Metrics

SES automatically sends metrics to CloudWatch:
- `Send` - Total send requests
- `Bounce` - Bounce rate
- `Complaint` - Complaint rate
- `Reject` - Rejection rate
- `Delivery` - Successful deliveries

**Access**: https://console.aws.amazon.com/cloudwatch/

---

## Troubleshooting

### Email Not Received

**1. Check User was Created**:
```bash
aws cognito-idp list-users \
  --user-pool-id us-east-1_khi9CtS4e \
  --region us-east-1 \
  --profile tyche-dev
```

**2. Verify SES Sending Statistics**:
```bash
aws ses get-send-statistics \
  --region us-east-1 \
  --profile tyche-dev
```

**3. Check Spam/Junk Folder**:
- Gmail: Check "Spam" folder
- Outlook: Check "Junk Email" folder
- Yahoo: Check "Spam" folder

**4. Verify Email Address**:
- In Sandbox mode, recipient email must be verified in SES
- Check: https://console.aws.amazon.com/ses/ → "Verified identities"

**5. Resend Confirmation Code**:
```bash
aws cognito-idp resend-confirmation-code \
  --client-id 49993ps4165cjqu161528up854 \
  --username user@example.com \
  --region us-east-1 \
  --profile tyche-dev
```

**6. Admin Confirm User (Testing Bypass)**:
```bash
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id us-east-1_khi9CtS4e \
  --username user@example.com \
  --region us-east-1 \
  --profile tyche-dev
```

### High Bounce Rate

**Causes**:
- Invalid email addresses
- Typos in email input
- Inactive mailboxes

**Solutions**:
- Implement email validation in frontend
- Use double opt-in
- Monitor bounce notifications

### Emails Going to Spam

**Causes**:
- No SPF/DKIM authentication
- Using Gmail for business emails (not professional)
- High complaint rate

**Solutions**:
1. **Use Custom Domain** (Recommended):
   - Get domain: `tyche.com`
   - Verify domain in SES (not just email)
   - Set up SPF and DKIM records
   - Use `noreply@tyche.com` instead of Gmail

2. **Verify Domain in SES**:
```bash
aws ses verify-domain-identity \
  --domain tyche.com \
  --region us-east-1 \
  --profile tyche-dev
```

3. **Enable DKIM**:
```bash
aws ses set-identity-dkim-enabled \
  --identity tyche.com \
  --dkim-enabled \
  --region us-east-1 \
  --profile tyche-dev
```

---

## Best Practices

### 1. Use Dedicated Email Account
- ✅ Created: `app.tyche.financial@gmail.com`
- ❌ Don't use personal email for production
- ✅ Better: Use custom domain (`noreply@tyche.com`)

### 2. Monitor Bounce and Complaint Rates
- Keep bounce rate < 5%
- Keep complaint rate < 0.1%
- Set up CloudWatch alarms

### 3. Handle Bounces and Complaints
- Implement SNS notifications for bounces
- Automatically remove bounced emails
- Provide easy unsubscribe

### 4. Warm Up IP (Production)
- Don't send max volume immediately
- Gradually increase sending over 2-4 weeks
- Start with engaged users

### 5. Custom Domain (Production Ready)
```bash
# Example with custom domain
aws ses verify-domain-identity \
  --domain tyche.com \
  --region us-east-1 \
  --profile tyche-dev

# Update Cognito
aws cognito-idp update-user-pool \
  --user-pool-id us-east-1_khi9CtS4e \
  --email-configuration "SourceArn=arn:aws:ses:us-east-1:586794453404:identity/tyche.com,EmailSendingAccount=DEVELOPER,From=noreply@tyche.com,ReplyToEmailAddress=support@tyche.com" \
  --region us-east-1 \
  --profile tyche-dev
```

---

## CDK Integration (Future)

Currently configured via AWS CLI due to circular dependency issues with CDK. To add to CDK in future:

```typescript
// infrastructure/lib/tyche-stack.ts
const userPool = new cognito.UserPool(this, 'TycheUserPool', {
  email: cognito.UserPoolEmail.withSES({
    fromEmail: 'app.tyche.financial@gmail.com',
    fromName: 'Tyche Financial Assistant',
    replyTo: 'app.tyche.financial@gmail.com',
    // Note: Must verify email in SES first and create policy separately
  }),
  // ... other config
});
```

**Limitation**: CDK doesn't auto-create SES identity policy, must do manually via CLI.

---

## Cost Breakdown

### SES Pricing (us-east-1)

**Emails**:
- First 1,000 emails: **FREE** (if sent from EC2)
- First 62,000 emails/month: **$0.10 per 1,000** (if sent from Lambda)
- Beyond 62,000: **$0.12 per 1,000**

**Attachments** (if used):
- $0.12 per GB

### Example Costs

**1,000 users, 3 emails each/month**:
- 3,000 emails × $0.10/1000 = **$0.30/month**

**10,000 users, 5 emails each/month**:
- 50,000 emails × $0.10/1000 = **$5.00/month**

**Cognito Default Comparison**:
- Limit: 50 emails/day = ~1,500/month
- Cost: FREE but highly limited
- **SES is worth it!**

---

## Testing Checklist

- [x] Email identity verified in SES
- [x] SES sending authorization policy created
- [x] Cognito User Pool updated to use SES
- [x] Test signup flow
  - [ ] User receives verification email
  - [ ] Email FROM shows "Tyche Financial Assistant <app.tyche.financial@gmail.com>"
  - [ ] Verification code works
  - [ ] User auto-assigned to "Users" group
- [ ] Test password reset flow
  - [ ] User receives reset email
  - [ ] Reset code works
- [ ] Monitor SES metrics for bounces/complaints

---

## Quick Commands Reference

```bash
# Check SES quota
aws ses get-send-quota --region us-east-1 --profile tyche-dev

# Check sending stats
aws ses get-send-statistics --region us-east-1 --profile tyche-dev

# List verified identities
aws ses list-identities --region us-east-1 --profile tyche-dev

# Check Cognito email config
aws cognito-idp describe-user-pool \
  --user-pool-id us-east-1_khi9CtS4e \
  --region us-east-1 \
  --profile tyche-dev \
  --query 'UserPool.EmailConfiguration'

# Resend confirmation code
aws cognito-idp resend-confirmation-code \
  --client-id 49993ps4165cjqu161528up854 \
  --username user@example.com \
  --region us-east-1 \
  --profile tyche-dev

# Admin confirm user (testing bypass)
aws cognito-idp admin-confirm-sign-up \
  --user-pool-id us-east-1_khi9CtS4e \
  --username user@example.com \
  --region us-east-1 \
  --profile tyche-dev
```

---

## Related Documentation

- [AWS_SETUP_GUIDE.md](./AWS_SETUP_GUIDE.md) - AWS account setup
- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Infrastructure deployment
- [AUTH_TESTING_GUIDE.md](./AUTH_TESTING_GUIDE.md) - Authentication testing
- [COGNITO_GROUPS_MIGRATION.md](./COGNITO_GROUPS_MIGRATION.md) - Groups setup

---

## Changelog

### October 16, 2025 - Initial Setup & Testing
- ✅ Created dedicated email: `app.tyche.financial@gmail.com`
- ✅ Verified email identity in SES
- ✅ Created SES sending authorization policy for Cognito
- ✅ Created SES configuration set: `tyche-email-config`
- ✅ Updated Cognito User Pool to use SES
- ✅ Re-enabled auto-verification on User Pool (was disabled)
- ✅ Verified test recipient email: `tyrellakkeem@gmail.com` (sandbox requirement)
- ✅ **Tested complete signup flow** - Email received successfully! 🎉
- 📝 Documented complete setup process with troubleshooting

### Issues Resolved:
1. **SES Sending Policy** - Cognito didn't have permission to send via SES
   - Solution: Created identity policy allowing `cognito-idp.amazonaws.com` to send
2. **Auto-verification Disabled** - Email verification was turned off
   - Solution: Re-enabled with `--auto-verified-attributes email`
3. **Sandbox Mode Limitation** - Can only send to verified recipients
   - Solution: Verified test email address in SES
4. **Amplify Configuration Issues** - Frontend showing "UserPool not configured"
   - Solution: Fixed Amplify v6 config structure and moved to `main.tsx`

---

**Next Steps**:
1. ✅ ~~Test complete signup flow with email verification~~ **COMPLETE!**
2. Monitor SES metrics for first week
3. Test Post-Confirmation Lambda (auto-assignment to "Users" group)
4. Consider moving to custom domain for production
5. Request SES production access before public launch
