# Frontend Integration Guide

**Purpose**: Complete guide for integrating web and mobile apps with Tyche Finance backend  
**Date**: October 16, 2025  
**Status**: Production Ready  

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Authentication Setup](#authentication-setup)
4. [API Client Configuration](#api-client-configuration)
5. [React Hooks (Web)](#react-hooks-web)
6. [React Native Hooks (Mobile)](#react-native-hooks-mobile)
7. [API Endpoints Reference](#api-endpoints-reference)
8. [Error Handling](#error-handling)
9. [Testing](#testing)
10. [Production Checklist](#production-checklist)

---

## Overview

### Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌────────────────┐
│   React Web     │         │  React Native    │         │   AWS Backend  │
│   (Vite)        │────────▶│    (Expo)        │────────▶│                │
│                 │  Auth   │                  │  API    │  • API Gateway │
│  • Cognito SDK  │  Flow   │  • Cognito SDK   │  Calls  │  • Lambda      │
│  • API Client   │         │  • API Client    │         │  • DynamoDB    │
└─────────────────┘         └──────────────────┘         └────────────────┘
```

### What This Guide Covers

- ✅ **Cognito Authentication** - Sign up, sign in, session management
- ✅ **API Integration** - Making authenticated requests
- ✅ **Reusable Hooks** - Copy-paste React hooks for common operations
- ✅ **Error Handling** - Graceful error management
- ✅ **TypeScript Support** - Full type safety
- ✅ **Best Practices** - Production-ready patterns

---

## Prerequisites

### Required Packages

#### Web App (React + Vite)
```bash
cd apps/web
npm install @aws-amplify/auth @aws-amplify/core axios
```

#### Mobile App (React Native + Expo)
```bash
cd apps/mobile
npm install @aws-amplify/auth @aws-amplify/core @aws-amplify/react-native axios
npm install @react-native-async-storage/async-storage
```

### Environment Variables

After deployment, you'll get these values from CloudFormation output:

**`.env` (Web)**:
```env
VITE_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/prod
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=your-client-id
VITE_AWS_REGION=us-east-1
```

**`.env` (Mobile)**:
```env
EXPO_PUBLIC_API_URL=https://your-api-id.execute-api.us-east-1.amazonaws.com/prod
EXPO_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
EXPO_PUBLIC_COGNITO_CLIENT_ID=your-client-id
EXPO_PUBLIC_AWS_REGION=us-east-1
```

---

## Authentication Setup

### Step 1: Configure Amplify

#### Web (`apps/web/src/config/aws-config.ts`)

```typescript
import { Amplify } from '@aws-amplify/core';

export function configureAmplify() {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
        userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
        region: import.meta.env.VITE_AWS_REGION || 'us-east-1',
      }
    }
  });
}
```

#### Mobile (`apps/mobile/src/config/aws-config.ts`)

```typescript
import { Amplify } from '@aws-amplify/core';
import Constants from 'expo-constants';

export function configureAmplify() {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: Constants.expoConfig?.extra?.cognitoUserPoolId,
        userPoolClientId: Constants.expoConfig?.extra?.cognitoClientId,
        region: Constants.expoConfig?.extra?.awsRegion || 'us-east-1',
      }
    }
  });
}
```

### Step 2: Initialize in App Entry Point

#### Web (`apps/web/src/main.tsx`)

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { configureAmplify } from './config/aws-config';

// Configure AWS Amplify
configureAmplify();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

#### Mobile (`apps/mobile/App.tsx`)

```typescript
import { useEffect } from 'react';
import { configureAmplify } from './src/config/aws-config';

export default function App() {
  useEffect(() => {
    configureAmplify();
  }, []);

  return (
    // Your app content
  );
}
```

### Step 3: Authentication Hook

Create `apps/web/src/hooks/useAuth.ts` (works for both web and mobile):

```typescript
import { useState, useEffect } from 'react';
import { signIn, signUp, signOut, getCurrentUser, fetchAuthSession } from '@aws-amplify/auth';

