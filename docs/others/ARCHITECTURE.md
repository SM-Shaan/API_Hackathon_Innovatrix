# CareForAll - Microservice Architecture

## Overview
A fault-tolerant donation platform designed to handle 1000+ requests/second with proper idempotency, state management, and observability.

## Architecture Diagram

```mermaid
---
config:
  layout: elk
---
flowchart TB
    Users["👥 Users<br>Donors &amp; Admins"] --> Gateway["🚪 API Gateway<br>Rate Limiting + Auth + Routing"]
    Gateway --> UserSvc["👤 User Service<br>Auth &amp; Registration"] & CampaignSvc["📋 Campaign Service<br>Campaign Management"] & PledgeSvc["💝 Pledge Service<br>Donation Logic"]
    UserSvc --> UserDB[("👤 User DB")] & Redis["🔴 Redis Cache<br>Sessions + Totals + Idempotency"]
    CampaignSvc --> CampaignDB[("📋 Campaign DB")] & Redis & Kafka["📡 Kafka Event Bus<br>Async Events"]
    PledgeSvc --> PledgeDB[("💝 Pledge DB")] & PaymentSvc["💰 Payment Service<br>Payment + Wallet APIs"] & Redis & Kafka
    PaymentSvc --> PaymentDB[("💰 Payment DB")] & WalletDB[("💳 Wallet DB<br>Users + Transactions")] & Kafka
    TotalsSvc["📊 Totals Service<br>Real-time Analytics"] --> TotalsDB[("📊 Totals DB")] & Redis
    Kafka --> TotalsSvc & NotificationSvc["📧 Notification Service<br>Email &amp; Alerts"]
    UserSvc -.-> Prometheus["📈 Prometheus<br>Metrics Collection"]
    CampaignSvc -.-> Prometheus
    PledgeSvc -.-> Prometheus
    PaymentSvc -.-> Prometheus
    TotalsSvc -.-> Prometheus
    Prometheus --> Grafana["📊 Grafana<br>Dashboards"]
    Jaeger["🔍 Jaeger<br>Distributed Tracing"]
     Users:::externalBox
     Gateway:::externalBox
     UserSvc:::serviceBox
     CampaignSvc:::serviceBox
     PledgeSvc:::serviceBox
     UserDB:::dataBox
     Redis:::infraBox
     CampaignDB:::dataBox
     Kafka:::infraBox
     PledgeDB:::dataBox
     PaymentSvc:::serviceBox
     PaymentDB:::dataBox
     WalletDB:::dataBox
     TotalsSvc:::serviceBox
     TotalsDB:::dataBox
     NotificationSvc:::serviceBox
     Prometheus:::infraBox
     Grafana:::infraBox
     Jaeger:::infraBox
    classDef serviceBox fill:#e1f5fe,stroke:#01579b,stroke-width:2px,color:#000000
    classDef dataBox fill:#f3e5f5,stroke:#4a148c,stroke-width:2px,color:#000000
    classDef infraBox fill:#e8f5e8,stroke:#1b5e20,stroke-width:2px,color:#000000
    classDef externalBox fill:#fff3e0,stroke:#e65100,stroke-width:2px,color:#000000
```
## Core Services

### 1. API Gateway (Port 8080)
- Single entry point for all frontend requests
- Request routing and load balancing
- Rate limiting
- Authentication validation

### 2. User Service (Port 3001)
- User registration and authentication
- JWT token management
- Role-based access control (Admin, Donor)

### 3. Campaign Service (Port 3002)
- Campaign CRUD operations
- Campaign status management
- Admin campaign monitoring

### 4. Pledge Service (Port 3003)
- **Idempotency**: Uses idempotency keys to prevent duplicate donations
- **Outbox Pattern**: Stores events in outbox table, publishes reliably
- Donation history for registered/unregistered users

### 5. Payment Service (Port 3004)
- **State Machine**: PENDING → AUTHORIZED → CAPTURED → COMPLETED
- Webhook handling with idempotency
- Payment provider integration
- Prevents backward state transitions

### 6. Totals Service (Port 3005)
- **CQRS Read Model**: Pre-computed campaign totals
- Event-driven updates (no recalculation on read)
- High-performance read operations

### 7. Notification Service (Port 3006)
- Email notifications
- Real-time updates via WebSocket
- Event-driven architecture

## Key Patterns Implemented

