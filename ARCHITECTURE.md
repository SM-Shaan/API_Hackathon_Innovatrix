# CareForAll - Microservice Architecture

## Overview
A fault-tolerant donation platform designed to handle 1000+ requests/second with proper idempotency, state management, and observability.

## Architecture Diagram

```
                                    ┌─────────────────┐
                                    │   Frontend      │
                                    │   (React/Vue)   │
                                    └────────┬────────┘
                                             │
                                             ▼
                                    ┌─────────────────┐
                                    │   API Gateway   │
                                    │   (Nginx/Kong)  │
                                    │   Port: 8080    │
                                    └────────┬────────┘
                                             │
           ┌─────────────┬─────────────┬─────┴─────┬─────────────┬─────────────┐
           ▼             ▼             ▼           ▼             ▼             ▼
    ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
    │   User     │ │  Campaign  │ │   Pledge   │ │  Payment   │ │   Totals   │ │Notification│
    │  Service   │ │  Service   │ │  Service   │ │  Service   │ │  Service   │ │  Service   │
    │  :3001     │ │  :3002     │ │  :3003     │ │  :3004     │ │  :3005     │ │  :3006     │
    └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
          │              │              │              │              │              │
          └──────────────┴──────────────┴──────┬───────┴──────────────┴──────────────┘
                                               │
                                               ▼
                              ┌─────────────────────────────────┐
                              │         Message Queue           │
                              │      (Redis/RabbitMQ)           │
                              └─────────────────────────────────┘
                                               │
           ┌───────────────────────────────────┼───────────────────────────────────┐
           ▼                                   ▼                                   ▼
    ┌────────────┐                      ┌────────────┐                      ┌────────────┐
    │ PostgreSQL │                      │   Redis    │                      │Elasticsearch│
    │  Database  │                      │   Cache    │                      │   Logs     │
    └────────────┘                      └────────────┘                      └────────────┘
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
