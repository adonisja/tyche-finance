#!/bin/bash

# Setup Post-Confirmation Lambda Trigger for Cognito
# This script creates the Lambda function and attaches it to the User Pool

set -e  # Exit on error

PROFILE="tyche-dev"
REGION="us-east-1"
USER_POOL_ID="us-east-1_khi9CtS4e"
ACCOUNT_ID="586794453404"
LAMBDA_NAME="tyche-post-confirmation"
ROLE_NAME="tyche-post-confirmation-role"

echo "🚀 Setting up Post-Confirmation Lambda trigger..."
echo ""

# Step 1: Create IAM role for Lambda
echo "📝 Step 1: Creating IAM role for Lambda..."

TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF
)

# Create role (or get existing)
if aws iam get-role --role-name "$ROLE_NAME" --profile "$PROFILE" 2>/dev/null; then
  echo "✅ Role already exists: $ROLE_NAME"
  ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --profile "$PROFILE" --query 'Role.Arn' --output text)
else
  echo "Creating IAM role..."
  ROLE_ARN=$(aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST_POLICY" \
    --profile "$PROFILE" \
    --query 'Role.Arn' \
    --output text)
  echo "✅ Created role: $ROLE_ARN"
fi

# Step 2: Attach policies to role
echo ""
echo "📝 Step 2: Attaching policies to role..."

# Basic Lambda execution policy
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole" \
  --profile "$PROFILE" 2>/dev/null || echo "Policy already attached"

# Custom policy for adding users to groups
POLICY_NAME="tyche-cognito-add-to-group"
POLICY_DOCUMENT=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "cognito-idp:AdminAddUserToGroup",
      "Resource": "arn:aws:cognito-idp:${REGION}:${ACCOUNT_ID}:userpool/${USER_POOL_ID}"
    }
  ]
}
EOF
)

# Check if policy exists
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"
if aws iam get-policy --policy-arn "$POLICY_ARN" --profile "$PROFILE" 2>/dev/null; then
  echo "✅ Policy already exists: $POLICY_NAME"
else
  echo "Creating custom policy..."
  POLICY_ARN=$(aws iam create-policy \
    --policy-name "$POLICY_NAME" \
    --policy-document "$POLICY_DOCUMENT" \
    --profile "$PROFILE" \
    --query 'Policy.Arn' \
    --output text)
  echo "✅ Created policy: $POLICY_ARN"
fi

# Attach custom policy
aws iam attach-role-policy \
  --role-name "$ROLE_NAME" \
  --policy-arn "$POLICY_ARN" \
  --profile "$PROFILE" 2>/dev/null || echo "Custom policy already attached"

echo "✅ All policies attached"

# Step 3: Create deployment package
echo ""
echo "📝 Step 3: Creating Lambda deployment package..."

cd "$(dirname "$0")"

# Create temporary directory for Lambda package
rm -rf lambda-build
mkdir -p lambda-build

# Copy Lambda code
cp lambda-post-confirmation/index.js lambda-build/
cp lambda-post-confirmation/package.json lambda-build/

# Install dependencies
echo "📦 Installing Lambda dependencies..."
cd lambda-build
npm install --production --silent
cd ..

# Create ZIP file
rm -f post-confirmation.zip
cd lambda-build
zip -r ../post-confirmation.zip . -q
cd ..

# Cleanup
rm -rf lambda-build

echo "✅ Created post-confirmation.zip with dependencies"

# Step 4: Create or update Lambda function
echo ""
echo "📝 Step 4: Creating/updating Lambda function..."

# Wait a bit for IAM role to propagate
echo "⏳ Waiting 10 seconds for IAM role to propagate..."
sleep 10

if aws lambda get-function --function-name "$LAMBDA_NAME" --profile "$PROFILE" --region "$REGION" 2>/dev/null; then
  echo "Lambda exists, updating code..."
  aws lambda update-function-code \
    --function-name "$LAMBDA_NAME" \
    --zip-file fileb://post-confirmation.zip \
    --profile "$PROFILE" \
    --region "$REGION"
  echo "✅ Updated Lambda function code"
else
  echo "Creating Lambda function..."
  aws lambda create-function \
    --function-name "$LAMBDA_NAME" \
    --runtime nodejs20.x \
    --role "$ROLE_ARN" \
    --handler index.handler \
    --zip-file fileb://post-confirmation.zip \
    --description "Automatically adds new users to Users group after email confirmation" \
    --timeout 10 \
    --profile "$PROFILE" \
    --region "$REGION"
  echo "✅ Created Lambda function"
fi

LAMBDA_ARN="arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:${LAMBDA_NAME}"
echo "Lambda ARN: $LAMBDA_ARN"

# Step 5: Grant Cognito permission to invoke Lambda
echo ""
echo "📝 Step 5: Granting Cognito permission to invoke Lambda..."

aws lambda add-permission \
  --function-name "$LAMBDA_NAME" \
  --statement-id "CognitoPostConfirmation" \
  --action "lambda:InvokeFunction" \
  --principal cognito-idp.amazonaws.com \
  --source-arn "arn:aws:cognito-idp:${REGION}:${ACCOUNT_ID}:userpool/${USER_POOL_ID}" \
  --profile "$PROFILE" \
  --region "$REGION" 2>/dev/null || echo "Permission already exists"

echo "✅ Permission granted"

# Step 6: Attach Lambda to User Pool
echo ""
echo "📝 Step 6: Attaching Lambda trigger to User Pool..."

# IMPORTANT: Must preserve auto-verified-attributes when updating User Pool
# AWS resets unspecified settings to defaults!
aws cognito-idp update-user-pool \
  --user-pool-id "$USER_POOL_ID" \
  --lambda-config "PostConfirmation=${LAMBDA_ARN}" \
  --auto-verified-attributes email \
  --profile "$PROFILE" \
  --region "$REGION"

echo "✅ Lambda trigger attached to User Pool (auto-verification preserved)"

# Cleanup
rm -f post-confirmation.zip

echo ""
echo "🎉 ✅ SUCCESS! Post-Confirmation Lambda trigger is now active!"
echo ""
echo "📋 What this means:"
echo "  ✅ New users will automatically be added to 'Users' group after email confirmation"
echo "  ✅ Admins and DevTeam members must still be manually promoted by an admin"
echo ""
echo "🧪 To test:"
echo "  1. Sign up a new user via the frontend"
echo "  2. Confirm email"
echo "  3. Check user's groups:"
echo "     aws cognito-idp admin-list-groups-for-user \\"
echo "       --user-pool-id $USER_POOL_ID \\"
echo "       --username <email> \\"
echo "       --region $REGION \\"
echo "       --profile $PROFILE"
echo ""
echo "👑 To promote a user to Admin:"
echo "  aws cognito-idp admin-add-user-to-group \\"
echo "    --user-pool-id $USER_POOL_ID \\"
echo "    --username <email> \\"
echo "    --group-name Admins \\"
echo "    --region $REGION \\"
echo "    --profile $PROFILE"
echo ""
