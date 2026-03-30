const express = require('express');
const cors = require('cors');
const promClient = require('prom-client');
const redis = require('redis');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

// ============================================================================
// OPENTELEMETRY SETUP - Initialize BEFORE other imports for auto-instrumentation
// ============================================================================
const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const { Resource } = require('@opentelemetry/resources');
const { SemanticResourceAttributes } = require('@opentelemetry/semantic-conventions');

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'payment-api',
    [SemanticResourceAttributes.SERVICE_VERSION]: '1.0.0',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.JAEGER_ENDPOINT || 'http://jaeger.observability.svc.cluster.local:4318/v1/traces',
  }),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-express': { enabled: true },
      '@opentelemetry/instrumentation-http': { enabled: true },
      '@opentelemetry/instrumentation-redis-4': { enabled: true },
    }),
  ],
});

sdk.start();
console.log('✅ OpenTelemetry tracing initialized');

// Force flush traces on shutdown
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, flushing traces...');
  await sdk.shutdown(); // This flushes pending traces
  await redisClient.quit();
  process.exit(0);
});

// ============================================================================
// PROMETHEUS METRICS SETUP
// ============================================================================
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Custom metrics for financial transactions
const transferCounter = new promClient.Counter({
  name: 'payment_transfers_total',
  help: 'Total number of money transfers',
  labelNames: ['status'], // success, failed, insufficient_funds
  registers: [register],
});

const transferAmount = new promClient.Histogram({
  name: 'payment_transfer_amount',
  help: 'Distribution of transfer amounts',
  buckets: [10, 50, 100, 500, 1000, 5000],
  registers: [register],
});

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

const activeUsers = new promClient.Gauge({
  name: 'payment_active_sessions',
  help: 'Number of active user sessions',
  registers: [register],
});

// ============================================================================
// REDIS CLIENT SETUP
// ============================================================================
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://redis-master.app.svc.cluster.local:6379',
});

redisClient.on('error', (err) => {
  console.error('❌ Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

// Connect to Redis
(async () => {
  await redisClient.connect();
  await seedInitialData();
})();

// ============================================================================
// SEED INITIAL DATA (Demo Users & Balances)
// ============================================================================
async function seedInitialData() {
  const users = [
    { username: 'Akingbade', password: 'moneyman123', balance: 50000.00 },
    { username: 'Omosebi', password: 'moneytalks123', balance: 13000.00 },
    { username: 'Kelvin', password: 'brokie123', balance: 1500.00 },
  ];

  for (const user of users) {
    const exists = await redisClient.exists(`user:${user.username}:password`);
    if (!exists) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await redisClient.set(`user:${user.username}:password`, hashedPassword);
      await redisClient.set(`user:${user.username}:balance`, user.balance.toString());
      console.log(`✅ Seeded user: ${user.username}`);
    }
  }
}

// ============================================================================
// EXPRESS APP SETUP
// ============================================================================
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request timing middleware for Prometheus
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode.toString())
      .observe(duration);
  });
  next();
});

// Structured logging middleware
app.use((req, res, next) => {
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  };
  console.log(JSON.stringify(logData));
  next();
});

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