### Idempotency
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Request   │────▶│  Check Key  │────▶│   Process   │
│  + IdempKey │     │  in Redis   │     │  or Return  │
└─────────────┘     └─────────────┘     │   Cached    │
                                        └─────────────┘
```

### Outbox Pattern
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Business   │────▶│   Write to  │────▶│  Publisher  │
│  Operation  │     │   Outbox    │     │   Worker    │
└─────────────┘     │  (same TX)  │     └─────────────┘
                    └─────────────┘
```

### Payment State Machine
```
PENDING ──▶ AUTHORIZED ──▶ CAPTURED ──▶ COMPLETED
    │           │              │
    └───────────┴──────────────┴──────▶ FAILED
```

## Data Models

### User
```json
{
  "id": "uuid",
  "email": "string",
  "password_hash": "string",
  "name": "string",
  "role": "ADMIN | DONOR",
  "created_at": "timestamp"
}
```

### Campaign
```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "goal_amount": "decimal",
  "current_amount": "decimal",
  "status": "ACTIVE | COMPLETED | CANCELLED",
  "owner_id": "uuid",
  "created_at": "timestamp"
}
```

### Pledge
```json
{
  "id": "uuid",
  "campaign_id": "uuid",
  "donor_id": "uuid | null",
  "donor_email": "string",
  "amount": "decimal",
  "idempotency_key": "string",
  "status": "PENDING | COMPLETED | FAILED",
  "created_at": "timestamp"
}
```

### Payment
```json
{
  "id": "uuid",
  "pledge_id": "uuid",
  "amount": "decimal",
  "state": "PENDING | AUTHORIZED | CAPTURED | COMPLETED | FAILED",
  "provider_ref": "string",
  "idempotency_key": "string",
  "created_at": "timestamp",
  "updated_at": "timestamp"
}
```

### Outbox Event
```json
{
  "id": "uuid",
  "aggregate_type": "string",
  "aggregate_id": "uuid",
  "event_type": "string",
  "payload": "json",
  "published": "boolean",
  "created_at": "timestamp"
}
```

## Scalability Strategy

Using Docker Compose with replicas:
```yaml
services:
  pledge-service:
    deploy:
      replicas: 3
    ...
```

## Technology Stack
- **Backend**: Node.js with Express
- **Database**: PostgreSQL
- **Cache/Queue**: Redis
- **API Gateway**: Nginx
- **Monitoring**: Prometheus + Grafana
- **Logging**: Elasticsearch + Kibana
- **Tracing**: Jaeger + OpenTelemetry

## Technical Implementation Details

### 1. Idempotency Implementation

```javascript
// Middleware for idempotency
const idempotencyMiddleware = async (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'] || 
                        req.headers['x-idempotency-key'];
  
  if (!idempotencyKey) {
    return res.status(400).json({ error: 'Idempotency-Key required' });
  }
  
  // Check Redis for existing result
  const existingResult = await redis.get(`idempotent:${idempotencyKey}`);
  if (existingResult) {
    const parsed = JSON.parse(existingResult);
    return res.status(parsed.status).json(parsed.data);
  }
  
  req.idempotencyKey = idempotencyKey;
  next();
};

// Store result after successful processing
const storeIdempotentResult = async (key, status, data) => {
  await redis.setex(`idempotent:${key}`, 86400, JSON.stringify({
    status,
    data,
    timestamp: Date.now()
  }));
};
```

### 2. Outbox Pattern Implementation

```javascript
// Database schema for outbox
CREATE TABLE outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP NULL,
  INDEX idx_unprocessed (processed_at) WHERE processed_at IS NULL
);

// Transactional outbox
const createPledgeWithEvent = async (pledgeData) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Insert pledge
    const pledgeResult = await client.query(`
      INSERT INTO pledges (id, campaign_id, amount, idempotency_key, status)
      VALUES ($1, $2, $3, $4, 'PENDING')
      RETURNING *
    `, [pledgeData.id, pledgeData.campaign_id, pledgeData.amount, pledgeData.idempotency_key]);
    
    // 2. Insert event into outbox (same transaction)
    await client.query(`
      INSERT INTO outbox (aggregate_id, event_type, payload)
      VALUES ($1, 'PledgeCreated', $2)
    `, [pledgeData.id, JSON.stringify(pledgeResult.rows[0])]);
    
    await client.query('COMMIT');
    return pledgeResult.rows[0];
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// Outbox publisher worker
const publishEvents = async () => {
  const unprocessed = await pool.query(`
    SELECT * FROM outbox 
    WHERE processed_at IS NULL 
    ORDER BY created_at 
    LIMIT 100
  `);
  
  for (const event of unprocessed.rows) {
    try {
      // Publish to message queue
      await messageQueue.publish(event.event_type, event.payload);
      
      // Mark as processed
      await pool.query(`
        UPDATE outbox 
        SET processed_at = NOW() 
        WHERE id = $1
      `, [event.id]);
      
    } catch (error) {
      console.error('Failed to publish event:', event.id, error);
      // Will retry in next cycle
    }
  }
};

// Run publisher every 100ms
setInterval(publishEvents, 100);
```

