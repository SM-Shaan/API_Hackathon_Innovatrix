# CareForAll Platform - Q&A Guide

> Answers to common questions about the architecture and implementation.

---

## 1. What are the possible constraints and how to resolve them?

### Database Constraints:
- **Problem**: Connection pool exhaustion under high load
- **Solution**: Connection pooling with max 10-20 connections per service replica

### Rate Limiting Constraints:
- **Problem**: API abuse or DDoS attacks
- **Solution**: Nginx rate limiting (100 req/s per endpoint, 50 for totals)

### Idempotency Constraints:
- **Problem**: Duplicate requests causing double processing
- **Solution**: Redis-based idempotency keys with 24-hour TTL

### State Machine Constraints:
- **Problem**: Invalid payment state transitions
- **Solution**: Strict state machine validation (PENDING → AUTHORIZED → CAPTURED → COMPLETED)

---

## 2. How is automated traffic handling implemented?

**API Gateway (Nginx) handles:**
- **Load Balancing**: Least-connection algorithm distributes requests across service replicas
- **Rate Limiting**: 100 requests/second per endpoint
- **Health Checks**: Automatic failover when services are unhealthy (max_fails=3)
- **WebSocket Support**: Upgrade headers for real-time notifications

**Service Replicas:**
- User Service: 2 replicas
- Campaign Service: 2 replicas
- Pledge Service: 3 replicas (highest load)
- Payment Service: 2 replicas
- Totals Service: 2 replicas
- Notification Service: 2 replicas

---

## 3. What is CDC? Where is it implemented and why?

**CDC (Change Data Capture)** captures changes made to data in a database and propagates them to other systems.

### In Our Implementation:
We use the **Transactional Outbox Pattern** (a form of CDC):
- **Location**: `services/pledge-service/src/outbox.ts` and `outbox-worker.ts`
- **How it works**:
  1. When a pledge is created, both the pledge and an outbox event are written in the same transaction
  2. An outbox worker polls the `outbox_events` table for unpublished events
  3. Events are published to Redis Pub/Sub and marked as processed

### Why:
- Ensures data and events are never out of sync
- Prevents lost donations even if the service crashes after DB write
- Guarantees exactly-once event delivery

---

## 4. What are out-of-order webhooks? How are they resolved?

### The Problem:
Payment providers (like Stripe) may send webhooks in unpredictable order:
- `payment.captured` might arrive before `payment.authorized`
- Network delays can reorder webhook delivery

### Our Solution - State Machine Pattern:
**Location**: `services/payment-service/src/state-machine.ts`

```
Valid Transitions:
PENDING → AUTHORIZED → CAPTURED → COMPLETED
    ↓          ↓           ↓
  FAILED     FAILED      FAILED
```

**Rules enforced:**
- Cannot go backwards (CAPTURED → AUTHORIZED = REJECTED)
- Cannot skip states (PENDING → COMPLETED = REJECTED)
- Invalid transitions are logged but don't corrupt data

---

## 5. What is the role of the state machine?

The **Payment State Machine** ensures:

1. **Data Integrity**: Only valid state transitions are allowed
2. **Audit Trail**: All transitions are logged with timestamps
3. **Idempotency**: Same webhook processed multiple times = same result
4. **Business Rules**: Enforces payment flow rules in code

**States:**
- `PENDING` - Initial state when pledge is created
- `AUTHORIZED` - Payment authorized by provider
- `CAPTURED` - Funds captured
- `COMPLETED` - Payment fully processed
- `FAILED` - Payment failed at any stage
- `REFUNDED` - Only from COMPLETED state

---

## 6. What is the role of rate limiting? How to check it?

### Role:
- **Prevents API abuse**: Limits requests per second
- **Protects services**: Prevents overload during traffic spikes
- **Fair usage**: Ensures all users get reasonable access

### Configuration (Nginx):
```nginx
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/s;
limit_req_zone $binary_remote_addr zone=totals_limit:10m rate=50r/s;
```

### How to Test:
```bash
# Send many rapid requests
for i in {1..200}; do
  curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8081/api/campaigns &
done

# You'll see:
# 200 (success) for first ~100 requests
# 429 (too many requests) for excess requests
```

---

## 7. What are we using for the message broker?

### Answer: **Redis Pub/Sub**

**Why Redis instead of RabbitMQ/Kafka:**
- Simpler setup and maintenance
- Already using Redis for caching and idempotency
- Sufficient for our scale requirements
- Lower operational overhead

**How it's used:**
- Services publish events to Redis channels (e.g., "events")
- Subscribed services receive events in real-time
- Combined with Outbox Pattern for guaranteed delivery

**Location**: Event publishing in `services/pledge-service/src/outbox-worker.ts`

---

## 8. What is Elasticsearch doing here?

### Role: **Centralized Log Storage & Search**

**Features:**
- Stores structured JSON logs from all services
- Enables full-text search across all logs
- Supports complex queries (e.g., "all errors for user X in last hour")

**Integration:**
- **Filebeat** ships logs from Docker containers to Elasticsearch
- **Kibana** provides UI for log visualization and search

**Access**: http://localhost:5601 (Kibana UI)

**Use Cases:**
- Debugging issues across microservices
- Audit trail for donations
- Performance analysis

---

## 9. How are write & read models handled in CQRS?

### CQRS (Command Query Responsibility Segregation):

**Write Model (Command Side):**
- **Service**: Pledge Service
- **Database**: PostgreSQL (normalized tables)
- **Operations**: CREATE, UPDATE pledges
- **Location**: `services/pledge-service/`

**Read Model (Query Side):**
- **Service**: Totals Service
- **Database**: Redis (pre-computed) + PostgreSQL (materialized views)
- **Operations**: GET campaign totals, donor counts
- **Location**: `services/totals-service/`

**How they sync:**
1. Pledge Service writes to PostgreSQL + outbox
2. Outbox worker publishes event to Redis Pub/Sub
3. Totals Service subscribes and updates Redis counters
4. Queries read from Redis (sub-millisecond response)

**Benefits:**
- Write operations don't slow down reads
- Read operations are extremely fast (cached)
- Each model optimized for its purpose

---

## 10. Additional Important Concepts

### Idempotency Pattern:
- Every donation request includes an `Idempotency-Key` header
- Duplicate requests return cached response
- Prevents double charging users

### Transactional Outbox:
- Data and events saved in single transaction
- Background worker publishes events reliably
- No lost events even on crashes

### WebSocket Notifications:
- Real-time campaign total updates
- Donor confirmation notifications
- Located in `services/notification-service/src/websocket.ts`

---

## Quick Reference: Port Assignments

| Service | Port | Description |
|---------|------|-------------|
| User Frontend | 8080 | Main donation website |
| API Gateway | 8081 | Nginx reverse proxy |
| User Service | 3001 | Authentication |
| Campaign Service | 3002 | Campaign CRUD |
| Pledge Service | 3003 | Donation processing |
| Payment Service | 3004 | Payment handling |
| Totals Service | 3005 | CQRS read model |
| Notification Service | 3006 | Email + WebSocket |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Cache + Pub/Sub |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3000 | Dashboards |
| Jaeger | 16686 | Distributed tracing |
| Kibana | 5601 | Log visualization |
| Elasticsearch | 9200 | Log storage |

---

*Generated for CareForAll Platform Documentation*
