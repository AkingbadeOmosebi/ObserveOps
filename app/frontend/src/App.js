import React, { useState } from 'react';
import './App.css';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';

const API_URL = process.env.REACT_APP_API_URL || '';

function App() {
  const [sessionId, setSessionId] = useState(localStorage.getItem('sessionId'));
  const [username, setUsername] = useState(localStorage.getItem('username'));

  const handleLogin = (session, user) => {
    setSessionId(session);
    setUsername(user);
    localStorage.setItem('sessionId', session);
    localStorage.setItem('username', user);
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    setSessionId(null);
    setUsername(null);
    localStorage.removeItem('sessionId');
    localStorage.removeItem('username');
  };

  return (
    <div className="App">
      {!sessionId ? (
        <LoginPage onLogin={handleLogin} apiUrl={API_URL} />
      ) : (
        <Dashboard username={username} sessionId={sessionId} onLogout={handleLogout} apiUrl={API_URL} />
      )}
    </div>
  );
}

export default App;