### 3. Payment State Machine

```javascript
class PaymentStateMachine {
  static STATES = {
    PENDING: 'PENDING',
    AUTHORIZED: 'AUTHORIZED',
    CAPTURED: 'CAPTURED',
    COMPLETED: 'COMPLETED',
    FAILED: 'FAILED',
    REFUNDED: 'REFUNDED'
  };
  
  static VALID_TRANSITIONS = {
    [this.STATES.PENDING]: [this.STATES.AUTHORIZED, this.STATES.FAILED],
    [this.STATES.AUTHORIZED]: [this.STATES.CAPTURED, this.STATES.FAILED],
    [this.STATES.CAPTURED]: [this.STATES.COMPLETED, this.STATES.REFUNDED],
    [this.STATES.COMPLETED]: [],
    [this.STATES.FAILED]: [],
    [this.STATES.REFUNDED]: []
  };
  
  static async transition(paymentId, fromState, toState, metadata = {}) {
    // Validate transition
    if (!this.VALID_TRANSITIONS[fromState]?.includes(toState)) {
      throw new Error(`Invalid transition: ${fromState} → ${toState}`);
    }
    
    // Atomic state update with optimistic locking
    const result = await pool.query(`
      UPDATE payments 
      SET 
        state = $1, 
        updated_at = NOW(),
        metadata = COALESCE(metadata, '{}') || $4::jsonb
      WHERE id = $2 AND state = $3
      RETURNING *
    `, [toState, paymentId, fromState, JSON.stringify(metadata)]);
    
    if (result.rowCount === 0) {
      throw new Error('Payment state conflict - retry');
    }
    
    // Log transition
    await pool.query(`
      INSERT INTO payment_transitions (payment_id, from_state, to_state, metadata)
      VALUES ($1, $2, $3, $4)
    `, [paymentId, fromState, toState, JSON.stringify(metadata)]);
    
    // Publish state change event
    await messageQueue.publish('payment.state.changed', {
      paymentId,
      fromState,
      toState,
      timestamp: Date.now(),
      metadata
    });
    
    return result.rows[0];
  }
}

// Usage in webhook handler
app.post('/webhooks/payment', async (req, res) => {
  const { paymentId, status, providerRef } = req.body;
  const webhookId = req.headers['webhook-id'];
  
  try {
    // Check if webhook already processed
    const processed = await redis.get(`webhook:${webhookId}`);
    if (processed) {
      return res.status(200).json({ message: 'Already processed' });
    }
    
    // Get current payment state
    const payment = await pool.query('SELECT * FROM payments WHERE id = $1', [paymentId]);
    if (!payment.rows[0]) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    const currentState = payment.rows[0].state;
    let newState;
    
    // Map webhook status to our state
    switch (status) {
      case 'authorized':
        newState = PaymentStateMachine.STATES.AUTHORIZED;
        break;
      case 'captured':
        newState = PaymentStateMachine.STATES.CAPTURED;
        break;
      case 'completed':
        newState = PaymentStateMachine.STATES.COMPLETED;
        break;
      case 'failed':
        newState = PaymentStateMachine.STATES.FAILED;
        break;
      default:
        return res.status(400).json({ error: 'Unknown status' });
    }
    
    // Attempt state transition
    await PaymentStateMachine.transition(paymentId, currentState, newState, {
      providerRef,
      webhookId,
      timestamp: Date.now()
    });
    
    // Mark webhook as processed
    await redis.setex(`webhook:${webhookId}`, 86400, 'processed');
    
    res.status(200).json({ message: 'Webhook processed' });
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### 4. CQRS Read Model (Totals Service)

```javascript
// Event handlers for read model updates
class CampaignTotalsProjection {
  
