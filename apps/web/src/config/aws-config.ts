/**
 * AWS Amplify Configuration
 * 
 * Update these values after deploying your CDK stack:
 * 1. Run: npx cdk deploy
 * 2. Copy outputs to .env file
 * 3. Amplify will automatically use these values
 */

import { Amplify } from 'aws-amplify';

export function configureAmplify() {
  // Use environment variables (set after deployment)
  const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID || 'us-east-1_khi9CtS4e';
  const userPoolClientId = import.meta.env.VITE_COGNITO_CLIENT_ID || '49993ps4165cjqu161528up854';

  console.log('🔧 Configuring Amplify with:', {
    userPoolId,
    userPoolClientId,
  });

  // Amplify v6 configuration format
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: userPoolId,
        userPoolClientId: userPoolClientId,
        loginWith: {
          email: true,
        }
      }
    }
  });
  
  console.log('✅ Amplify configured successfully');
}

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
