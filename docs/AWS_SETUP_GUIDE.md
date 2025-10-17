# AWS Account Setup Guide

**Purpose**: Step-by-step instructions to set up AWS for Tyche deployment  
**Date**: October 15, 2025  
**Status**: Setup Guide  

---

## Overview

This guide will walk you through:
1. Creating an AWS account (if you don't have one)
2. Setting up an IAM user for deployments
3. Installing and configuring the AWS CLI
4. Setting required permissions
5. Verifying your setup

**Time Required**: 15-20 minutes  
**Cost**: Free tier covers development (first 12 months)

---

## Prerequisites

- Valid email address
- Credit/debit card (required by AWS, won't be charged during free tier)
- Phone number for verification

---

## Step 1: Create AWS Account

### If You Already Have an AWS Account
Skip to [Step 2: Create IAM User](#step-2-create-iam-user)

### If You Need to Create an Account

1. **Go to AWS Sign-Up**
   - Visit: https://aws.amazon.com
   - Click "Create an AWS Account" (orange button, top right)

2. **Enter Account Details**
   ```
   Root user email: your-email@example.com
   AWS account name: Tyche Finance (or your preferred name)
   ```
   - Click "Verify email address"
   - Check your email for verification code
   - Enter the code

3. **Create Password**
   ```
   Password requirements:
   - At least 8 characters
   - Must include uppercase, lowercase, number, and special character
   ```

4. **Contact Information**
   - Select "Personal" (or "Business" if applicable)
   - Enter your full name, phone, address
   - Read and accept the AWS Customer Agreement

5. **Payment Information**
   - Enter credit/debit card details
   - AWS will charge $1 for verification (refunded immediately)
   - This is required even for free tier usage

6. **Identity Verification**
   - Choose "Text message (SMS)" or "Voice call"
   - Enter verification code from phone
   - Click "Continue"

7. **Select Support Plan**
   - Choose "Basic support - Free"
   - Click "Complete sign up"

8. **Wait for Account Activation**
   - Usually takes 5-10 minutes
   - Check email for confirmation: "Welcome to Amazon Web Services"

9. **Sign In to Console**
   - Go to: https://console.aws.amazon.com
   - Enter root user email
   - Enter password
   - ✅ You're now in the AWS Management Console!

---

## Step 2: Create IAM User

**Why Not Use Root User?**
- ❌ Root user has unlimited access (dangerous)
- ❌ No way to limit permissions if credentials leak
- ✅ IAM users can have specific permissions
- ✅ Can be easily disabled if compromised

### Create Administrator IAM User

1. **Navigate to IAM**
   - In AWS Console search bar, type "IAM"
   - Click "IAM" (Identity and Access Management)
   - Or go to: https://console.aws.amazon.com/iam

2. **Create User**
   - Click "Users" in left sidebar
   - Click "Create user" (orange button)

3. **Set User Details**
   ```
   User name: tyche-deployer
   ☑ Provide user access to the AWS Management Console
   ○ I want to create an IAM user
   
   Console password:
   ○ Custom password: [create strong password]
   ☐ User must create a new password at next sign-in (uncheck this)
   ```
   - Click "Next"

4. **Set Permissions**
   - Select "Attach policies directly"
   - Search for "AdministratorAccess"
   - ☑ Check the box next to "AdministratorAccess"
   - Click "Next"

   **Note**: For production, use more restrictive permissions. For development, AdministratorAccess is fine.

5. **Review and Create**
   - Review the user details
   - Click "Create user"

6. **Save Sign-In URL**
   - Copy the console sign-in URL (looks like: `https://123456789012.signin.aws.amazon.com/console`)
   - Save this URL - you'll use it to sign in as this user
   - Click "Return to users list"

---

## Step 3: Create Access Keys

Access keys allow the AWS CLI to authenticate programmatically.

1. **Select Your User**
   - In IAM > Users, click "tyche-deployer"

2. **Create Access Key**
   - Click "Security credentials" tab
   - Scroll to "Access keys" section
   - Click "Create access key"

3. **Choose Use Case**
   - Select "Command Line Interface (CLI)"
   - ☑ Check "I understand the above recommendation..."
   - Click "Next"

4. **Set Description** (optional)
   ```
   Description: Tyche deployment from local machine
   ```
   - Click "Create access key"

5. **Save Credentials** ⚠️ IMPORTANT
   ```
   Access key ID: AKIAIOSFODNN7EXAMPLE
   Secret access key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   ```
   
   - **Copy both values immediately** - you can't view the secret again!
   - Click "Download .csv file" as backup
   - Store in password manager (1Password, LastPass, etc.)
   - ⚠️ NEVER commit these to Git!

6. **Click "Done"**

---

## Step 4: Install AWS CLI

### macOS (Your System)

**Option A: Using Homebrew** (Recommended)
```bash
brew install awscli
```

**Option B: Using Official Installer**
```bash
# Download installer
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"

# Run installer
sudo installer -pkg AWSCLIV2.pkg -target /
```

### Verify Installation
```bash
aws --version
```

**Expected Output**:
```
aws-cli/2.13.x Python/3.x.x Darwin/23.x.x
```

---

## Step 5: Configure AWS CLI

1. **Run Configuration Command**
   ```bash
   aws configure
   ```

2. **Enter Your Credentials**
   ```
   AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
   AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   Default region name [None]: us-east-1
   Default output format [None]: json
   ```

   **Region Selection**:
   - `us-east-1` (N. Virginia) - Most services, often cheapest
   - `us-west-2` (Oregon) - Good alternative
   - `eu-west-1` (Ireland) - If in Europe
   - Choose the region closest to you or your users

3. **Verify Configuration**
   ```bash
   # Check credentials file
   cat ~/.aws/credentials
   ```
   
   **Expected Output**:
   ```
   [default]
   aws_access_key_id = AKIAIOSFODNN7EXAMPLE
   aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
   ```

   ```bash
   # Check config file
   cat ~/.aws/config
   ```
   
   **Expected Output**:
   ```
   [default]
   region = us-east-1
   output = json
   ```

### Managing Multiple Profiles (Optional)

If you work with multiple AWS accounts or environments, you can create named profiles:

#### Create a Named Profile
```bash
# Configure with a specific profile name
aws configure --profile tyche-dev

# Or configure for production
aws configure --profile tyche-prod
```

#### Edit Credentials File Manually
```bash
# Open credentials file with your preferred editor
nano ~/.aws/credentials

# Or use VS Code
code ~/.aws/credentials
```

**Example Multi-Profile Setup**:

`~/.aws/credentials`:
```ini
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

[tyche-dev]
aws_access_key_id = AKIAI...DEV
aws_secret_access_key = wJalr...DEV

[tyche-prod]
aws_access_key_id = AKIAI...PROD
aws_secret_access_key = wJalr...PROD
```

`~/.aws/config`:
```ini
[default]
region = us-east-1
output = json

[profile tyche-dev]
region = us-east-1
output = json

[profile tyche-prod]
region = us-east-1
output = json
```

#### Use a Specific Profile
```bash
# Option 1: Set environment variable
export AWS_PROFILE=tyche-dev
aws sts get-caller-identity  # Uses tyche-dev profile

# Option 2: Use --profile flag
aws sts get-caller-identity --profile tyche-prod

# Option 3: Set default profile in CDK
export AWS_PROFILE=tyche-dev
cd infrastructure
npx cdk deploy  # Uses tyche-dev profile
```

#### Switch Between Profiles
```bash
# Check current profile
echo $AWS_PROFILE

# Switch to different profile
export AWS_PROFILE=tyche-prod

# Verify which account you're using
aws sts get-caller-identity

# Unset to use default profile
unset AWS_PROFILE
```

#### Rename a Profile
To rename a profile, manually edit the files:

```bash
# Edit credentials
nano ~/.aws/credentials
# Change [old-name] to [new-name]

# Edit config
nano ~/.aws/config
# Change [profile old-name] to [profile new-name]
```

---

## Step 6: Verify AWS Access

Run these commands to verify everything is set up correctly:

### 1. Check Identity
```bash
aws sts get-caller-identity
```

**Expected Output**:
```json
{
    "UserId": "AIDAI...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/tyche-deployer"
}
```

✅ If you see your account ID and user ARN, authentication works!

### 2. List S3 Buckets
```bash
aws s3 ls
```

**Expected Output**:
```
# Empty list (no buckets yet) or list of existing buckets
```

✅ If command succeeds without errors, you have proper permissions!

### 3. Check CDK Version
```bash
npx aws-cdk --version
```

**Expected Output**:
```
2.x.x (build ...)
```

---

## Step 7: Set AWS Region in Project

Update your CDK app to use your chosen region:

```typescript
// infrastructure/lib/app.ts
#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { TycheStack } from './tyche-stack';

const app = new cdk.App();

new TycheStack(app, 'TycheStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1', // ← Change this to your chosen region
  },
});
```

---

## Step 8: Bootstrap CDK

CDK needs to create resources in your AWS account for deployments.

```bash
cd infrastructure
npx cdk bootstrap
```

**What This Does**:
- Creates S3 bucket for CloudFormation templates
- Creates IAM roles for deployments
- Sets up CDK toolkit stack

**Expected Output**:
```
 ⏳  Bootstrapping environment aws://123456789012/us-east-1...
 ✅  Environment aws://123456789012/us-east-1 bootstrapped.
```

**This only needs to be done once per account/region!**

---

## Step 9: Set AI API Keys (Required)

Before deploying, set your AI provider API keys:

```bash
# In infrastructure directory
cd /Users/akkeem/Documents/ClassAssignments/GitHub_Projects/tyche/infrastructure

# Set environment variables (replace with your actual keys)
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-proj-..."
export XAI_API_KEY="xai-..."
export DEEPSEEK_API_KEY="sk-..."
```

**You need at least ONE of these keys for the AI chat to work.**

**To make these persistent** (recommended):
```bash
# Add to your ~/.zshrc file
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.zshrc
echo 'export OPENAI_API_KEY="sk-proj-..."' >> ~/.zshrc
echo 'export XAI_API_KEY="xai-..."' >> ~/.zshrc
echo 'export DEEPSEEK_API_KEY="sk-..."' >> ~/.zshrc

# Reload shell
source ~/.zshrc
```

---

## Troubleshooting

### Issue: "Unable to locate credentials"

**Solution**:
```bash
# Re-run configuration
aws configure

# Or manually edit credentials file
nano ~/.aws/credentials
```

### Issue: "Access Denied" when running CDK commands

**Possible Causes**:
1. IAM user doesn't have AdministratorAccess policy
2. Using wrong AWS profile
3. Credentials expired

**Solutions**:
```bash
# Check which user you're authenticated as
aws sts get-caller-identity

# If using multiple profiles
export AWS_PROFILE=default

# Verify permissions
aws iam get-user
```

### Issue: "Region not specified"

**Solution**:
```bash
# Set default region
aws configure set region us-east-1

# Or use environment variable
export AWS_DEFAULT_REGION=us-east-1
```

### Issue: "CDK bootstrap fails"

**Common Causes**:
- No permissions to create CloudFormation stacks
- Another bootstrap in progress
- Network/connectivity issues

**Solution**:
```bash
# Try with verbose output
npx cdk bootstrap --verbose

# Or specify region explicitly
npx cdk bootstrap aws://ACCOUNT-ID/us-east-1
```

---

## Security Best Practices

### ✅ DO:
- Use IAM users, not root account
- Enable MFA (Multi-Factor Authentication) on root and IAM users
- Rotate access keys regularly (every 90 days)
- Use AWS Secrets Manager for production API keys
- Set up billing alerts (free tier threshold)
- Review CloudTrail logs periodically

### ❌ DON'T:
- Commit AWS credentials to Git
- Share access keys via email/Slack
- Use root user for daily tasks
- Leave unused access keys active
- Deploy with AdministratorAccess in production

---

## Cost Management

### Enable Billing Alerts

1. **Go to Billing Dashboard**
   - Search "Billing" in AWS Console
   - Click "Billing and Cost Management"

2. **Set Up Alert**
   - Click "Budgets" in left sidebar
   - Click "Create budget"
   - Choose "Zero spend budget" (alerts when any charges occur)
   - Or "Monthly cost budget" (e.g., alert at $10)

### Expected Costs for Tyche

**Free Tier (First 12 Months)**:
- Lambda: 1M requests/month free
- DynamoDB: 25 GB storage + 25 RCU/WCU free
- API Gateway: 1M requests/month free
- S3: 5 GB storage free
- Cognito: 50,000 MAUs free

**After Free Tier** (estimated monthly):
- 1,000 users: ~$5-10/month
- 10,000 users: ~$50-100/month
- 100,000 users: ~$500-1,000/month

**Most Expensive Services**:
1. AI API calls (Claude/GPT-4) - $0.01-0.10 per chat
2. Lambda invocations (after 1M)
3. DynamoDB read/write operations

---

## Next Steps

✅ AWS account created  
✅ IAM user configured  
✅ AWS CLI installed and configured  
✅ CDK bootstrapped  
✅ AI API keys set  

**You're ready to deploy!**

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for deployment instructions.

---

## Quick Reference

### Essential Commands

```bash
# Check AWS identity
aws sts get-caller-identity

# List all AWS regions
aws ec2 describe-regions --output table

# Check CDK version
npx cdk --version

# Bootstrap CDK (one-time setup)
npx cdk bootstrap

# Deploy Tyche stack
cd infrastructure
npx cdk deploy

# View CloudFormation stacks
aws cloudformation list-stacks

# View DynamoDB tables
aws dynamodb list-tables

# View Cognito user pools
aws cognito-idp list-user-pools --max-results 10
```

### Configuration Files

```
~/.aws/
├── credentials    # Access keys (NEVER commit to Git)
├── config         # Region and output preferences
└── cli/          # CLI cache
```

### Environment Variables

```bash
# AWS credentials (alternative to ~/.aws/credentials)
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_DEFAULT_REGION

# CDK
CDK_DEFAULT_ACCOUNT
CDK_DEFAULT_REGION

# AI API Keys (required for Tyche)
ANTHROPIC_API_KEY
OPENAI_API_KEY
XAI_API_KEY
DEEPSEEK_API_KEY
```

---

**Document Version**: 1.0  
**Last Updated**: October 15, 2025  
**Maintained By**: Tyche Development Team
