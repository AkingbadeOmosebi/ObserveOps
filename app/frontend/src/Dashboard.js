import React, { useState, useEffect } from 'react';

function Dashboard({ username, sessionId, onLogout, apiUrl }) {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [transferStatus, setTransferStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchBalance();
    fetchTransactions();
    // Refresh data every 10 seconds
    const interval = setInterval(() => {
      fetchBalance();
      fetchTransactions();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchBalance = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/balance`, {
        headers: { 'X-Session-Id': sessionId },
      });
      const data = await response.json();
      if (response.ok) {
        setBalance(data.balance);
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/transactions`, {
        headers: { 'X-Session-Id': sessionId },
      });
      const data = await response.json();
      if (response.ok) {
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    setLoading(true);
    setTransferStatus(null);

    try {
      const response = await fetch(`${apiUrl}/api/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId,
        },
        body: JSON.stringify({
          to: recipient,
          amount: parseFloat(amount),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setTransferStatus({ type: 'success', message: `€${amount} sent to ${recipient}` });
        setBalance(data.newBalance);
        setRecipient('');
        setAmount('');
        fetchTransactions();
      } else {
        setTransferStatus({ type: 'error', message: data.error });
      }
    } catch (error) {
      setTransferStatus({ type: 'error', message: 'Network error' });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleString('de-DE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo-section">
            <svg width="32" height="32" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="8" fill="#3B82F6"/>
              <path d="M20 10L30 18V30H10V18L20 10Z" fill="white"/>
              <circle cx="20" cy="23" r="3" fill="#3B82F6"/>
            </svg>
            <span className="app-name">ObserveOps</span>
          </div>
          <div className="user-section">
            <div className="user-avatar">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">{username}</span>
              <span className="user-role">Account Holder</span>
            </div>
            <button onClick={onLogout} className="logout-button">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="dashboard-grid">
          {/* Balance Card */}
          <div className="card balance-card">
            <div className="card-header">
              <h2>Current Balance</h2>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="2" y="5" width="20" height="14" rx="2" strokeWidth="2"/>
                <path d="M2 10h20" strokeWidth="2"/>
              </svg>
            </div>
            <div className="balance-amount">
              <span className="currency-symbol">€</span>
              {formatCurrency(balance)}
            </div>
            <div className="balance-footer">
              Last updated: {new Date().toLocaleTimeString('de-DE')}
            </div>
          </div>

          {/* Transfer Form */}
          <div className="card transfer-card">
            <div className="card-header">
              <h2>Send Money</h2>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 12H3M21 12L17 8M21 12L17 16" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <form onSubmit={handleTransfer} className="transfer-form">
              <div className="form-group">
                <label htmlFor="recipient">Recipient</label>
                <input
                  id="recipient"
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="Enter username"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="amount">Amount (€)</label>
                <input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              {transferStatus && (
                <div className={`status-message ${transferStatus.type}`}>
                  {transferStatus.message}
                </div>
              )}
              <button type="submit" className="transfer-button" disabled={loading}>
                {loading ? 'Processing...' : 'Send Money'}
              </button>
            </form>
          </div>

          {/* Transaction History */}
          <div className="card transactions-card">
            <div className="card-header">
              <h2>Recent Transactions</h2>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 9h18M3 15h18M9 3v18" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="transactions-list">
              {transactions.length === 0 ? (
                <div className="empty-state">
                  <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                    <circle cx="60" cy="60" r="50" fill="#f7fafc" stroke="#e2e8f0" strokeWidth="2"/>
                    <path d="M40 60h40M60 40v40" stroke="#cbd5e0" strokeWidth="3" strokeLinecap="round"/>
                  </svg>
                  <p>No transactions yet</p>
                  <p className="empty-subtitle">Start by sending money to someone!</p>
                </div>
              ) : (
                transactions.map((tx) => (
                  <div key={tx.id} className="transaction-item">
                    <div className="transaction-icon">
                      {tx.from === username ? (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M12 5v14M19 12l-7 7-7-7" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      ) : (
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path d="M12 19V5M5 12l7-7 7 7" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      )}
                    </div>
                    <div className="transaction-details">
                      <div className="transaction-party">
                        {tx.from === username ? `To ${tx.to}` : `From ${tx.from}`}
                      </div>
                      <div className="transaction-date">
                        {formatDate(tx.timestamp)}
                      </div>
                    </div>
                    <div className={`transaction-amount ${tx.from === username ? 'sent' : 'received'}`}>
                      {tx.from === username ? '-' : '+'}€{formatCurrency(tx.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Dashboard;
