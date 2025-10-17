# Cognito User Identifiers - Quick Reference

## Overview

AWS Cognito uses multiple identifiers for each user. Understanding which one to use is critical for proper user management and database design.

## The Three Identifiers

### 1. `sub` (Subject) - **USE THIS AS userId** ✅

- **Type**: UUID
- **Example**: `8448b4d8-20b1-7062-caba-1ab4ab081277`
- **Permanence**: **NEVER CHANGES** - immutable for the user's lifetime
- **Usage**: **This is your primary userId in the database**
- **Where to find it**:
  - JWT token `sub` claim
  - `currentUser.userId` in Amplify v6
  - `session.tokens.idToken.payload.sub`

```typescript
// ✅ CORRECT - Use sub as userId
const userId = session.tokens.idToken.payload.sub;
await createUserRecord({ userId, email });
```

### 2. `username` - Cognito's Internal Reference

- **Type**: String (can be email, phone, or UUID)
- **Example**: In our setup, it's the same as `sub` (UUID)
- **Permanence**: Can change depending on configuration
- **Usage**: Required for Cognito Admin API calls
- **Where to find it**:
  - JWT token `cognito:username` claim
  - Required parameter for AWS CLI commands

```bash
# username is required for Cognito API operations
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id us-east-1_khi9CtS4e \
  --username 8448b4d8-20b1-7062-caba-1ab4ab081277 \
  --region us-east-1
```

### 3. `email` - The User's Email Address

- **Type**: Email string
- **Example**: `tyrellakkeem@gmail.com`
- **Permanence**: **CAN CHANGE** - users can update their email
- **Usage**: Sign-in identifier, display purposes, notifications
- **Where to find it**:
  - JWT token `email` claim
  - User attributes

```typescript
// ✅ CORRECT - Use email for display and sign-in
const { email } = session.tokens.idToken.payload;
await signIn({ username: email, password });
```

## Best Practices

### ✅ DO:
- Use `sub` as the primary key in your database
- Use `email` for sign-in and user-facing displays
- Use `username` for Cognito Admin API calls (it's usually the same as `sub`)
- Store `sub` in your DynamoDB user records

### ❌ DON'T:
- Use `email` as a primary key (it can change!)
- Use `username` as a userId in your application logic
- Assume `username` and `sub` are always different (in our setup they're the same)

## Our Implementation

### Current Setup:
- **Sign-in method**: Email (`signInAliases: { email: true }`)
- **Username format**: UUID (same as `sub`)
- **Primary identifier**: `sub` (stored as `userId` in app)

### User Interface:
```typescript
export interface User {
  userId: string;  // Cognito 'sub' claim - permanent UUID identifier
  email: string;   // User's email (can change)
  emailVerified: boolean;
}
```

### Fetching User Data:
```typescript
const fetchUser = async () => {
  const session = await fetchAuthSession();
  const sub = session.tokens.idToken?.payload.sub as string;
  const email = session.tokens.idToken?.payload.email as string;
  
  setUser({
    userId: sub,  // ✅ Using permanent sub as userId
    email: email,
    emailVerified: true
  });
};
```

## JWT Token Structure Example

```json
{
  "sub": "8448b4d8-20b1-7062-caba-1ab4ab081277",
  "cognito:username": "8448b4d8-20b1-7062-caba-1ab4ab081277",
  "cognito:groups": ["Users"],
  "email": "tyrellakkeem@gmail.com",
  "email_verified": true,
  "iss": "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_khi9CtS4e",
  "aud": "49993ps4165cjqu161528up854",
  "token_use": "id",
  "auth_time": 1729817274,
  "exp": 1729820874,
  "iat": 1729817274
}
```

## Database Schema Recommendation

### DynamoDB User Table:
```typescript
{
  "userId": "8448b4d8-20b1-7062-caba-1ab4ab081277",  // PK - from 'sub'
  "email": "tyrellakkeem@gmail.com",                 // User's current email
  "emailVerified": true,
  "createdAt": "2025-10-16T19:00:00Z",
  "updatedAt": "2025-10-16T19:00:00Z"
}
```

### Other Tables (e.g., Transactions, Cards):
```typescript
{
  "transactionId": "uuid-here",
  "userId": "8448b4d8-20b1-7062-caba-1ab4ab081277",  // FK to User.userId (sub)
  "amount": 100.50,
  // ...
}
```

## Related Documentation

- [AWS Cognito User Attributes](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-attributes.html)
- [JWT Token Structure](https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-tokens-with-identity-providers.html)
- [Amplify Auth API](https://docs.amplify.aws/javascript/build-a-backend/auth/)

## Last Updated
October 16, 2025