  static async handlePledgeCreated(event) {
    const { campaign_id, amount } = event.payload;
    
    // Update Redis cache immediately
    await redis.hincrbyfloat(`campaign:${campaign_id}`, 'total', parseFloat(amount));
    await redis.hincrby(`campaign:${campaign_id}`, 'count', 1);
    
    // Update persistent read model
    await pool.query(`
      INSERT INTO campaign_totals (campaign_id, total_amount, pledge_count)
      VALUES ($1, $2, 1)
      ON CONFLICT (campaign_id) 
      DO UPDATE SET 
        total_amount = campaign_totals.total_amount + EXCLUDED.total_amount,
        pledge_count = campaign_totals.pledge_count + EXCLUDED.pledge_count,
        updated_at = NOW()
    `, [campaign_id, amount]);
  }
  
  static async handlePledgeCompleted(event) {
    // Additional logic for completed pledges
    const { campaign_id, pledge_id } = event.payload;
    
    await redis.sadd(`campaign:${campaign_id}:completed`, pledge_id);
    
    // Update completion metrics
    await pool.query(`
      UPDATE campaign_totals 
      SET completed_pledges = completed_pledges + 1
      WHERE campaign_id = $1
    `, [campaign_id]);
  }
  
  static async handlePledgeFailed(event) {
    const { campaign_id, amount } = event.payload;
    
    // Reverse the total
    await redis.hincrbyfloat(`campaign:${campaign_id}`, 'total', -parseFloat(amount));
    await redis.hincrby(`campaign:${campaign_id}`, 'count', -1);
    
    await pool.query(`
      UPDATE campaign_totals 
      SET 
        total_amount = total_amount - $2,
        pledge_count = pledge_count - 1,
        failed_pledges = failed_pledges + 1
      WHERE campaign_id = $1
    `, [campaign_id, amount]);
  }
}

