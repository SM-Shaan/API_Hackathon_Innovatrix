# CareForAll - Next-Generation Donation Platform

A production-grade microservices-based donation platform built for the **API Avengers Microservice Hackathon** (November 21, 2025).

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Services](#services)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Key Features](#key-features)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [Testing](#testing)
- [CI/CD Pipeline](#cicd-pipeline)
- [Observability](#observability)
- [Contributing](#contributing)

---

## Overview

CareForAll is a modern donation platform that enables users to create campaigns, accept donations, and track fundraising progress in real-time. Built on a microservices architecture, it demonstrates production-grade patterns including:

- **Idempotent API Design** - Prevents duplicate donations
- **Transactional Outbox Pattern** - Guarantees event delivery
- **Payment State Machine** - Ensures correct payment state transitions
- **CQRS Pattern** - Optimized read models for real-time totals
- **Event-Driven Architecture** - Asynchronous service communication

---

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                     CLIENTS                                              │
│                      Web Browser  │  Mobile App  │  Admin Panel                          │
└────────────────────────────────────────┬────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              USER FRONTEND (Next.js)                                     │
│                                   Port: 8080                                             │
│              Campaign Browsing  │  Donation Form  │  Real-time Updates                   │
└────────────────────────────────────────┬────────────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY (Nginx)                                         │
│                                   Port: 8081                                             │
│    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│    │ Rate Limiting│  │Load Balancing│  │ Health Check │  │   Routing    │               │
│    │  (100 r/s)   │  │ (least_conn) │  │ (max_fails=3)│  │  (/api/*)    │               │
│    └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘               │
└───────┬─────────────┬─────────────┬─────────────┬─────────────┬─────────────┬───────────┘
        │             │             │             │             │             │
        ▼             ▼             ▼             ▼             ▼             ▼
┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐
│   USER    │  │ CAMPAIGN  │  │  PLEDGE   │  │  PAYMENT  │  │  TOTALS   │  │  NOTIF    │
│  SERVICE  │  │  SERVICE  │  │  SERVICE  │  │  SERVICE  │  │  SERVICE  │  │  SERVICE  │
│  :3001    │  │  :3002    │  │  :3003    │  │  :3004    │  │  :3005    │  │  :3006    │
│ ───────── │  │ ───────── │  │ ───────── │  │ ───────── │  │ ───────── │  │ ───────── │
│ • Auth    │  │ • CRUD    │  │ • Idempt. │  │ • State   │  │ • CQRS    │  │ • Email   │
│ • JWT     │  │ • Events  │  │ • Outbox  │  │   Machine │  │ • Cache   │  │ • WebSock │
│ • Roles   │  │ • Status  │  │ • Events  │  │ • Webhook │  │ • Stats   │  │ • Push    │
│ (×2)      │  │ (×2)      │  │ (×3)      │  │ (×2)      │  │ (×2)      │  │ (×2)      │
└─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘
      │              │              │              │              │              │
      └──────────────┴──────────────┼──────────────┴──────────────┴──────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  PostgreSQL   │         │      Redis      │         │  Redis Pub/Sub  │
│   Port:5432   │         │   Port: 6379    │         │   Event Bus     │
│ ───────────── │         │ ─────────────── │         │ ─────────────── │
│ • Users       │         │ • Idempotency   │         │ • pledge.created│
│ • Campaigns   │         │ • Session Cache │         │ • pledge.done   │
│ • Pledges     │         │ • Totals Cache  │         │ • payment.auth  │
│ • Payments    │         │ • Locks         │         │ • payment.done  │
│ • Outbox      │         │                 │         │                 │
└───────────────┘         └─────────────────┘         └─────────────────┘
```

### Core Pattern: Transactional Outbox (Prevents Lost Donations)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                           TRANSACTIONAL OUTBOX PATTERN                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│   1. User Request                                                                        │
│         │                                                                                │
│         ▼                                                                                │
│   ┌─────────────────────────────────────────────────────────────────────┐               │
│   │                    SINGLE DATABASE TRANSACTION                       │               │
│   │                                                                      │               │
│   │   BEGIN TRANSACTION                                                  │               │
│   │      │                                                               │               │
│   │      ├──► INSERT INTO pledges (amount, donor_id, ...)               │               │
│   │      │                                                               │               │
│   │      └──► INSERT INTO outbox_events (event_type, payload, ...)      │               │
│   │                                                                      │               │
│   │   COMMIT  ◄── Both succeed OR both rollback (atomic)                │               │
│   └─────────────────────────────────────────────────────────────────────┘               │
│         │                                                                                │
│         │ Response to user (immediate)                                                   │
│         ▼                                                                                │
│   ┌─────────────────────────────────────────────────────────────────────┐               │
│   │                    OUTBOX WORKER (Background)                        │               │
│   │                                                                      │               │
│   │   Every 1 second:                                                    │               │
│   │      │                                                               │               │
│   │      ├──► SELECT * FROM outbox_events WHERE published = FALSE       │               │
│   │      │                                                               │               │
│   │      ├──► redis.publish('events', eventJSON)                        │               │
│   │      │                                                               │               │
│   │      └──► UPDATE outbox_events SET published = TRUE                 │               │
│   └─────────────────────────────────────────────────────────────────────┘               │
│         │                                                                                │
│         ▼                                                                                │
│   ┌─────────────────────────────────────────────────────────────────────┐               │
│   │                    EVENT SUBSCRIBERS                                 │               │
│   │                                                                      │               │
│   │   Totals Service ──► Updates campaign totals in Redis cache         │               │
│   │   Notification Service ──► Sends email + WebSocket push             │               │
│   └─────────────────────────────────────────────────────────────────────┘               │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Payment State Machine (Prevents Corruption)

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                            PAYMENT STATE MACHINE                                         │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│                                 ┌─────────┐                                              │
│                                 │ PENDING │                                              │
│                                 └────┬────┘                                              │
│                                      │                                                   │
│                    ┌─────────────────┼─────────────────┐                                 │
│                    │                 │                 │                                 │
│                    ▼                 ▼                 ▼                                 │
│              ┌──────────┐     ┌───────────┐                                              │
│              │  FAILED  │     │AUTHORIZED │                                              │
│              └──────────┘     └─────┬─────┘                                              │
│                                     │                                                    │
│                    ┌────────────────┼────────────────┐                                   │
│                    │                │                │                                   │
│                    ▼                ▼                ▼                                   │
│              ┌──────────┐     ┌──────────┐     ┌──────────┐                              │
│              │  FAILED  │     │ CAPTURED │     │CANCELLED │                              │
│              └──────────┘     └────┬─────┘     └──────────┘                              │
│                                    │                                                     │
│                                    ▼                                                     │
│                              ┌───────────┐                                               │
│                              │ COMPLETED │                                               │
│                              └─────┬─────┘                                               │
│                                    │                                                     │
│                                    ▼                                                     │
│                              ┌──────────┐                                                │
│                              │ REFUNDED │                                                │
│                              └──────────┘                                                │
│                                                                                          │
│   RULES:                                                                                 │
│   ├── ✓ Forward transitions only (PENDING → AUTHORIZED → CAPTURED → COMPLETED)          │
│   ├── ✗ Backward transitions blocked (CAPTURED → AUTHORIZED = REJECTED)                 │
│   ├── ✓ Can fail from any non-terminal state                                            │
│   └── ✓ REFUNDED only from COMPLETED state                                              │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Complete Donation Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              COMPLETE DONATION FLOW                                      │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│  ① DONOR CREATES PLEDGE                                                                  │
│  ───────────────────────                                                                 │
│                                                                                          │
│      Donor ──POST /api/pledges──► Gateway ──► Pledge Service                            │
│      (Idempotency-Key: abc123)                     │                                     │
│                                                    ▼                                     │
│                                    ┌────────────────────────────┐                       │
│                                    │ Check Idempotency (Redis)  │                       │
│                                    │ New? → Process             │                       │
│                                    │ Duplicate? → Return cached │                       │
│                                    └──────────────┬─────────────┘                       │
│                                                   │                                      │
│                                                   ▼                                      │
│                                    ┌────────────────────────────┐                       │
│                                    │ BEGIN TRANSACTION          │                       │
│                                    │ • INSERT pledge            │                       │
│                                    │ • INSERT outbox_event      │                       │
│                                    │ COMMIT                     │                       │
│                                    └──────────────┬─────────────┘                       │
│                                                   │                                      │
│      Donor ◄───────── { pledge_id, status } ──────┘                                     │
│                                                                                          │
│  ② OUTBOX WORKER PUBLISHES EVENT                                                         │
│  ───────────────────────────────                                                         │
│                                                                                          │
│      Outbox Worker ──SELECT unpublished──► PostgreSQL                                   │
│           │                                                                              │
│           └──PUBLISH 'events'──► Redis Pub/Sub                                          │
│                                       │                                                  │
│                    ┌──────────────────┼──────────────────┐                              │
│                    │                  │                  │                              │
│                    ▼                  ▼                  ▼                              │
│             ┌───────────┐     ┌─────────────┐    ┌──────────────┐                       │
│             │ Totals    │     │ Notification│    │ Payment      │                       │
│             │ Service   │     │ Service     │    │ Service      │                       │
│             └─────┬─────┘     └──────┬──────┘    └──────┬───────┘                       │
│                   │                  │                  │                               │
│                   ▼                  ▼                  ▼                               │
│             Update Redis       Send Email         Process                               │
│             Totals Cache       + WebSocket        Payment                               │
│                                                                                          │
│  ③ REAL-TIME UPDATE                                                                      │
│  ──────────────────                                                                      │
│                                                                                          │
│      Browser ◄──WebSocket──► Notification Service                                       │
│         │                                                                                │
│         └──► Campaign total updates instantly on screen                                 │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Observability Stack

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              OBSERVABILITY ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                          │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐   │
│   │                            ALL MICROSERVICES                                     │   │
│   │                                                                                  │   │
│   │    /metrics ────► Prometheus Metrics (http_requests_total, latency)             │   │
│   │    stdout   ────► JSON Logs (Pino structured logging)                           │   │
│   │    traces   ────► OpenTelemetry Spans (request tracing)                         │   │
│   └───────┬──────────────────────────┬────────────────────────────┬─────────────────┘   │
│           │                          │                            │                      │
│           ▼                          ▼                            ▼                      │
│   ┌───────────────┐          ┌───────────────┐           ┌───────────────┐              │
│   │  Prometheus   │          │ Elasticsearch │           │    Jaeger     │              │
│   │  Port: 9090   │          │  Port: 9200   │           │  Port: 16686  │              │
│   │ ───────────── │          │ ───────────── │           │ ───────────── │              │
│   │ Time-series   │          │ Log storage   │           │ Trace storage │              │
│   │ metrics DB    │          │ Full-text     │           │ Span analysis │              │
│   └───────┬───────┘          └───────┬───────┘           └───────┬───────┘              │
│           │                          │                           │                       │
│           ▼                          ▼                           ▼                       │
│   ┌───────────────┐          ┌───────────────┐           ┌───────────────┐              │
│   │   Grafana     │          │    Kibana     │           │  Jaeger UI    │              │
│   │  Port: 3000   │          │  Port: 5601   │           │  Port: 16686  │              │
│   │ ───────────── │          │ ───────────── │           │ ───────────── │              │
│   │ Dashboards    │          │ Log explorer  │           │ Trace viewer  │              │
│   │ Alerts        │          │ Search        │           │ Dependencies  │              │
│   └───────────────┘          └───────────────┘           └───────────────┘              │
│                                                                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### Problems Solved by Architecture

| Problem | Root Cause | Solution | Implementation |
|---------|------------|----------|----------------|
| **Double charging** | No idempotency | Idempotency keys + Redis cache | `pledge-service/src/idempotency.ts` |
| **Lost donations** | Event publish fails | Transactional Outbox Pattern | `pledge-service/src/outbox.ts` |
| **State corruption** | Out-of-order webhooks | Payment State Machine | `payment-service/src/state-machine.ts` |
| **Slow totals** | Real-time aggregation | CQRS + Pre-computed cache | `totals-service/src/service.ts` |
| **No visibility** | Missing observability | Prometheus + Grafana + Jaeger | `observability/` |
| **Service overload** | No rate limiting | Nginx rate limiting (100 r/s) | `gateway/nginx.conf` |

### Directory Structure

```
CareForAll/
├── services/
│   ├── user-service/          # Authentication & user management
│   ├── campaign-service/      # Campaign CRUD operations
│   ├── pledge-service/        # Donations with idempotency & outbox
│   ├── payment-service/       # Payment processing with state machine
│   ├── totals-service/        # CQRS read model for campaign totals
│   ├── notification-service/  # Email & WebSocket notifications
│   └── shared/                # Shared utilities and types
├── gateway/                   # Nginx API Gateway configuration
├── user-frontend/             # Next.js donation platform
├── frontend-visualize/        # Architecture monitoring dashboard
├── observability/             # Prometheus, Grafana, Filebeat configs
├── .github/workflows/         # CI/CD pipelines
├── tests/                     # Integration tests
├── docker-compose.yml         # Complete service orchestration
└── init-db.sql                # Database initialization script
```

---

## Technology Stack

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 20+ | Runtime environment |
| TypeScript | 5.9.3 | Type-safe development |
| Express.js | 4.18.2 | Web framework |
| PostgreSQL | 15 | Primary database |
| Redis | 7 | Caching & event bus |
| node-postgres | 8.11.3 | PostgreSQL client |

### Authentication & Security
| Technology | Version | Purpose |
|------------|---------|---------|
| bcryptjs | 2.4.3 | Password hashing |
| jsonwebtoken | 9.0.2 | JWT authentication |

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.0.3 | React framework |
| Tailwind CSS | 3.3.0 | Styling |
| Axios | 1.6.2 | HTTP client |
| socket.io-client | 4.7.4 | WebSocket client |

### Observability
| Technology | Purpose |
|------------|---------|
| Prometheus | Metrics collection |
| Grafana | Visualization dashboards |
| Jaeger | Distributed tracing |
| Pino | Structured logging |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Docker Compose | Multi-container orchestration |
| Nginx | API Gateway & Load Balancing |

---

## Services

### 1. User Service (Port 3001)

**Purpose:** Authentication and user management

**Features:**
- User registration with bcrypt password hashing
- JWT-based authentication (24-hour expiration)
- Role-based access control (ADMIN, DONOR)
- Profile management

**Key Files:**
- `services/user-service/src/routes.ts` - API endpoints
- `services/user-service/src/service.ts` - Business logic
- `services/user-service/src/repository.ts` - Database operations

---

### 2. Campaign Service (Port 3002)

**Purpose:** Campaign management and CRUD operations

**Features:**
- Create, read, update, delete campaigns
- Campaign status tracking (ACTIVE, COMPLETED, CANCELLED)
- Goal amount and progress tracking
- Event publishing for downstream services

**Key Files:**
- `services/campaign-service/src/routes.ts` - API endpoints
- `services/campaign-service/src/service.ts` - Business logic
- `services/campaign-service/src/events.ts` - Event publishing

---

### 3. Pledge Service (Port 3003)

**Purpose:** Donation/pledge handling with reliability guarantees

**Features:**
- **Idempotency Protection:** Prevents duplicate donations via idempotency keys
- **Transactional Outbox Pattern:** Guarantees event publication
- **Distributed Locking:** Prevents race conditions using Redis
- Status tracking: PENDING → PROCESSING → COMPLETED/FAILED

**Idempotency Flow:**
```
1. Client sends POST /pledges with Idempotency-Key header
2. Service checks Redis for existing key
3. If exists: Return cached response (prevents duplicate)
4. If new: Process donation, cache response for 24 hours
```

**Outbox Pattern Flow:**
```
1. BEGIN TRANSACTION
2. INSERT pledge INTO pledges
3. INSERT event INTO outbox_events
4. COMMIT
5. Background worker publishes event to Redis
6. Downstream services receive and process
```

**Key Files:**
- `services/pledge-service/src/idempotency.ts` - Idempotency service
- `services/pledge-service/src/outbox.ts` - Outbox repository
- `services/pledge-service/src/outbox-worker.ts` - Event publisher

---

### 4. Payment Service (Port 3004)

**Purpose:** Payment processing with state machine validation

**Features:**
- Strict state machine preventing invalid transitions
- Idempotent webhook processing
- Backward transition blocking (prevents corruption)
- Support for multiple payment providers

**State Machine:**
```
PENDING → AUTHORIZED → CAPTURED → COMPLETED
   ↓          ↓           ↓
   └──────────┴───────────┴──→ FAILED

COMPLETED → REFUNDED (terminal)
```

**Valid Transitions:**
| From State | Allowed Transitions |
|------------|---------------------|
| PENDING | AUTHORIZED, FAILED |
| AUTHORIZED | CAPTURED, FAILED |
| CAPTURED | COMPLETED, FAILED |
| COMPLETED | REFUNDED |
| FAILED | (terminal) |
| REFUNDED | (terminal) |

**Key Files:**
- `services/payment-service/src/state-machine.ts` - State machine logic
- `services/payment-service/src/service.ts` - Payment processing

---

### 5. Totals Service (Port 3005)

**Purpose:** CQRS Read Model for real-time campaign totals

**Features:**
- Separate read model from write operations
- Event-driven updates via Redis pub/sub
- Pre-computed totals for sub-millisecond responses
- Platform-wide statistics

**How It Works:**
```
1. Subscribes to pledge.completed events
2. Updates cached totals in real-time
3. Provides instant read access
4. No expensive aggregation queries
```

**Key Files:**
- `services/totals-service/src/event-subscriber.ts` - Event listener
- `services/totals-service/src/service.ts` - Totals calculation

---

### 6. Notification Service (Port 3006)

**Purpose:** Email and real-time WebSocket notifications

**Features:**
- SMTP email notifications (Gmail configured)
- WebSocket real-time push notifications
- Notification history with read tracking
- Event-driven notification triggers

**Notification Types:**
- New campaign created
- Donation received
- Payment status updates
- Campaign goal reached

**Key Files:**
- `services/notification-service/src/email.ts` - SMTP service
- `services/notification-service/src/websocket.ts` - WebSocket manager

---

## API Endpoints

### Base URL: `http://localhost:8081/api`

### User Service (`/users`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/users/register` | Register new user | No |
| POST | `/users/login` | Authenticate user | No |
| POST | `/users/verify` | Verify JWT token | No |
| GET | `/users/me` | Get current user profile | Yes |
| GET | `/users/:id` | Get user by ID | No |
| PUT | `/users/:id` | Update user | Yes |

### Campaign Service (`/campaigns`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/campaigns` | List all campaigns | No |
| POST | `/campaigns` | Create campaign | Yes (Admin) |
| GET | `/campaigns/:id` | Get campaign details | No |
| PUT | `/campaigns/:id` | Update campaign | Yes |
| DELETE | `/campaigns/:id` | Delete campaign | Yes |
| GET | `/campaigns/stats` | Campaign statistics | Yes (Admin) |

### Pledge Service (`/pledges`)

| Method | Endpoint | Description | Auth | Headers |
|--------|----------|-------------|------|---------|
| POST | `/pledges` | Create pledge | Yes | `Idempotency-Key: <unique-key>` |
| GET | `/pledges/:id` | Get pledge details | No | |
| GET | `/pledges/campaign/:id` | Get pledges by campaign | No | |
| GET | `/pledges/donor/me` | Get my pledges | Yes | |

### Payment Service (`/payments`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/payments` | Initiate payment | Yes |
| POST | `/payments/webhook` | Webhook handler | Signature |
| GET | `/payments/:id` | Get payment status | No |
| GET | `/payments/state-machine/info` | State machine details | No |

### Totals Service (`/totals`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/totals` | Get all campaign totals |
| GET | `/totals/campaign/:id` | Get specific campaign total |
| GET | `/totals/stats` | Platform statistics |
| POST | `/totals/rebuild` | Rebuild all totals (admin) |

### Notification Service (`/notifications`)

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/notifications` | List notifications | Yes |
| GET | `/notifications/unread/count` | Unread count | Yes |
| POST | `/notifications/:id/read` | Mark as read | Yes |

### Health Check Endpoints

All services expose health endpoints:
- `GET http://localhost:300X/health` - Returns service health status
- `GET http://localhost:300X/metrics` - Prometheus metrics

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'DONOR',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Campaigns Table
```sql
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  goal_amount DECIMAL(15, 2) NOT NULL,
  current_amount DECIMAL(15, 2) DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
  owner_id UUID NOT NULL,
  image_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Pledges Table
```sql
CREATE TABLE pledges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL,
  donor_id UUID,
  donor_email VARCHAR(255) NOT NULL,
  donor_name VARCHAR(255) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Outbox Events Table
```sql
CREATE TABLE outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(100) NOT NULL,
  aggregate_id UUID NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Payments Table
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pledge_id UUID NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  state VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  provider VARCHAR(50) NOT NULL DEFAULT 'stripe',
  provider_payment_id VARCHAR(255),
  provider_ref VARCHAR(255),
  idempotency_key VARCHAR(255) UNIQUE NOT NULL,
  failure_reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Webhook Events Table
```sql
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID REFERENCES payments(id),
  webhook_id VARCHAR(255) UNIQUE NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  provider VARCHAR(50) NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Notifications Table
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  read BOOLEAN DEFAULT FALSE,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## Key Features

### 1. Bulletproof Donations with Idempotency

**Problem:** Duplicate donations from network retries or double-clicks

**Solution:**
```http
POST /api/pledges
Headers:
  Authorization: Bearer <token>
  Idempotency-Key: donation-12345

Body:
{
  "campaign_id": "uuid",
  "amount": 100,
  "donor_name": "John Doe"
}
```

- First request: Processes donation, caches result
- Duplicate request (same key): Returns cached result immediately
- Different key: Processes as new donation

### 2. Transactional Outbox Pattern

**Problem:** Lost events if service crashes after database write

**Solution:**
- Pledge and outbox event written in same transaction
- Background worker polls and publishes events
- Events marked as published and cleaned up

**Guarantees:**
- At-least-once delivery
- No lost events on crashes
- Eventual consistency across services

### 3. Payment State Machine

**Problem:** Payment state corruption from out-of-order webhooks

**Solution:**
- Explicit state transitions with validation
- Backward transitions rejected
- Idempotent webhook processing

### 4. CQRS Read Model

**Problem:** Expensive aggregation queries for campaign totals

**Solution:**
- Dedicated read model (totals-service)
- Pre-computed totals updated on events
- Sub-millisecond response times

### 5. Real-Time Notifications

**Features:**
- Email notifications via SMTP
- WebSocket push for instant updates
- Notification history with read tracking

---

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)
- Git

### Quick Start

1. **Clone the repository:**
```bash
git clone https://github.com/your-org/careforall.git
cd careforall
```

2. **Start all services:**
```bash
docker-compose up --build
```

3. **Wait for services to initialize** (2-3 minutes)

4. **Access the application:**
- Frontend: http://localhost:8080
- API Gateway: http://localhost:8081/api
- Grafana: http://localhost:3000 (admin/admin)
- Prometheus: http://localhost:9090
- Jaeger: http://localhost:16686

### Verify Services

```bash
# Check all services are running
docker-compose ps

# Test health endpoints
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:3005/health
curl http://localhost:3006/health
```

### Default Admin User

```
Email: admin@careforall.com
Password: admin123
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | postgres |
| `DB_PORT` | PostgreSQL port | 5432 |
| `DB_NAME` | Database name | careforall |
| `DB_USER` | Database user | postgres |
| `DB_PASSWORD` | Database password | postgres |
| `REDIS_URL` | Redis connection URL | redis://redis:6379 |
| `JWT_SECRET` | JWT signing secret | (change in production) |
| `SMTP_HOST` | SMTP server host | smtp.gmail.com |
| `SMTP_PORT` | SMTP server port | 587 |
| `SMTP_USER` | SMTP username | - |
| `SMTP_PASS` | SMTP password | - |

### Service Ports

| Service | Port |
|---------|------|
| User Frontend | 8080 |
| API Gateway | 8081 |
| User Service | 3001 |
| Campaign Service | 3002 |
| Pledge Service | 3003 |
| Payment Service | 3004 |
| Totals Service | 3005 |
| Notification Service | 3006 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| Prometheus | 9090 |
| Grafana | 3000 |
| Jaeger | 16686 |

---

## Testing

### Unit Tests

Each service has its own test suite:

```bash
# Run tests for a specific service
cd services/user-service
npm test

# Run with coverage
npm run test -- --coverage
```

### Test Files

- `services/user-service/src/__tests__/service.test.ts`
- `services/pledge-service/src/__tests__/idempotency.test.ts`
- `services/pledge-service/src/__tests__/service.test.ts`
- `services/payment-service/src/__tests__/state-machine.test.ts`
- `services/notification-service/src/__tests__/service.test.ts`

### Integration Tests

```bash
# Run complete flow test
./tests/test-complete-flow.sh

# Run donation flow test
./tests/test-donation-flow.sh

# Run stress test
node tests/stress-test.js
```

### Manual API Testing

Use the provided HTTP file with REST Client extension:
```
tests/api-testing.http
```

---

## CI/CD Pipeline

### GitHub Actions Workflows

#### CI Pipeline (`.github/workflows/ci.yml`)

**Triggers:**
- Push to `main` or `develop`
- Pull requests to `main`
- Manual trigger

**Jobs:**
1. **Change Detection** - Identifies modified services
2. **Test Jobs** - Parallel testing of changed services
3. **Docker Build** - Builds images for changed services

**Features:**
- Smart change detection (only tests modified services)
- Shared dependency detection
- Parallel test execution
- Docker image tagging with git SHA

#### Release Pipeline (`.github/workflows/release.yml`)

**Trigger:** Git tags matching `v*`

**Actions:**
- Builds all service images
- Tags with version number
- Creates GitHub release

---

## Observability

### Prometheus Metrics

All services expose metrics at `/metrics`:
- `http_requests_total` - Request count by method, route, status
- `http_request_duration_seconds` - Request latency distribution
- Standard Node.js metrics (memory, CPU, event loop)

### Grafana Dashboards

Access at http://localhost:3000 (admin/admin)

Pre-configured dashboards:
- Service health overview
- Request rate and latency
- Error rate monitoring
- Resource utilization

### Jaeger Tracing

Access at http://localhost:16686

Features:
- End-to-end request tracing
- Service dependency visualization
- Latency analysis per service

### Logging

Structured JSON logging with Pino:
- Correlation IDs for request tracing
- Log levels: info, warn, error, debug
- Filebeat integration for log aggregation

---

## API Gateway

### Nginx Configuration

**Features:**
- Load balancing (least connections)
- Rate limiting (100 req/s per IP)
- Gzip compression
- Health checks
- Connection pooling

**Rate Limiting:**
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
```

**Load Balancing:**
```nginx
upstream user_service {
    least_conn;
    server user-service:3001 max_fails=3 fail_timeout=30s;
    keepalive 32;
}
```

---

## Service Replicas

Default replica configuration:

| Service | Replicas |
|---------|----------|
| User Service | 2 |
| Campaign Service | 2 |
| Pledge Service | 3 |
| Payment Service | 2 |
| Totals Service | 2 |
| Notification Service | 2 |

---

## Authentication

### JWT Token Flow

1. **Registration/Login:** Returns JWT token
2. **Token Usage:** Include in `Authorization: Bearer <token>` header
3. **Verification:** All protected endpoints verify token
4. **Expiration:** 24 hours

### Token Payload

```json
{
  "userId": "uuid",
  "email": "user@example.com",
  "role": "DONOR",
  "iat": 1234567890,
  "exp": 1234654290
}
```

### Role-Based Access Control

| Role | Capabilities |
|------|-------------|
| DONOR | Create pledges, view campaigns, manage own profile |
| ADMIN | All DONOR capabilities + create/manage campaigns, view statistics |

---

## Architectural Patterns Summary

| Pattern | Service | Purpose | Technology |
|---------|---------|---------|------------|
| Idempotency | Pledge, Payment | Prevent duplicates | Redis cache |
| Outbox/Event Sourcing | Pledge | Reliable events | PostgreSQL + Redis |
| State Machine | Payment | Correct transitions | Enum + validation |
| CQRS | Totals | Fast reads | Separate read model |
| Circuit Breaker | Nginx | Fault tolerance | Health checks |
| Service Replication | All | High availability | Docker replicas |
| Event-Driven | All | Async communication | Redis pub/sub |
| JWT Auth | All | Secure access | jsonwebtoken |

---

## Project Statistics

- **Total Services:** 6 microservices
- **Database Tables:** 8 core tables
- **API Endpoints:** 30+ total endpoints
- **Test Suites:** 5+ test files
- **CI/CD Jobs:** 8 CI jobs + 1 release job

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and add tests
4. Run tests: `npm test`
5. Commit changes: `git commit -m "Add my feature"`
6. Push to branch: `git push origin feature/my-feature`
7. Create a Pull Request

### Code Style

- TypeScript strict mode
- ESLint for linting
- Prettier for formatting
- Meaningful commit messages

---

## License

This project was built for the API Avengers Microservice Hackathon.

---

## Team

**Team Innovatrix**

Built with dedication for the API Avengers Microservice Hackathon - November 2025