interface User {
  userId: string;
  email: string;
  tenantId: string;
  role: 'user' | 'admin' | 'dev';
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is authenticated on mount
  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();
      
      // Extract user attributes from JWT token
      const idToken = session.tokens?.idToken;
      const payload = idToken?.payload;

      setUser({
        userId: currentUser.userId,
        email: payload?.email as string,
        tenantId: payload?.['custom:tenantId'] as string || 'personal',
        role: payload?.['custom:role'] as any || 'user',
      });
    } catch (err) {
      console.log('Not authenticated');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email: string, password: string) {
    try {
      setError(null);
      const { isSignedIn } = await signIn({ username: email, password });
      
      if (isSignedIn) {
        await checkUser();
        return true;
      }
      return false;
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    }
  }

  async function register(email: string, password: string, tenantId: string = 'personal') {
    try {
      setError(null);
      await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            'custom:tenantId': tenantId,
            'custom:role': 'user',
          }
        }
      });
      return true;
    } catch (err: any) {
      setError(err.message || 'Registration failed');
      throw err;
    }
  }

  async function logout() {
    try {
      await signOut();
      setUser(null);
    } catch (err: any) {
      setError(err.message || 'Logout failed');
      throw err;
    }
  }

  async function getAuthToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() || null;
    } catch (err) {
      console.error('Failed to get auth token:', err);
      return null;
    }
  }

  return {
    user,
    loading,
    error,
    login,
    register,
    logout,
    getAuthToken,
    isAuthenticated: !!user,
  };
}
```

---

## API Client Configuration

### Create API Client (`apps/web/src/lib/api-client.ts`)

```typescript
import axios, { AxiosInstance, AxiosError } from 'axios';
import { fetchAuthSession } from '@aws-amplify/auth';

class APIClient {
  private client: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || '';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to inject auth token
    this.client.interceptors.request.use(
      async (config) => {
        try {
          const session = await fetchAuthSession();
          const token = session.tokens?.idToken?.toString();
          
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (err) {
          console.error('Failed to get auth token:', err);
        }
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Unauthorized - redirect to login
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // GET request
  async get<T>(url: string, params?: any): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  // POST request
  async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  // PUT request
  async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  // DELETE request
  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }
}

// Export singleton instance
export const apiClient = new APIClient();
```

---

## React Hooks (Web)

### Credit Cards Hook (`apps/web/src/hooks/useCreditCards.ts`)

```typescript
import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api-client';
import type { CreditCardAccount } from '@tyche/types';

export function useCreditCards() {
  const [cards, setCards] = useState<CreditCardAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCards();
  }, []);

  async function loadCards() {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<{ cards: CreditCardAccount[] }>('/v1/cards');
      setCards(response.cards);
    } catch (err: any) {
      setError(err.message || 'Failed to load cards');
    } finally {
      setLoading(false);
    }
  }

  async function addCard(card: Partial<CreditCardAccount>) {
    try {
      const response = await apiClient.post<{ card: CreditCardAccount }>('/v1/cards', card);
      setCards([...cards, response.card]);
      return response.card;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to add card');
    }
  }

  async function updateCard(cardId: string, updates: Partial<CreditCardAccount>) {
    try {
      const response = await apiClient.put<{ card: CreditCardAccount }>(
        `/v1/cards/${cardId}`,
        updates
      );
      setCards(cards.map(c => c.id === cardId ? response.card : c));
      return response.card;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update card');
    }
  }

  async function deleteCard(cardId: string) {
    try {
      await apiClient.delete(`/v1/cards/${cardId}`);
      setCards(cards.filter(c => c.id !== cardId));
    } catch (err: any) {
      throw new Error(err.message || 'Failed to delete card');
    }
  }

  return {
    cards,
    loading,
    error,
    loadCards,
    addCard,
    updateCard,
    deleteCard,
  };
}
```

### AI Chat Hook (`apps/web/src/hooks/useAIChat.ts`)

```typescript
import { useState } from 'react';
import { apiClient } from '../lib/api-client';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatContext {
  cards?: any[];
  userId?: string;
}

