# CareForAll - Microservice Architecture Design

## Problems Identified & Solutions

| Problem | Root Cause | Solution |
|---------|------------|----------|
| Double charging | No idempotency | Idempotency keys + deduplication store |
| Lost donations | No outbox pattern | Transactional Outbox + CDC |
| State corruption | No state machine | FSM with valid transitions only |
| DB overload on totals | Real-time aggregation | CQRS + Pre-computed read models |
| No visibility | Missing observability | Full tracing, metrics, logging stack |
| Out-of-order webhooks | No ordering guarantee | Event sequencing + idempotent consumers |

---

## High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    CLIENTS                                               │
│                    (Web Browser / Mobile App / Admin Panel)                              │
└─────────────────────────────────────┬───────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY (NGINX)                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │Rate Limiting│  │Load Balance │  │ SSL/TLS    │  │Auth Forward │  │ Routing     │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                              Single Base URL: /api/*                                     │
└───────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬───────────┘
        │             │             │             │             │             │
        ▼             ▼             ▼             ▼             ▼             ▼
┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
│   USER    │  │ CAMPAIGN  │  │  PLEDGE   │  │  PAYMENT  │  │  TOTALS   │  │  NOTIF    │
│  SERVICE  │  │  SERVICE  │  │  SERVICE  │  │  SERVICE  │  │  SERVICE  │  │  SERVICE  │
│  (Auth)   │  │           │  │           │  │ (Gateway) │  │  (CQRS)   │  │ (Bonus)   │
└─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
      │              │              │              │              │              │
      │              │              │              │              │              │
      ▼              ▼              ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              MESSAGE BROKER (RabbitMQ/Redis)                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐    │
│  │ pledge.created  │  │ payment.success │  │ payment.failed  │  │ campaign.update │    │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                 DATA LAYER                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │ PostgreSQL  │  │   Redis     │  │Elasticsearch│  │ Prometheus  │  │   Jaeger    │   │
│  │ (Primary DB)│  │  (Cache +   │  │  (Logs +    │  │  (Metrics)  │  │  (Tracing)  │   │
│  │             │  │ Idempotency)│  │   Search)   │  │             │  │             │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Service Architecture

### 1. API Gateway Layer

```
┌────────────────────────────────────────────────────────────────────────┐
│                         NGINX API GATEWAY                               │
│                                                                         │
│   Incoming Request                                                      │
│         │                                                               │
│         ▼                                                               │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐             │
│   │ Rate Limit  │────▶│ Auth Check  │────▶│  Route to   │             │
│   │ (1000 r/s)  │     │ (JWT Valid) │     │  Service    │             │
│   └─────────────┘     └─────────────┘     └─────────────┘             │
│                                                  │                      │
│         ┌────────────────┬───────────────┬──────┴────────┐             │
│         ▼                ▼               ▼               ▼             │
│   /api/users      /api/campaigns   /api/pledges    /api/payments       │
│         │                │               │               │             │
│         ▼                ▼               ▼               ▼             │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐       │
│   │ User Svc │    │Campaign  │    │ Pledge   │    │ Payment  │       │
│   │ :3001    │    │ Svc:3002 │    │ Svc:3003 │    │ Svc:3004 │       │
│   │(replica) │    │(replica) │    │(replica) │    │(replica) │       │
│   └──────────┘    └──────────┘    └──────────┘    └──────────┘       │
└────────────────────────────────────────────────────────────────────────┘
```

### 2. Pledge Service with Outbox Pattern (Solves Lost Donations)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PLEDGE SERVICE                                    │
│                                                                          │
│   POST /pledges                                                          │
│         │                                                                │
│         ▼                                                                │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │              SINGLE DATABASE TRANSACTION                         │  │
│   │  ┌─────────────────┐         ┌─────────────────┐               │  │
│   │  │  1. Write       │         │  2. Write to    │               │  │
│   │  │  Pledge Record  │────────▶│  OUTBOX Table   │               │  │
│   │  │  (pledges)      │         │  (outbox_events)│               │  │
│   │  └─────────────────┘         └─────────────────┘               │  │
│   │              COMMIT OR ROLLBACK TOGETHER                        │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                    │                                    │
│                                    ▼                                    │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │              OUTBOX POLLER (Background Job)                      │  │
│   │                                                                  │  │
│   │  1. SELECT * FROM outbox_events WHERE published = false          │  │
│   │  2. Publish to Message Queue                                     │  │
│   │  3. UPDATE outbox_events SET published = true                    │  │
│   │                                                                  │  │
│   │  Retry with exponential backoff on failure                       │  │
│   └─────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘

OUTBOX TABLE SCHEMA:
┌────────────────────────────────────────────────────────────────────────┐
│  id | aggregate_type | aggregate_id | event_type | payload | published │
│─────┼────────────────┼──────────────┼────────────┼─────────┼───────────│
│  1  │ pledge         │ pledge_123   │ CREATED    │ {...}   │ false     │
│  2  │ pledge         │ pledge_124   │ CAPTURED   │ {...}   │ true      │
└────────────────────────────────────────────────────────────────────────┘
```

### 3. Payment Service with Idempotency (Solves Double Charging)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PAYMENT SERVICE (Webhook Handler)                    │
│                                                                          │
│   Payment Provider Webhook ──────┐                                       │
│                                  ▼                                       │
│   ┌──────────────────────────────────────────────────────────────────┐ │
│   │                    IDEMPOTENCY LAYER                              │ │
│   │                                                                   │ │
│   │   1. Extract Idempotency-Key from header/body                    │ │
│   │      (webhook_id, transaction_id, or hash of payload)            │ │
│   │                                                                   │ │
│   │   2. Check Redis: EXISTS idempotency:{key}                       │ │
│   │      ┌────────────────────────────────────────────────────────┐ │ │
│   │      │  IF EXISTS:                                             │ │ │
│   │      │    → Return cached response (200 OK)                    │ │ │
│   │      │    → Skip processing (DUPLICATE DETECTED)               │ │ │
│   │      │                                                         │ │ │
│   │      │  IF NOT EXISTS:                                         │ │ │
│   │      │    → SET idempotency:{key} with TTL 24h                 │ │ │
│   │      │    → Process webhook                                    │ │ │
│   │      │    → Store response in cache                            │ │ │
│   │      └────────────────────────────────────────────────────────┘ │ │
│   └──────────────────────────────────────────────────────────────────┘ │
│                                  │                                       │
│                                  ▼                                       │
│   ┌──────────────────────────────────────────────────────────────────┐ │
│   │                    STATE MACHINE VALIDATOR                        │ │
│   │                                                                   │ │
│   │   Valid State Transitions:                                        │ │
│   │   PENDING → AUTHORIZED → CAPTURED → COMPLETED                    │ │
│   │   PENDING → AUTHORIZED → FAILED                                  │ │
│   │   PENDING → FAILED                                               │ │
│   │                                                                   │ │
│   │   REJECT: CAPTURED → AUTHORIZED (INVALID BACKWARD TRANSITION)    │ │
│   └──────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘

IDEMPOTENCY STORE (Redis):
┌────────────────────────────────────────────────────────────────────────┐
│  Key                              │ Value              │ TTL           │
│───────────────────────────────────┼────────────────────┼───────────────│
│  idempotency:webhook_abc123       │ {status: 200, ...} │ 86400s (24h)  │
│  idempotency:webhook_def456       │ {status: 200, ...} │ 86400s (24h)  │
└────────────────────────────────────────────────────────────────────────┘
```

### 4. Pledge State Machine (Solves Out-of-Order Events)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      PLEDGE STATE MACHINE                                │
│                                                                          │
│                           ┌─────────┐                                   │
│                           │ PENDING │                                   │
│                           └────┬────┘                                   │
│                                │                                        │
│              ┌─────────────────┼─────────────────┐                      │
│              │                 │                 │                      │
│              ▼                 ▼                 ▼                      │
│        ┌──────────┐     ┌───────────┐     ┌──────────┐                 │
│        │  FAILED  │     │AUTHORIZED │     │ EXPIRED  │                 │
│        └──────────┘     └─────┬─────┘     └──────────┘                 │
│                               │                                         │
│              ┌────────────────┼────────────────┐                        │
│              │                │                │                        │
│              ▼                ▼                ▼                        │
│        ┌──────────┐     ┌──────────┐     ┌──────────┐                  │
│        │  FAILED  │     │ CAPTURED │     │ CANCELLED│                  │
│        └──────────┘     └────┬─────┘     └──────────┘                  │
│                              │                                          │
│                              ▼                                          │
│                        ┌───────────┐                                    │
│                        │ COMPLETED │                                    │
│                        └───────────┘                                    │
│                                                                          │
│  TRANSITION RULES:                                                       │
│  ─────────────────────────────────────────────────────────────────────  │
│  │ Current State │ Allowed Next States                │ Blocked        │
│  ├───────────────┼────────────────────────────────────┼────────────────│
│  │ PENDING       │ AUTHORIZED, FAILED, EXPIRED        │ CAPTURED       │
│  │ AUTHORIZED    │ CAPTURED, FAILED, CANCELLED        │ PENDING        │
│  │ CAPTURED      │ COMPLETED                          │ AUTHORIZED     │
│  │ COMPLETED     │ (terminal)                         │ ALL            │
│  │ FAILED        │ (terminal)                         │ ALL            │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                          │
│  EVENT SEQUENCING:                                                       │
│  Each event has sequence_number. Only process if:                        │
│  incoming_sequence > current_sequence                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5. CQRS Pattern - Totals Service (Solves DB Overload)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CQRS - COMMAND QUERY SEPARATION                       │
│                                                                          │
│  ┌────────────────────────────┐    ┌────────────────────────────────┐  │
│  │      COMMAND SIDE          │    │         QUERY SIDE              │  │
│  │   (Pledge Service)         │    │      (Totals Service)           │  │
│  │                            │    │                                  │  │
│  │  POST /pledges             │    │  GET /campaigns/:id/totals      │  │
│  │  PUT /pledges/:id          │    │  GET /campaigns/:id/donors      │  │
│  │                            │    │                                  │  │
│  │  ┌──────────────────┐     │    │  ┌──────────────────────────┐   │  │
│  │  │   Write Model    │     │    │  │     Read Model           │   │  │
│  │  │   (PostgreSQL)   │     │    │  │ (Redis + Materialized)   │   │  │
│  │  │                  │     │    │  │                          │   │  │
│  │  │  Normalized      │     │    │  │  Pre-computed totals     │   │  │
│  │  │  Full pledge     │     │    │  │  Denormalized views      │   │  │
│  │  │  records         │     │    │  │  Cached aggregations     │   │  │
│  │  └────────┬─────────┘     │    │  └──────────────────────────┘   │  │
│  └───────────┼───────────────┘    └────────────────▲─────────────────┘  │
│              │                                      │                    │
│              │         DOMAIN EVENTS                │                    │
│              │  ┌───────────────────────────────┐  │                    │
│              └─▶│      MESSAGE QUEUE            │──┘                    │
│                 │                               │                        │
│                 │  • pledge.created             │                        │
│                 │  • pledge.captured            │                        │
│                 │  • pledge.completed           │                        │
│                 └───────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────┘

READ MODEL UPDATE FLOW:
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                          │
│   Event: pledge.captured {campaign_id: 1, amount: 100}                  │
│                                    │                                     │
│                                    ▼                                     │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │  TOTALS SERVICE (Event Consumer)                                 │  │
│   │                                                                  │  │
│   │  1. Validate event (idempotency check)                          │  │
│   │  2. INCR campaign:1:total_amount 100   (Redis atomic)           │  │
│   │  3. INCR campaign:1:donor_count 1                               │  │
│   │  4. UPDATE materialized view (async)                            │  │
│   └─────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│   GET /campaigns/1/totals                                               │
│                    │                                                     │
│                    ▼                                                     │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │  INSTANT RESPONSE (No aggregation query!)                        │  │
│   │                                                                  │  │
│   │  {                                                               │  │
│   │    "campaign_id": 1,                                            │  │
│   │    "total_raised": 50000,    ← From Redis                       │  │
│   │    "donor_count": 342,       ← From Redis                       │  │
│   │    "last_updated": "..."     ← Pre-computed                     │  │
│   │  }                                                               │  │
│   └─────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6. Complete Request Flow (Donation Journey)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE DONATION FLOW                                │
│                                                                          │
│  STEP 1: Donor initiates pledge                                         │
│  ──────────────────────────────────────────────────────────────────────│
│                                                                          │
│   Donor ──POST /api/pledges──▶ API Gateway ──▶ Pledge Service           │
│                                                      │                   │
│                                                      ▼                   │
│                                    ┌────────────────────────────────┐   │
│                                    │ BEGIN TRANSACTION              │   │
│                                    │ 1. INSERT pledge (PENDING)     │   │
│                                    │ 2. INSERT outbox_event         │   │
│                                    │ COMMIT                         │   │
│                                    └────────────────────────────────┘   │
│                                                      │                   │
│                                                      ▼                   │
│                                    ┌────────────────────────────────┐   │
│                                    │ Return pledge_id + payment_url │   │
│                                    └────────────────────────────────┘   │
│                                                                          │
│  STEP 2: Payment processing                                             │
│  ──────────────────────────────────────────────────────────────────────│
│                                                                          │
│   Donor ──Redirected──▶ Payment Provider (Stripe/SSLCommerz)            │
│                              │                                           │
│                              ▼                                           │
│   Payment Provider ──Webhook──▶ Payment Service                         │
│                                       │                                  │
│                                       ▼                                  │
│                    ┌─────────────────────────────────────────────────┐  │
│                    │ 1. CHECK idempotency key (Redis)                │  │
│                    │    IF duplicate → return 200, skip              │  │
│                    │                                                 │  │
│                    │ 2. VALIDATE state transition                    │  │
│                    │    IF invalid → log warning, return 200         │  │
│                    │                                                 │  │
│                    │ 3. UPDATE pledge status                         │  │
│                    │ 4. INSERT outbox_event                          │  │
│                    │ 5. SET idempotency key with TTL                 │  │
│                    └─────────────────────────────────────────────────┘  │
│                                                                          │
│  STEP 3: Totals update (Async)                                          │
│  ──────────────────────────────────────────────────────────────────────│
│                                                                          │
│   Outbox Poller ──Event──▶ Message Queue ──▶ Totals Service             │
│                                                      │                   │
│                                                      ▼                   │
│                    ┌─────────────────────────────────────────────────┐  │
│                    │ 1. CHECK event idempotency (processed?)         │  │
│                    │ 2. INCR Redis counters (atomic)                 │  │
│                    │ 3. UPDATE materialized views                    │  │
│                    │ 4. MARK event as processed                      │  │
│                    └─────────────────────────────────────────────────┘  │
│                                                                          │
│  STEP 4: Real-time display                                              │
│  ──────────────────────────────────────────────────────────────────────│
│                                                                          │
│   Browser ──GET /api/campaigns/1/totals──▶ Totals Service               │
│                                                  │                       │
│                                                  ▼                       │
│                                    ┌────────────────────────────┐       │
│                                    │ GET campaign:1:total       │       │
│                                    │ from Redis (< 1ms)         │       │
│                                    └────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Observability Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      OBSERVABILITY STACK                                 │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐  │
│   │                     ALL MICROSERVICES                            │  │
│   │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │  │
│   │  │  Metrics  │  │  Logs     │  │  Traces   │  │  Events   │    │  │
│   │  │  Endpoint │  │  (JSON)   │  │  (OTLP)   │  │  (Audit)  │    │  │
│   │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘    │  │
│   └────────┼──────────────┼──────────────┼──────────────┼───────────┘  │
│            │              │              │              │               │
│            ▼              ▼              ▼              ▼               │
│   ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐      │
│   │ Prometheus │  │  Logstash  │  │   Jaeger   │  │Elasticsearch│     │
│   │            │  │            │  │            │  │            │      │
│   │ - Metrics  │  │ - Parse    │  │ - Traces   │  │ - Store    │      │
│   │ - Alerts   │  │ - Filter   │  │ - Spans    │  │ - Search   │      │
│   │ - Rules    │  │ - Forward  │  │ - Context  │  │ - Analyze  │      │
│   └──────┬─────┘  └──────┬─────┘  └────────────┘  └──────┬─────┘      │
│          │               │                               │             │
│          ▼               └───────────────────────────────┘             │
│   ┌────────────┐                        │                              │
│   │  Grafana   │◀───────────────────────┘                              │
│   │            │                                                        │
│   │ Dashboards:│                                                        │
│   │ - Donations/min                                                    │
│   │ - Error rates                                                      │
│   │ - Latency P99                                                      │
│   │ - Campaign totals                                                  │
│   │ - Failed webhooks                                                  │
│   └────────────┘                                                        │
└─────────────────────────────────────────────────────────────────────────┘

DISTRIBUTED TRACING EXAMPLE:
┌─────────────────────────────────────────────────────────────────────────┐
│  Trace ID: abc-123-def-456                                              │
│                                                                          │
│  ├── API Gateway (2ms)                                                  │
│  │   └── Pledge Service (45ms)                                          │
│  │       ├── DB Write (12ms)                                            │
│  │       ├── Outbox Write (3ms)                                         │
│  │       └── Response (1ms)                                             │
│  │                                                                       │
│  ├── Payment Webhook (async, 150ms)                                     │
│  │   ├── Idempotency Check (1ms)                                        │
│  │   ├── State Validation (2ms)                                         │
│  │   ├── DB Update (8ms)                                                │
│  │   └── Event Publish (5ms)                                            │
│  │                                                                       │
│  └── Totals Update (async, 25ms)                                        │
│      ├── Redis INCR (1ms)                                               │
│      └── Cache Update (3ms)                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

### User Service
```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE,
    password_hash   VARCHAR(255),
    name            VARCHAR(255),
    role            VARCHAR(20) DEFAULT 'donor', -- donor, admin, campaign_owner
    is_guest        BOOLEAN DEFAULT false,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sessions (
    id              UUID PRIMARY KEY,
    user_id         UUID REFERENCES users(id),
    token           VARCHAR(500),
    expires_at      TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW()
);
```

### Campaign Service
```sql
CREATE TABLE campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id        UUID REFERENCES users(id),
    title           VARCHAR(255) NOT NULL,
    description     TEXT,
    goal_amount     DECIMAL(12,2) NOT NULL,
    category        VARCHAR(50),
    status          VARCHAR(20) DEFAULT 'active', -- draft, active, completed, cancelled
    start_date      TIMESTAMP,
    end_date        TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    version         INTEGER DEFAULT 1 -- Optimistic locking
);

CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_owner ON campaigns(owner_id);
```

### Pledge Service
```sql
CREATE TABLE pledges (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id         UUID NOT NULL,
    donor_id            UUID, -- NULL for guest donations
    donor_email         VARCHAR(255),
    donor_name          VARCHAR(255),
    amount              DECIMAL(12,2) NOT NULL,
    currency            VARCHAR(3) DEFAULT 'BDT',
    status              VARCHAR(20) DEFAULT 'pending',
    -- Status: pending → authorized → captured → completed
    --         pending → failed
    --         authorized → failed/cancelled
    payment_provider    VARCHAR(50),
    payment_reference   VARCHAR(255),
    idempotency_key     VARCHAR(255) UNIQUE,
    sequence_number     INTEGER DEFAULT 0,
    metadata            JSONB,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);

-- OUTBOX TABLE (Transactional Outbox Pattern)
CREATE TABLE outbox_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type  VARCHAR(50) NOT NULL,
    aggregate_id    UUID NOT NULL,
    event_type      VARCHAR(50) NOT NULL,
    payload         JSONB NOT NULL,
    published       BOOLEAN DEFAULT false,
    created_at      TIMESTAMP DEFAULT NOW(),
    published_at    TIMESTAMP
);

CREATE INDEX idx_outbox_unpublished ON outbox_events(published) WHERE published = false;
CREATE INDEX idx_pledges_campaign ON pledges(campaign_id);
CREATE INDEX idx_pledges_status ON pledges(status);
```

### Totals Service (Read Model)
```sql
-- Materialized view for complex queries
CREATE MATERIALIZED VIEW campaign_totals AS
SELECT
    campaign_id,
    COUNT(*) FILTER (WHERE status = 'completed') as donor_count,
    COALESCE(SUM(amount) FILTER (WHERE status = 'completed'), 0) as total_raised,
    MAX(updated_at) as last_donation_at
FROM pledges
GROUP BY campaign_id;

-- Redis keys for real-time counters:
-- campaign:{id}:total_amount (INCR/DECR)
-- campaign:{id}:donor_count (INCR/DECR)
-- campaign:{id}:pending_count (INCR/DECR)
```

### Payment Service
```sql
CREATE TABLE payment_webhooks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id          VARCHAR(255) UNIQUE NOT NULL, -- Idempotency key
    provider            VARCHAR(50) NOT NULL,
    event_type          VARCHAR(50) NOT NULL,
    payload             JSONB NOT NULL,
    pledge_id           UUID,
    processed           BOOLEAN DEFAULT false,
    processed_at        TIMESTAMP,
    created_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payment_state_transitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pledge_id       UUID NOT NULL,
    from_state      VARCHAR(20),
    to_state        VARCHAR(20) NOT NULL,
    triggered_by    VARCHAR(255), -- webhook_id or system
    created_at      TIMESTAMP DEFAULT NOW()
);
```

---

## API Endpoints

### User Service (Port 3001)
```
POST   /api/users/register     - Register new user
POST   /api/users/login        - Authenticate user
POST   /api/users/guest        - Create guest session
GET    /api/users/me           - Get current user profile
PUT    /api/users/me           - Update profile
GET    /api/users/:id/donations - Get user donation history
```

### Campaign Service (Port 3002)
```
GET    /api/campaigns          - List campaigns (paginated)
GET    /api/campaigns/:id      - Get campaign details
POST   /api/campaigns          - Create campaign (auth required)
PUT    /api/campaigns/:id      - Update campaign
DELETE /api/campaigns/:id      - Cancel campaign
GET    /api/campaigns/:id/totals - Get campaign totals (from Totals Service)
```

### Pledge Service (Port 3003)
```
POST   /api/pledges            - Create new pledge
GET    /api/pledges/:id        - Get pledge status
GET    /api/pledges/campaign/:id - List pledges for campaign
GET    /api/pledges/donor/:id  - List pledges by donor

Request Headers:
  Idempotency-Key: <unique-key>  - Prevents duplicate pledges
```

### Payment Service (Port 3004)
```
POST   /api/payments/webhook/:provider  - Receive payment webhooks
GET    /api/payments/status/:pledge_id  - Get payment status
POST   /api/payments/initiate           - Initialize payment (internal)

Webhook Signature Verification:
  X-Webhook-Signature: <hmac-signature>
```

### Totals Service (Port 3005)
```
GET    /api/totals/campaign/:id     - Get real-time campaign totals
GET    /api/totals/leaderboard      - Get top campaigns
GET    /api/totals/stats            - Get platform-wide statistics
```

### Admin Service (Port 3006)
```
GET    /api/admin/campaigns         - List all campaigns
PUT    /api/admin/campaigns/:id     - Moderate campaign
GET    /api/admin/pledges           - View all pledges
GET    /api/admin/webhooks          - View webhook logs
GET    /api/admin/metrics           - View system metrics
```

---

## Docker Compose Architecture

```yaml
# Simplified view of service scaling
services:
  # Gateway
  nginx:
    image: nginx:alpine
    ports: ["80:80"]
    depends_on: [user-service, campaign-service, pledge-service]

  # Core Services (scalable)
  user-service:
    build: ./services/user
    deploy:
      replicas: 2
    environment:
      - DATABASE_URL=postgres://...

  campaign-service:
    build: ./services/campaign
    deploy:
      replicas: 2

  pledge-service:
    build: ./services/pledge
    deploy:
      replicas: 3  # Higher load expected

  payment-service:
    build: ./services/payment
    deploy:
      replicas: 2

  totals-service:
    build: ./services/totals
    deploy:
      replicas: 2

  # Data Layer
  postgres:
    image: postgres:15
    volumes: [postgres_data:/var/lib/postgresql/data]

  redis:
    image: redis:7-alpine

  rabbitmq:
    image: rabbitmq:3-management

  # Observability
  prometheus:
    image: prom/prometheus

  grafana:
    image: grafana/grafana

  jaeger:
    image: jaegertracing/all-in-one

  elasticsearch:
    image: elasticsearch:8.11.0
```

---

## Failure Scenarios Handled

| Scenario | Protection Mechanism |
|----------|---------------------|
| Duplicate webhook delivery | Idempotency key in Redis with 24h TTL |
| DB write succeeds, event publish fails | Transactional Outbox pattern |
| Out-of-order webhook events | State machine + sequence numbers |
| Totals endpoint overload | CQRS with pre-computed read model |
| Service crash mid-transaction | Atomic DB transactions + retry |
| Message queue unavailable | Outbox poller with exponential backoff |
| Redis cache failure | Fallback to materialized view |
| Network partition | Saga pattern for distributed transactions |

---

## Scalability Strategy

```
                    Load Balancer (nginx)
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │ Service    │  │ Service    │  │ Service    │
    │ Replica 1  │  │ Replica 2  │  │ Replica 3  │
    └──────┬─────┘  └──────┬─────┘  └──────┬─────┘
           │               │               │
           └───────────────┼───────────────┘
                           │
                    Shared State Layer
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌────────────┐  ┌────────────┐  ┌────────────┐
    │ PostgreSQL │  │   Redis    │  │  RabbitMQ  │
    │ (Primary)  │  │ (Cluster)  │  │ (Cluster)  │
    └────────────┘  └────────────┘  └────────────┘

Docker Compose Scaling:
  docker-compose up --scale pledge-service=5 --scale payment-service=3
```

This architecture ensures the system can handle 1000+ requests/second while maintaining data consistency and fault tolerance.
