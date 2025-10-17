/**
 * Main App Component
 * 
 * Sets up routing and AWS Amplify configuration.
 * Handles authentication flow and protected routes.
 */

import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { DashboardPage } from './pages/DashboardPage';
import { CardsPage } from './pages/CardsPage';
import { ChatPage } from './pages/ChatPage';
import { BudgetSetupPage } from './pages/BudgetSetupPage';
import { SpendingDashboard } from './pages/SpendingDashboard';

// Protected Route Component
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '1.2rem',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />;
}

function App() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignUpPage />} />

        {/* Protected Routes */}
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          } 
        />

        {/* Cards Page */}
        <Route 
          path="/cards" 
          element={
            <ProtectedRoute>
              <CardsPage />
            </ProtectedRoute>
          } 
        />

        {/* Chat Page */}
        <Route 
          path="/chat" 
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          } 
        />

        {/* Budget Setup Page */}
        <Route 
          path="/budget" 
          element={
            <ProtectedRoute>
              <BudgetSetupPage />
            </ProtectedRoute>
          } 
        />

        {/* Spending Dashboard */}
        <Route 
          path="/spending" 
          element={
            <ProtectedRoute>
              <SpendingDashboard />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/spending/:month" 
          element={
            <ProtectedRoute>
              <SpendingDashboard />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/analytics" 
          element={
            <ProtectedRoute>
              <div style={{ padding: '2rem' }}>
                <h1>Analytics Page</h1>
                <p>Coming soon...</p>
              </div>
            </ProtectedRoute>
          } 
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="*" element={<Navigate to="/dashboard" />} />
      </Routes>
    </Router>
  );
}

export default App;