export function useAIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendMessage(content: string, context?: ChatContext) {
    const userMessage: ChatMessage = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.post<{ response: string }>('/v1/chat', {
        messages: [...messages, userMessage],
        context,
      });

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
      };

      setMessages(prev => [...prev, assistantMessage]);
      return response.response;
    } catch (err: any) {
      setError(err.message || 'Failed to send message');
      throw err;
    } finally {
      setLoading(false);
    }
  }

  function clearChat() {
    setMessages([]);
    setError(null);
  }

  return {
    messages,
    loading,
    error,
    sendMessage,
    clearChat,
  };
}
```

### Analytics Hook (`apps/web/src/hooks/useAnalytics.ts`)

```typescript
import { useState, useEffect } from 'react';
import { apiClient } from '../lib/api-client';
import type { FinancialHealthSnapshot, FinancialGoal } from '@tyche/types';

export function useAnalytics() {
  const [snapshots, setSnapshots] = useState<FinancialHealthSnapshot[]>([]);
  const [goals, setGoals] = useState<FinancialGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      setLoading(true);
      setError(null);

      const [snapshotsRes, goalsRes] = await Promise.all([
        apiClient.get<{ snapshots: FinancialHealthSnapshot[] }>('/v1/analytics/snapshots?limit=30'),
        apiClient.get<{ goals: FinancialGoal[] }>('/v1/analytics/goals'),
      ]);

      setSnapshots(snapshotsRes.snapshots);
      setGoals(goalsRes.goals);
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }

  async function createSnapshot() {
    try {
      const response = await apiClient.post<{ snapshot: FinancialHealthSnapshot }>(
        '/v1/analytics/snapshot'
      );
      setSnapshots([response.snapshot, ...snapshots]);
      return response.snapshot;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to create snapshot');
    }
  }

  async function createGoal(goal: Partial<FinancialGoal>) {
    try {
      const response = await apiClient.post<{ goal: FinancialGoal }>(
        '/v1/analytics/goal',
        goal
      );
      setGoals([...goals, response.goal]);
      return response.goal;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to create goal');
    }
  }

  async function getProgressReport() {
    try {
      const response = await apiClient.get<any>('/v1/analytics/progress');
      return response;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to get progress report');
    }
  }

  return {
    snapshots,
    goals,
    loading,
    error,
    loadAnalytics,
    createSnapshot,
    createGoal,
    getProgressReport,
  };
}
```

---

## React Native Hooks (Mobile)

### Mobile-Specific API Client (`apps/mobile/src/lib/api-client.ts`)

```typescript
import axios, { AxiosInstance } from 'axios';
import { fetchAuthSession } from '@aws-amplify/auth';
import Constants from 'expo-constants';

class APIClient {
  private client: AxiosInstance;