// Login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Validate input
    if (!username || !password) {
      console.log(JSON.stringify({ event: 'login_failed', reason: 'missing_credentials', username }));
      return res.status(400).json({ error: 'Username and password required' });
    }

    // Check if user exists
    const storedPassword = await redisClient.get(`user:${username}:password`);
    if (!storedPassword) {
      console.log(JSON.stringify({ event: 'login_failed', reason: 'user_not_found', username }));
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, storedPassword);
    if (!isValid) {
      console.log(JSON.stringify({ event: 'login_failed', reason: 'invalid_password', username }));
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create session
    const sessionId = uuidv4();
    await redisClient.setEx(`session:${sessionId}`, 3600, username); // 1 hour expiry
    activeUsers.inc();

    console.log(JSON.stringify({ event: 'login_success', username, sessionId }));

    res.json({
      success: true,
      sessionId,
      username,
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'login_error', error: error.message }));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Logout
app.post('/api/logout', async (req, res) => {
  const { sessionId } = req.body;

  try {
    if (sessionId) {
      await redisClient.del(`session:${sessionId}`);
      activeUsers.dec();
      console.log(JSON.stringify({ event: 'logout_success', sessionId }));
    }
    res.json({ success: true });
  } catch (error) {
    console.error(JSON.stringify({ event: 'logout_error', error: error.message }));
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================
async function authenticateSession(req, res, next) {
  const sessionId = req.headers['x-session-id'];

  if (!sessionId) {
    return res.status(401).json({ error: 'No session provided' });
  }

  try {
    const username = await redisClient.get(`session:${sessionId}`);
    if (!username) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    req.username = username;
    next();
  } catch (error) {
    console.error(JSON.stringify({ event: 'auth_error', error: error.message }));
    res.status(500).json({ error: 'Authentication error' });
  }
}

// ============================================================================
// BALANCE ENDPOINTS
// ============================================================================

// Get balance (cached in Redis)
app.get('/api/balance', authenticateSession, async (req, res) => {
  try {
    const balance = await redisClient.get(`user:${req.username}:balance`);

    console.log(JSON.stringify({
      event: 'balance_check',
      username: req.username,
      balance: parseFloat(balance),
    }));

    res.json({
      username: req.username,
      balance: parseFloat(balance) || 0,
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'balance_error', error: error.message }));
    res.status(500).json({ error: 'Failed to retrieve balance' });
  }
});

// ============================================================================
// TRANSFER ENDPOINTS
// ============================================================================

// Transfer money
app.post('/api/transfer', authenticateSession, async (req, res) => {
  const { to, amount } = req.body;
  const from = req.username;

  // Validation
  if (!to || !amount || amount <= 0) {
    transferCounter.labels('failed').inc();
    return res.status(400).json({ error: 'Invalid transfer parameters' });
  }

  try {
    // Get balances
    const fromBalance = parseFloat(await redisClient.get(`user:${from}:balance`)) || 0;
    const toExists = await redisClient.exists(`user:${to}:password`);

    // Check recipient exists
    if (!toExists) {
      transferCounter.labels('failed').inc();
      console.log(JSON.stringify({
        event: 'transfer_failed',
        reason: 'recipient_not_found',
        from,
        to,
        amount,
      }));
      return res.status(404).json({ error: 'Recipient not found' });
    }

    // Check sufficient funds
    if (fromBalance < amount) {
      transferCounter.labels('insufficient_funds').inc();
      console.log(JSON.stringify({
        event: 'transfer_failed',
        reason: 'insufficient_funds',
        from,
        to,
        amount,
        currentBalance: fromBalance,
      }));
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    // Perform transfer (Redis transaction)
    const toBalance = parseFloat(await redisClient.get(`user:${to}:balance`)) || 0;
    const newFromBalance = fromBalance - amount;
    const newToBalance = toBalance + amount;

    await redisClient.set(`user:${from}:balance`, newFromBalance.toString());
    await redisClient.set(`user:${to}:balance`, newToBalance.toString());

    // Record transaction
    const transactionId = uuidv4();
    const transaction = {
      id: transactionId,
      from,
      to,
      amount,
      timestamp: new Date().toISOString(),
      status: 'completed',
    };

    await redisClient.set(`transaction:${transactionId}`, JSON.stringify(transaction));
    await redisClient.lPush(`user:${from}:transactions`, transactionId);
    await redisClient.lPush(`user:${to}:transactions`, transactionId);

    // Update metrics
    transferCounter.labels('success').inc();
    transferAmount.observe(amount);

    console.log(JSON.stringify({
      event: 'transfer_success',
      transactionId,
      from,
      to,
      amount,
      newBalance: newFromBalance,
    }));

    res.json({
      success: true,
      transactionId,
      newBalance: newFromBalance,
    });
  } catch (error) {
    transferCounter.labels('failed').inc();
    console.error(JSON.stringify({ event: 'transfer_error', error: error.message }));
    res.status(500).json({ error: 'Transfer failed' });
  }
});

// Get transaction history
app.get('/api/transactions', authenticateSession, async (req, res) => {
  try {
    const transactionIds = await redisClient.lRange(`user:${req.username}:transactions`, 0, 9); // Last 10
    const transactions = [];

    for (const id of transactionIds) {
      const txData = await redisClient.get(`transaction:${id}`);
      if (txData) {
        transactions.push(JSON.parse(txData));
      }
    }

    console.log(JSON.stringify({
      event: 'transactions_retrieved',
      username: req.username,
      count: transactions.length,
    }));

    res.json({ transactions });
  } catch (error) {
    console.error(JSON.stringify({ event: 'transactions_error', error: error.message }));
    res.status(500).json({ error: 'Failed to retrieve transactions' });
  }
});

// ============================================================================
// FAILURE ENDPOINT (for testing alerts)
// ============================================================================

// Intentional failure endpoint
app.get('/api/fail', authenticateSession, (req, res) => {
  transferCounter.labels('failed').inc();
  console.error(JSON.stringify({
    event: 'intentional_failure',
    username: req.username,
    timestamp: new Date().toISOString(),
  }));
  res.status(500).json({ error: 'Simulated failure for testing alerts' });
});

// ============================================================================
// HEALTH & METRICS ENDPOINTS
// ============================================================================

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'payment-api',
    timestamp: new Date().toISOString(),
  });
});

// Prometheus metrics
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`🚀 Payment API running on port ${PORT}`);
  console.log(`📊 Metrics available at http://localhost:${PORT}/metrics`);
  console.log(`🏥 Health check at http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('⚠️  SIGTERM received, shutting down gracefully...');
  await sdk.shutdown();
  await redisClient.quit();
  process.exit(0);
});