// Fast read endpoint
app.get('/campaigns/:id/totals', async (req, res) => {
  const campaignId = req.params.id;
  
  try {
    // Try Redis first (sub-millisecond response)
    const cachedTotal = await redis.hmget(`campaign:${campaignId}`, 'total', 'count');
    
    if (cachedTotal[0] !== null) {
      return res.json({
        campaign_id: campaignId,
        total_amount: parseFloat(cachedTotal[0]) || 0,
        pledge_count: parseInt(cachedTotal[1]) || 0,
        source: 'cache'
      });
    }
    
    // Fallback to database
    const result = await pool.query(`
      SELECT total_amount, pledge_count, updated_at
      FROM campaign_totals 
      WHERE campaign_id = $1
    `, [campaignId]);
    
    if (result.rows.length === 0) {
      return res.json({
        campaign_id: campaignId,
        total_amount: 0,
        pledge_count: 0,
        source: 'default'
      });
    }
    
    const totals = result.rows[0];
    
    // Populate cache for next request
    await redis.hmset(`campaign:${campaignId}`, {
      total: totals.total_amount,
      count: totals.pledge_count
    });
    await redis.expire(`campaign:${campaignId}`, 300); // 5 minutes
    
    res.json({
      campaign_id: campaignId,
      total_amount: totals.total_amount,
      pledge_count: totals.pledge_count,
      source: 'database'
    });
    
  } catch (error) {
    console.error('Error fetching totals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

### 5. Circuit Breaker for Payment Provider

```javascript
class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.monitoringPeriod = options.monitoringPeriod || 10000;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }
  
  async call(fn, ...args) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        this.successCount = 0;
      } else {
        throw new Error(`Circuit breaker is OPEN for ${this.name}`);
      }
    }
    
    try {
      const result = await fn(...args);
      
      if (this.state === 'HALF_OPEN') {
        this.successCount++;
        if (this.successCount >= 3) {
          this.state = 'CLOSED';
          this.failureCount = 0;
        }
      }
      
      return result;
      
    } catch (error) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      
      if (this.failureCount >= this.failureThreshold) {
        this.state = 'OPEN';
      }
      
      throw error;
    }
  }
}

// Usage
const paymentProviderBreaker = new CircuitBreaker('stripe', {
  failureThreshold: 3,
  resetTimeout: 30000
});

const processPayment = async (pledgeData) => {
  return paymentProviderBreaker.call(async () => {
    const response = await stripeClient.charges.create({
      amount: pledgeData.amount,
      currency: 'usd',
      source: pledgeData.token,
      metadata: {
        pledge_id: pledgeData.id
      }
    });
    
    return response;
  });
};
```

### 6. Performance Monitoring & Observability

```javascript
// OpenTelemetry tracing setup
const opentelemetry = require('@opentelemetry/api');
const { NodeSDK } = require('@opentelemetry/auto-instrumentations-node');
const { JaegerExporter } = require('@opentelemetry/exporter-jaeger');

const jaegerExporter = new JaegerExporter({
  endpoint: 'http://jaeger:14268/api/traces',
});

const sdk = new NodeSDK({
  traceExporter: jaegerExporter,
  serviceName: 'pledge-service',
});

sdk.start();

// Custom metrics
const prometheus = require('prom-client');

const pledgeCounter = new prometheus.Counter({
  name: 'pledges_total',
  help: 'Total number of pledges',
  labelNames: ['status', 'campaign_id']
});

const paymentDuration = new prometheus.Histogram({
  name: 'payment_duration_seconds',
  help: 'Payment processing duration',
  buckets: [0.1, 0.5, 1, 2, 5]
});

// Middleware for metrics
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    
    if (req.path.includes('/pledges')) {
      paymentDuration.observe(duration);
    }
  });
  
  next();
};

app.use(metricsMiddleware);
```

### 7. Error Handling & Retry Logic

```javascript
const retry = async (fn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
    }
  }
};

// Graceful error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process, just log it
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Graceful shutdown
  process.exit(1);
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const checks = {
    database: false,
    redis: false,
    messageQueue: false
  };
  
  try {
    await pool.query('SELECT 1');
    checks.database = true;
  } catch (e) {}
  
  try {
    await redis.ping();
    checks.redis = true;
  } catch (e) {}
  
  try {
    await messageQueue.ping();
    checks.messageQueue = true;
  } catch (e) {}
  
  const healthy = Object.values(checks).every(check => check);
  
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: Date.now()
  });
});
```

## Docker Compose Configuration

```yaml
version: '3.8'

services:
  # Load Balancer
  nginx:
    image: nginx:alpine
    ports:
      - "8080:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - user-service
      - pledge-service
      - campaign-service
      - payment-service
      - totals-service
      - notification-service

  # Core Services
  user-service:
    build: ./services/user
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/careforall
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
    deploy:
      replicas: 2
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  pledge-service:
    build: ./services/pledge
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/careforall
      - REDIS_URL=redis://redis:6379
      - KAFKA_BROKERS=kafka:9092
    deploy:
      replicas: 3
    depends_on:
      - postgres
      - redis
      - kafka

  payment-service:
    build: ./services/payment
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/careforall
      - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY}
      - KAFKA_BROKERS=kafka:9092
    deploy:
      replicas: 2
    depends_on:
      - postgres
      - kafka

  campaign-service:
    build: ./services/campaign
    environment:
      - DATABASE_URL=postgresql://postgres:password@postgres:5432/careforall
      - REDIS_URL=redis://redis:6379
    deploy:
      replicas: 2

  totals-service:
    build: ./services/totals
    environment:
      - REDIS_URL=redis://redis:6379
      - KAFKA_BROKERS=kafka:9092
    deploy:
      replicas: 2

  notification-service:
    build: ./services/notification
    environment:
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - KAFKA_BROKERS=kafka:9092
    deploy:
      replicas: 1

  # Infrastructure
  postgres:
    image: postgres:14
    environment:
      - POSTGRES_DB=careforall
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"

  kafka:
    image: confluentinc/cp-kafka:latest
    environment:
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
    depends_on:
      - zookeeper

  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181

  # Observability
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin123
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana

  jaeger:
    image: jaegertracing/all-in-one:latest
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    ports:
      - "16686:16686"
      - "14268:14268"

  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.17.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - es_data:/usr/share/elasticsearch/data

  kibana:
    image: docker.elastic.co/kibana/kibana:7.17.0
    environment:
      - ELASTICSEARCH_HOSTS=http://elasticsearch:9200
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch

volumes:
  postgres_data:
  redis_data:
  grafana_data:
  es_data:

networks:
  default:
    driver: bridge
```

This architecture solves all the problems from the original system:

1. **No more double charges** - Idempotency keys prevent duplicate processing
2. **No lost donations** - Outbox pattern ensures events are always published
3. **No backward state transitions** - State machine enforces valid flows only  
4. **No performance issues** - CQRS read models provide instant totals
5. **Full observability** - Complete tracing, logging, and monitoring
6. **Fault tolerance** - Circuit breakers, retries, and graceful degradation
7. **High availability** - Service replicas and health checks
