import React, { useState } from 'react';
import LandingHero from './LandingHero';

function LoginPage({ onLogin, apiUrl }) {
  const [showLogin, setShowLogin] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        onLogin(data.sessionId, data.username);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Show hero animation first
  if (!showLogin) {
    return <LandingHero onComplete={() => setShowLogin(true)} />;
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="8" fill="#3B82F6"/>
              <path d="M20 10L30 18V30H10V18L20 10Z" fill="white"/>
              <circle cx="20" cy="23" r="3" fill="#3B82F6"/>
            </svg>
          </div>
          <h1>ObserveOps</h1>
          <p>Payment Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          {error && (
            <div className="error-message">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1C4.1 1 1 4.1 1 8s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7zm3.5 9.5L10 12 8 10l-2 2-1.5-1.5L6 9 4 7l1.5-1.5L8 7l2-2 1.5 1.5L10 9l1.5 1.5z"/>
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className="login-button" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="demo-credentials">
          <p className="demo-title">Demo Accounts:</p>
          <div className="demo-accounts">
            <div className="demo-account">
              <code>Akingbade / moneyman123</code>
              <span className="balance-badge">€50,000</span>
            </div>
            <div className="demo-account">
              <code>Omosebi / moneytalks123</code>
              <span className="balance-badge">€13,000</span>
            </div>
            <div className="demo-account">
              <code>Kelvin / brokie123</code>
              <span className="balance-badge">€1,500</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