  constructor() {
    const baseURL = Constants.expoConfig?.extra?.apiUrl || '';
    
    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      async (config) => {
        try {
          const session = await fetchAuthSession();
          const token = session.tokens?.idToken?.toString();
          
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } catch (err) {
          console.error('Failed to get auth token:', err);
        }
        
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  async get<T>(url: string, params?: any): Promise<T> {
    const response = await this.client.get<T>(url, { params });
    return response.data;
  }

  async post<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.post<T>(url, data);
    return response.data;
  }

  async put<T>(url: string, data?: any): Promise<T> {
    const response = await this.client.put<T>(url, data);
    return response.data;
  }

  async delete<T>(url: string): Promise<T> {
    const response = await this.client.delete<T>(url);
    return response.data;
  }
}

export const apiClient = new APIClient();
```

**Note:** The React hooks (`useCreditCards`, `useAIChat`, `useAnalytics`) work the same in React Native! Just import from the mobile API client.

---

## API Endpoints Reference

### Authentication Endpoints (Cognito)

| Operation | Method | Endpoint | Description |
|-----------|--------|----------|-------------|
| Sign Up | - | Cognito SDK | Use `signUp()` from @aws-amplify/auth |
| Sign In | - | Cognito SDK | Use `signIn()` from @aws-amplify/auth |
| Sign Out | - | Cognito SDK | Use `signOut()` from @aws-amplify/auth |

### Credit Card Endpoints

| Operation | Method | Endpoint | Auth Required |
|-----------|--------|----------|---------------|
| List Cards | GET | `/v1/cards` | ✅ Yes |
| Get Card | GET | `/v1/cards/:cardId` | ✅ Yes |
| Create Card | POST | `/v1/cards` | ✅ Yes |
| Update Card | PUT | `/v1/cards/:cardId` | ✅ Yes |
| Delete Card | DELETE | `/v1/cards/:cardId` | ✅ Yes |

**Example Request:**
```typescript
// Create a new card
const newCard = await apiClient.post('/v1/cards', {
  network: 'visa',
  last4: '4242',
  balance: 5000,
  creditLimit: 10000,
  apr: 0.1899,
  minimumPayment: 100,
  dueDate: '2025-11-15',
  nickname: 'Chase Sapphire',
});
```

### AI Chat Endpoint

| Operation | Method | Endpoint | Auth Required |
|-----------|--------|----------|---------------|
| Chat | POST | `/v1/chat` | ✅ Yes |

**Request Body:**
```typescript
{
  messages: [
    { role: 'user', content: 'How can I pay off my debt faster?' }
  ],
  context: {
    cards: [
      { balance: 5000, apr: 0.19, limit: 10000 }
    ]
  }
}
```

**Response:**
```typescript
{
  response: "Based on your cards, I recommend using the avalanche method..."
}
```

### Payoff Strategy Endpoint

| Operation | Method | Endpoint | Auth Required |
|-----------|--------|----------|---------------|
| Calculate Payoff | POST | `/v1/payoff` | ✅ Yes |

**Request Body:**
```typescript
{
  cards: [
    { balance: 5000, apr: 0.19, minimumPayment: 100 },
    { balance: 3000, apr: 0.22, minimumPayment: 60 }
  ],
  monthlyBudget: 500,
  strategy: 'avalanche' // or 'snowball'
}
```

### Analytics Endpoints

| Operation | Method | Endpoint | Auth Required |
|-----------|--------|----------|---------------|
| Create Snapshot | POST | `/v1/analytics/snapshot` | ✅ Yes |
| Get Snapshots | GET | `/v1/analytics/snapshots` | ✅ Yes |
| Create Goal | POST | `/v1/analytics/goal` | ✅ Yes |
| Get Goals | GET | `/v1/analytics/goals` | ✅ Yes |
| Update Goal | PUT | `/v1/analytics/goal/:goalId` | ✅ Yes |
| Progress Report | GET | `/v1/analytics/progress` | ✅ Yes |

### Admin Endpoints (Admin Role Required)

| Operation | Method | Endpoint | Role Required |
|-----------|--------|----------|---------------|
| List Users | GET | `/v1/admin/users` | admin |
| Get User | GET | `/v1/admin/users/:userId` | admin |
| Change Role | POST | `/v1/admin/users/:userId/role` | admin |
| Suspend User | POST | `/v1/admin/users/:userId/suspend` | admin |
| Activate User | POST | `/v1/admin/users/:userId/activate` | admin |

### Dev Endpoints (Dev Role Required)

| Operation | Method | Endpoint | Role Required |
|-----------|--------|----------|---------------|
| System Metrics | GET | `/v1/dev/metrics` | dev |
| Error Logs | GET | `/v1/dev/logs` | dev |
| Analytics | GET | `/v1/analytics/insights` | dev |

---

## Error Handling

### Error Response Format

All API errors follow this format:

```typescript
{
  error: string;           // Error message
  code?: string;           // Error code (e.g., 'INVALID_INPUT')
  statusCode: number;      // HTTP status code
  details?: any;           // Additional error details
}
```

### Common Error Codes

| Status Code | Error Code | Meaning |
|-------------|------------|---------|
| 400 | INVALID_INPUT | Request validation failed |
| 401 | UNAUTHORIZED | Authentication required or invalid token |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource doesn't exist |
| 409 | CONFLICT | Resource already exists |
| 429 | RATE_LIMIT | Too many requests |
| 500 | INTERNAL_ERROR | Server error |

### Error Handling Pattern

```typescript
import { AxiosError } from 'axios';

async function handleAPICall<T>(
  apiCall: () => Promise<T>,
  fallbackMessage: string = 'An error occurred'
): Promise<T> {
  try {
    return await apiCall();
  } catch (error) {
    if (error instanceof AxiosError) {
      const errorMessage = error.response?.data?.error || fallbackMessage;
      const statusCode = error.response?.status;
      
      // Handle specific errors
      if (statusCode === 401) {
        // Redirect to login
        window.location.href = '/login';
        throw new Error('Session expired. Please log in again.');
      } else if (statusCode === 403) {
        throw new Error('You do not have permission to perform this action.');
      } else if (statusCode === 429) {
        throw new Error('Too many requests. Please try again later.');
      }
      
      throw new Error(errorMessage);
    }
    
    throw new Error(fallbackMessage);
  }
}

// Usage
const cards = await handleAPICall(
  () => apiClient.get('/v1/cards'),
  'Failed to load credit cards'
);
```

---

## Testing

### Unit Testing API Hooks

**Example: Testing `useCreditCards` hook**

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { useCreditCards } from '../hooks/useCreditCards';
import { apiClient } from '../lib/api-client';

vi.mock('../lib/api-client');

describe('useCreditCards', () => {
  it('should load cards on mount', async () => {
    const mockCards = [
      { id: '1', network: 'visa', last4: '4242', balance: 5000 }
    ];

    vi.spyOn(apiClient, 'get').mockResolvedValue({ cards: mockCards });

    const { result } = renderHook(() => useCreditCards());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.cards).toEqual(mockCards);
    });
  });

  it('should handle errors', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useCreditCards());

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });
  });
});
```

### Integration Testing

**Example: Testing authentication flow**

```typescript
import { signIn, signUp, signOut } from '@aws-amplify/auth';
import { vi } from 'vitest';

vi.mock('@aws-amplify/auth');

describe('Authentication Flow', () => {
  it('should sign up a new user', async () => {
    const mockSignUp = vi.mocked(signUp);
    mockSignUp.mockResolvedValue({ isSignUpComplete: true } as any);

    await signUp({
      username: 'test@example.com',
      password: 'SecurePass123!',
      options: {
        userAttributes: {
          email: 'test@example.com',
        }
      }
    });

    expect(mockSignUp).toHaveBeenCalledWith({
      username: 'test@example.com',
      password: 'SecurePass123!',
      options: expect.any(Object),
    });
  });
});
```

---

## Production Checklist

### Security

- [ ] **Environment Variables**: Never commit `.env` files with real credentials
- [ ] **HTTPS Only**: Ensure API calls use HTTPS in production
- [ ] **Token Refresh**: Implement token refresh logic for long sessions
- [ ] **Secure Storage**: Use secure storage for tokens (Web: httpOnly cookies, Mobile: Keychain/Keystore)
- [ ] **Input Validation**: Validate all user inputs before sending to API
- [ ] **Error Messages**: Don't expose sensitive information in error messages

### Performance

- [ ] **Request Caching**: Cache GET requests where appropriate
- [ ] **Debouncing**: Debounce search and filter operations
- [ ] **Pagination**: Implement pagination for large lists
- [ ] **Lazy Loading**: Load data on-demand, not all at once
- [ ] **Offline Support**: Handle offline scenarios gracefully

### Monitoring

- [ ] **Error Tracking**: Integrate Sentry or similar error tracking
- [ ] **Analytics**: Track user interactions and API calls
- [ ] **Performance Monitoring**: Monitor API response times
- [ ] **Logging**: Log important user actions and errors

### Testing

- [ ] **Unit Tests**: Test all hooks and utilities
- [ ] **Integration Tests**: Test API client and authentication flow
- [ ] **E2E Tests**: Test critical user journeys
- [ ] **Error Scenarios**: Test error handling and edge cases

---

## Example: Complete Login Page

```typescript
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export function LoginPage() {
  const { login, register, loading, error } = useAuth();
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      if (isSignUp) {
        await register(email, password);
        alert('Registration successful! Please sign in.');
        setIsSignUp(false);
      } else {
        await login(email, password);
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error('Auth error:', err);
    }
  }

  return (
    <div className="login-page">
      <h1>{isSignUp ? 'Sign Up' : 'Sign In'}</h1>
      
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        
        {error && <div className="error">{error}</div>}
        
        <button type="submit" disabled={loading}>
          {loading ? 'Loading...' : isSignUp ? 'Sign Up' : 'Sign In'}
        </button>
      </form>
      
      <button onClick={() => setIsSignUp(!isSignUp)}>
        {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
      </button>
    </div>
  );
}
```

## Example: Complete Dashboard with Cards

```typescript
import React from 'react';
import { useCreditCards } from '../hooks/useCreditCards';
import { useAIChat } from '../hooks/useAIChat';

export function Dashboard() {
  const { cards, loading: cardsLoading, addCard, updateCard, deleteCard } = useCreditCards();
  const { messages, loading: chatLoading, sendMessage } = useAIChat();

  if (cardsLoading) {
    return <div>Loading cards...</div>;
  }

  return (
    <div className="dashboard">
      <h1>My Credit Cards</h1>
      
      <div className="cards-grid">
        {cards.map(card => (
          <div key={card.id} className="card">
            <h3>{card.nickname || `${card.network} ****${card.last4}`}</h3>
            <p>Balance: ${card.balance.toFixed(2)}</p>
            <p>Limit: ${card.creditLimit.toFixed(2)}</p>
            <p>APR: {(card.apr * 100).toFixed(2)}%</p>
            <p>Due: {card.dueDate}</p>
            <button onClick={() => deleteCard(card.id!)}>Delete</button>
          </div>
        ))}
      </div>

      <div className="ai-chat">
        <h2>Financial Assistant</h2>
        <div className="messages">
          {messages.map((msg, i) => (
            <div key={i} className={`message ${msg.role}`}>
              {msg.content}
            </div>
          ))}
        </div>
        
        <button 
          onClick={() => sendMessage('How can I pay off my debt faster?', { cards })}
          disabled={chatLoading}
        >
          {chatLoading ? 'Thinking...' : 'Ask for Advice'}
        </button>
      </div>
    </div>
  );
}
```

---

## Next Steps

After integrating the frontend:

1. **Deploy Backend** - Run `npx cdk deploy` to get API URL and Cognito IDs
2. **Update Environment Variables** - Add deployment outputs to `.env` files
3. **Test Authentication** - Sign up and sign in from your app
4. **Test API Calls** - Verify all endpoints work correctly
5. **Build Features** - Start building your UI components
6. **Add Analytics** - Track user behavior and API usage
7. **Deploy Frontend** - Deploy web app to Vercel/Netlify, mobile to App Store/Play Store

---

**Document Version**: 1.0  
**Last Updated**: October 16, 2025  
**Maintained By**: Tyche Development Team

**Questions?** See [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) for additional help.
