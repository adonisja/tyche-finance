/**
 * API Client
 * 
 * Handles all HTTP requests to the Tyche backend.
 * Automatically injects authentication tokens from Cognito.
 * 
 * Usage:
 *   const cards = await apiClient.get('/v1/cards');
 *   const newCard = await apiClient.post('/v1/cards', cardData);
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';
import { API_URL } from '../config/aws-config';

class APIClient {
  private client: AxiosInstance;

  constructor() {
    console.log('🌐 Initializing API Client with base URL:', API_URL);
    
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor: Add auth token to every request
    this.client.interceptors.request.use(
      async (config) => {
        try {
          const session = await fetchAuthSession();
          const token = session.tokens?.idToken?.toString();
          
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            console.log('🔑 Auth token added to request');
          } else {
            console.warn('⚠️ No auth token available - request may fail');
          }
        } catch (err) {
          // User not authenticated - continue without token
          console.warn('❌ Failed to get auth session:', err);
        }
        
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor: Handle common errors
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        // Log detailed error information
        console.error('API Error:', {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
          method: error.config?.method,
        });
        
        // Log server error message separately for visibility
        if (error.response?.data) {
          console.error('❌ Server Response:', JSON.stringify(error.response.data, null, 2));
        }

        if (error.code === 'ERR_NETWORK') {
          console.error('❌ Network Error - Check if API is accessible:', API_URL);
          console.error('   Make sure dev server was restarted after .env changes');
        }

        if (error.response?.status === 401) {
          // Unauthorized - redirect to login
          console.error('Unauthorized - session expired');
          window.location.href = '/login';
        }
        
        return Promise.reject(error);
      }
    );
  }

  async get<T>(url: string, params?: any): Promise<T> {
    try {
      console.log(`🔵 GET ${url}`, { params });
      const response = await this.client.get<T>(url, { params });
      console.log(`✅ GET ${url} succeeded`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`❌ GET ${url} failed:`, error);
      throw new Error(error.response?.data?.message || error.message || 'Network request failed');
    }
  }

  async post<T>(url: string, data?: any): Promise<T> {
    try {
      console.log(`🔵 POST ${url}`, { data });
      const response = await this.client.post<T>(url, data);
      console.log(`✅ POST ${url} succeeded`, response.data);
      return response.data;
    } catch (error: any) {
      console.error(`❌ POST ${url} failed:`, error);
      console.error('Response data:', error.response?.data);
      throw new Error(error.response?.data?.message || error.message || 'Network request failed');
    }
  }

  async put<T>(url: string, data?: any): Promise<T> {
    try {
      const response = await this.client.put<T>(url, data);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Network request failed');
    }
  }

  async delete<T>(url: string): Promise<T> {
    try {
      const response = await this.client.delete<T>(url);
      return response.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message || 'Network request failed');
    }
  }
}

// Export singleton instance
export const apiClient = new APIClient();

// Helper function to get current auth token and claims (for debugging)
export async function getAuthToken(): Promise<{
  token: string | undefined;
  claims: Record<string, any> | undefined;
  groups: string[];
} | null> {
  try {
    const session = await fetchAuthSession();
    const token = session.tokens?.idToken;
    return {
      token: token?.toString(),
      claims: token?.payload as Record<string, any> | undefined,
      groups: (token?.payload['cognito:groups'] as string[]) || []
    };
  } catch (err) {
    console.error('Error getting auth token:', err);
    return null;
  }
}

// Helper function to logout and clear session (for debugging)
export async function debugLogout() {
  try {
    const { signOut } = await import('aws-amplify/auth');
    await signOut();
    console.log('✅ Logged out successfully');
    window.location.href = '/login';
  } catch (err) {
    console.error('Error logging out:', err);
  }
}

// Helper function to check API configuration
export function checkAPIConfig() {
  console.log('🔍 API Configuration:');
  console.log('  Base URL:', API_URL);
  console.log('  Environment Variables:');
  console.log('    VITE_API_URL:', import.meta.env.VITE_API_URL);
  console.log('  To fix Network Error:');
  console.log('    1. Make sure .env file has: VITE_API_URL=https://841dg6itk5.execute-api.us-east-1.amazonaws.com');
  console.log('    2. Restart dev server: npm run dev');
  console.log('    3. Check browser console for this message on page load');
}

// Make it available globally for console debugging
if (typeof window !== 'undefined') {
  (window as any).getAuthToken = getAuthToken;
  (window as any).debugLogout = debugLogout;
  (window as any).checkAPIConfig = checkAPIConfig;
}
