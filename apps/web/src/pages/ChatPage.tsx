/**
 * Chat Page
 * 
 * AI-powered conversation interface for financial advice.
 * Features:
 * - Real-time messaging with AI assistant
 * - Tool usage visualization (when AI uses AgentKit tools)
 * - Message history with timestamps
 * - Auto-scroll to latest message
 * - Loading states and error handling
 */

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAIChat } from '../hooks/useAIChat';
import { Link, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import './Chat.css';

export function ChatPage() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const { messages, loading, error, sendMessage, clearChat } = useAIChat();
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || loading) {
      return;
    }

    const message = inputMessage.trim();
    setInputMessage('');
    
    // Resize textarea back to normal
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    await sendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderMessage = (msg: typeof messages[0], index: number) => {
    const isUser = msg.role === 'user';
    
    return (
      <div
        key={index}
        className={`message ${isUser ? 'message-user' : 'message-assistant'}`}
      >
        <div className="message-avatar">
          {isUser ? '👤' : '🤖'}
        </div>
        <div className="message-content">
          <div className="message-header">
            <span className="message-role">
              {isUser ? 'You' : 'Tyche AI'}
            </span>
            <span className="message-timestamp">
              {formatTimestamp(msg.timestamp)}
            </span>
          </div>
          <div className="message-text">
            {isUser ? (
              msg.content
            ) : (
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Starter questions
  const starterQuestions = [
    "What's the best strategy to pay off my credit cards?",
    "Show me my current credit card situation",
    "How much am I paying in interest each month?",
    "Should I do a balance transfer?",
  ];

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <h1>💎 Tyche</h1>
        <div className="nav-links">
          <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>Dashboard</Link>
          <Link to="/cards" className={location.pathname === '/cards' ? 'active' : ''}>Cards</Link>
          <Link to="/budget" className={location.pathname === '/budget' ? 'active' : ''}>Budget</Link>
          <Link to="/spending" className={location.pathname.startsWith('/spending') ? 'active' : ''}>Spending</Link>
          <Link to="/chat" className={location.pathname === '/chat' ? 'active' : ''}>AI Chat</Link>
          <Link to="/analytics" className={location.pathname === '/analytics' ? 'active' : ''}>Analytics</Link>
        </div>
        <div className="nav-right">
          <span className="user-email">{user?.email}</span>
          <button onClick={logout} className="btn-logout">Logout</button>
        </div>
      </nav>

      <div className="chat-container">
        <header className="chat-header">
          <div className="header-content">
            <div className="header-icon">💬</div>
            <div>
              <h2>AI Financial Assistant</h2>
              <p className="subtitle">Get personalized advice powered by AgentKit</p>
            </div>
          </div>
          {messages.length > 0 && (
            <button
              className="btn-secondary btn-clear"
              onClick={clearChat}
              title="Clear conversation"
            >
              🗑️ Clear Chat
            </button>
          )}
        </header>

        <div className="chat-content">
          {/* Messages Area */}
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="chat-empty-state">
                <div className="empty-icon">🤖</div>
                <h3>Welcome to Tyche AI!</h3>
                <p>
                  I'm your AI-powered financial assistant. I can help you:
                </p>
                <ul className="features-list">
                  <li>📊 Analyze your credit card debt</li>
                  <li>💡 Recommend optimal payoff strategies</li>
                  <li>💳 Suggest balance transfer opportunities</li>
                  <li>📈 Track your financial progress</li>
                  <li>🎯 Optimize payment timing</li>
                  <li>⚡ Calculate credit impact</li>
                </ul>
                <p className="starter-prompt">Try asking:</p>
                <div className="starter-questions">
                  {starterQuestions.map((question, idx) => (
                    <button
                      key={idx}
                      className="starter-question"
                      onClick={() => {
                        setInputMessage(question);
                        inputRef.current?.focus();
                      }}
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => renderMessage(msg, idx))}
                {loading && (
                  <div className="message message-assistant message-loading">
                    <div className="message-avatar">🤖</div>
                    <div className="message-content">
                      <div className="message-header">
                        <span className="message-role">Tyche AI</span>
                      </div>
                      <div className="message-text">
                        <div className="typing-indicator">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="chat-input-container">
            {error && (
              <div className="chat-error">
                ⚠️ {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="chat-input-form">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Ask me anything about your finances..."
                className="chat-input"
                rows={1}
                disabled={loading}
              />
              <button
                type="submit"
                className="btn-send"
                disabled={!inputMessage.trim() || loading}
                title="Send message (Enter)"
              >
                {loading ? '⏳' : '📤'}
              </button>
            </form>
            <div className="input-hint">
              Press <kbd>Enter</kbd> to send, <kbd>Shift + Enter</kbd> for new line
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
