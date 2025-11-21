# CareForAll - Visual Architecture Diagrams

## System Overview (High-Level)

```mermaid
flowchart TB
    subgraph Clients["Clients"]
        WEB[Web Browser]
        MOBILE[Mobile App]
        ADMIN[Admin Panel]
    end

    subgraph Gateway["API Gateway Layer"]
        NGINX[NGINX Load Balancer<br/>Rate Limit: 1000 req/s<br/>SSL Termination]
    end

    subgraph Services["Microservices Layer"]
        USER[User Service<br/>Port 3001]
        CAMPAIGN[Campaign Service<br/>Port 3002]
        PLEDGE[Pledge Service<br/>Port 3003]
        PAYMENT[Payment Service<br/>Port 3004]
        TOTALS[Totals Service<br/>Port 3005]
        NOTIF[Notification Service<br/>Port 3006]
    end

    subgraph Messaging["Event Bus"]
        REDIS_PUB[Redis Pub/Sub<br/>Event Channel]
    end

    subgraph Data["Data Layer"]
        PG[(PostgreSQL<br/>Primary DB)]
        REDIS[(Redis<br/>Cache + Idempotency)]
        ES[(Elasticsearch<br/>Logs + Search)]
    end

    subgraph Observability["Observability Stack"]
        PROM[Prometheus]
        GRAF[Grafana]
        JAEGER[Jaeger<br/>Distributed Tracing]
    end

    WEB & MOBILE & ADMIN --> NGINX
    NGINX --> USER & CAMPAIGN & PLEDGE & PAYMENT & TOTALS

    PLEDGE --> REDIS_PUB
    PAYMENT --> REDIS_PUB
    REDIS_PUB --> TOTALS
    REDIS_PUB --> NOTIF

    USER & CAMPAIGN & PLEDGE & PAYMENT --> PG
    TOTALS --> REDIS
    PAYMENT --> REDIS

    Services --> PROM
    PROM --> GRAF
    Services --> JAEGER
    Services --> ES
```

---

## Corner Case Solutions

### 1. Idempotency Pattern (Solves Double Charging)

```mermaid
sequenceDiagram
    participant PP as Payment Provider
    participant PS as Payment Service
    participant R as Redis
    participant DB as PostgreSQL

    PP->>PS: Webhook (webhook_id: abc123)
    PS->>R: EXISTS idempotency:abc123?

    alt Key Exists (Duplicate)
        R-->>PS: TRUE
        PS-->>PP: 200 OK (skip processing)
    else Key Not Exists (New)
        R-->>PS: FALSE
        PS->>R: SET idempotency:abc123 TTL 24h
        PS->>DB: Process payment
        DB-->>PS: Success
        PS-->>PP: 200 OK
    end

    Note over PS,R: Prevents double charging<br/>even with webhook retries
```

### 2. Transactional Outbox Pattern (Solves Lost Donations)

```mermaid
sequenceDiagram
    participant C as Client
    participant PS as Pledge Service
    participant DB as PostgreSQL
    participant OP as Outbox Poller
    participant MQ as Redis Pub/Sub
    participant TS as Totals Service

    C->>PS: POST /pledges

    rect rgb(200, 230, 200)
        Note over PS,DB: Single Transaction
        PS->>DB: BEGIN TRANSACTION
        PS->>DB: INSERT pledge
        PS->>DB: INSERT outbox_event
        PS->>DB: COMMIT
    end

    PS-->>C: 201 Created

    loop Every 100ms
        OP->>DB: SELECT unpublished events
        DB-->>OP: Events
        OP->>MQ: Publish events
        MQ-->>OP: ACK
        OP->>DB: Mark as published
    end

    MQ->>TS: pledge.created event
    TS->>TS: Update totals

    Note over PS,TS: Even if service crashes after<br/>DB write, event is never lost
```

### 3. State Machine (Solves Out-of-Order Webhooks)

```mermaid
stateDiagram-v2
    [*] --> PENDING: Create Pledge

    PENDING --> AUTHORIZED: payment.authorized
    PENDING --> FAILED: payment.failed
    PENDING --> EXPIRED: timeout (30min)

    AUTHORIZED --> CAPTURED: payment.captured
    AUTHORIZED --> FAILED: payment.failed
    AUTHORIZED --> CANCELLED: user.cancelled

    CAPTURED --> COMPLETED: settlement.confirmed

    FAILED --> [*]
    EXPIRED --> [*]
    CANCELLED --> [*]
    COMPLETED --> [*]

    note right of CAPTURED
        INVALID: CAPTURED → AUTHORIZED
        Rejected by state machine
    end note
```

### 4. CQRS Pattern (Solves DB Overload on Totals)

```mermaid
flowchart LR
    subgraph Write["Write Side (Command)"]
        C1[POST /pledges]
        C2[PUT /pledges/:id]
        WDB[(PostgreSQL<br/>Normalized Data)]
    end

    subgraph Events["Event Bus"]
        MQ[Redis Pub/Sub]
    end

    subgraph Read["Read Side (Query)"]
        R1[GET /totals/:campaign]
        RDB[(Redis<br/>Pre-computed)]
        MV[(Materialized View)]
    end

    C1 & C2 --> WDB
    WDB --> MQ
    MQ --> RDB
    MQ --> MV
    R1 --> RDB
    RDB -.->|fallback| MV

    style WDB fill:#f9f,stroke:#333
    style RDB fill:#9ff,stroke:#333
```

---

## Complete Donation Flow

```mermaid
sequenceDiagram
    autonumber
    participant D as Donor
    participant GW as API Gateway
    participant PS as Pledge Service
    participant DB as PostgreSQL
    participant PP as Payment Provider
    participant PAY as Payment Service
    participant R as Redis
    participant MQ as Redis Pub/Sub
    participant TS as Totals Service

    D->>GW: POST /api/pledges
    GW->>PS: Forward request

    rect rgb(255, 240, 200)
        Note over PS,DB: Transactional Write
        PS->>DB: BEGIN
        PS->>DB: INSERT pledge (PENDING)
        PS->>DB: INSERT outbox_event
        PS->>DB: COMMIT
    end

    PS-->>D: {pledge_id, payment_url}
    D->>PP: Complete payment
    PP->>PAY: Webhook (authorized)

    rect rgb(200, 255, 200)
        Note over PAY,R: Idempotency Check
        PAY->>R: EXISTS idempotency:webhook_1?
        R-->>PAY: NO
        PAY->>R: SET idempotency:webhook_1
    end

    rect rgb(200, 220, 255)
        Note over PAY,DB: State Machine Validation
        PAY->>DB: Get current state
        DB-->>PAY: PENDING
        PAY->>PAY: Validate: PENDING→AUTHORIZED ✓
        PAY->>DB: UPDATE status=AUTHORIZED
    end

    PP->>PAY: Webhook (captured)
    PAY->>R: Idempotency check
    PAY->>DB: Validate & Update CAPTURED
    PAY->>MQ: Publish pledge.captured

    MQ->>TS: pledge.captured
    TS->>R: INCR campaign:1:total
    TS->>R: INCR campaign:1:donors

    D->>GW: GET /api/campaigns/1/totals
    GW->>TS: Forward
    TS->>R: GET campaign:1:total
    R-->>TS: 50000
    TS-->>D: {total: 50000, donors: 342}
```

---

## Observability Architecture

```mermaid
flowchart TB
    subgraph Services["Microservices"]
        S1[User Service]
        S2[Campaign Service]
        S3[Pledge Service]
        S4[Payment Service]
        S5[Totals Service]
    end

    subgraph Collectors["Data Collection"]
        M[Metrics<br/>/metrics endpoint]
        L[Logs<br/>JSON stdout]
        T[Traces<br/>OpenTelemetry]
    end

    subgraph Storage["Storage & Processing"]
        PROM[Prometheus<br/>Time Series DB]
        ES[Elasticsearch<br/>Log Storage]
        JAEGER[Jaeger<br/>Trace Storage]
    end

    subgraph Viz["Visualization"]
        GRAF[Grafana<br/>Dashboards]
        KIB[Kibana<br/>Log Explorer]
        JUI[Jaeger UI<br/>Trace Viewer]
    end

    S1 & S2 & S3 & S4 & S5 --> M & L & T
    M --> PROM
    L --> ES
    T --> JAEGER

    PROM --> GRAF
    ES --> GRAF
    ES --> KIB
    JAEGER --> JUI
    JAEGER --> GRAF

    subgraph Alerts["Alerting"]
        AM[AlertManager]
    end

    PROM --> AM
```

---

## Service Communication Patterns

```mermaid
flowchart TB
    subgraph Sync["Synchronous (HTTP/REST)"]
        direction LR
        CLIENT[Client] -->|HTTP| GATEWAY[API Gateway]
        GATEWAY -->|HTTP| SVC[Service]
        SVC -->|HTTP| DB[(Database)]
    end

    subgraph Async["Asynchronous (Events)"]
        direction LR
        PS[Pledge Service] -->|Publish| QUEUE[Redis Pub/Sub]
        QUEUE -->|Subscribe| TS[Totals Service]
        QUEUE -->|Subscribe| NS[Notification Service]
    end

    subgraph Hybrid["Hybrid (Outbox)"]
        direction LR
        PS2[Pledge Service] -->|Transaction| DB2[(PostgreSQL)]
        POLL[Outbox Poller] -->|Read| DB2
        POLL -->|Publish| QUEUE2[Redis Pub/Sub]
    end
```

---

## Failure Recovery Patterns

```mermaid
flowchart TB
    subgraph Retry["Retry with Backoff"]
        R1[Attempt 1] -->|Fail| W1[Wait 1s]
        W1 --> R2[Attempt 2]
        R2 -->|Fail| W2[Wait 2s]
        W2 --> R3[Attempt 3]
        R3 -->|Fail| W3[Wait 4s]
        W3 --> R4[Attempt 4]
        R4 -->|Fail| DLQ[Dead Letter Queue]
    end

    subgraph Circuit["Circuit Breaker"]
        CLOSED[Closed<br/>Normal] -->|Failures > Threshold| OPEN[Open<br/>Fast Fail]
        OPEN -->|Timeout| HALF[Half-Open<br/>Test]
        HALF -->|Success| CLOSED
        HALF -->|Failure| OPEN
    end

    subgraph Fallback["Fallback Strategy"]
        PRIMARY[(Redis Cache)] -->|Miss| SECONDARY[(PostgreSQL)]
        SECONDARY -->|Error| DEFAULT[Default Response]
    end
```

---

## Docker Compose Service Map

```mermaid
flowchart TB
    subgraph External["External Access"]
        P8080[Port 8080 Frontend]
        P8081[Port 8081 API Gateway]
        P3000[Port 3000 Grafana]
        P9090[Port 9090 Prometheus]
        P16686[Port 16686 Jaeger]
        P5601[Port 5601 Kibana]
    end

    subgraph Gateway["Load Balancer"]
        NGINX[nginx:alpine]
    end

    subgraph Core["Core Services"]
        USER[user-service x2]
        CAMP[campaign-service x2]
        PLEDGE[pledge-service x3]
        PAY[payment-service x2]
        TOTAL[totals-service x2]
        NOTIF[notification-service x2]
    end

    subgraph Data["Data Services"]
        PG[postgres:15-alpine]
        REDIS[redis:7-alpine<br/>Cache + Pub/Sub]
        ES[elasticsearch:8.11.0]
    end

    subgraph Observe["Observability"]
        PROM[prometheus]
        GRAF[grafana]
        JAEGER[jaeger]
    end

    P8081 --> NGINX
    P8080 --> FRONTEND[User Frontend]
    NGINX --> USER & CAMP & PLEDGE & PAY & TOTAL & NOTIF

    USER & CAMP & PLEDGE & PAY --> PG
    TOTAL & PAY & PLEDGE --> REDIS
    REDIS -.->|Pub/Sub| TOTAL & NOTIF

    Core --> PROM --> GRAF
    Core --> JAEGER
    Core --> ES

    P3000 --> GRAF
    P9090 --> PROM
    P16686 --> JAEGER
    P5601 --> KIB[Kibana]
```

---

## Data Flow Summary

| Flow | Pattern | Why |
|------|---------|-----|
| Client → Service | REST via Gateway | Simple, cacheable |
| Service → DB | Transaction | ACID guarantees |
| DB → Event | Outbox Pattern | Reliability |
| Event → Consumer | Message Queue | Decoupling |
| Query → Cache | CQRS | Performance |
| Webhook → Service | Idempotent | Deduplication |
| State Change | State Machine | Correctness |

---

## Key Metrics to Monitor

```mermaid
mindmap
  root((Observability))
    Metrics
      Request Rate
      Error Rate
      Latency P50/P95/P99
      Queue Depth
      DB Connections
    Logs
      Error Logs
      Audit Trail
      Webhook Logs
      State Transitions
    Traces
      Request Flow
      Service Dependencies
      Bottleneck Detection
    Alerts
      High Error Rate
      Slow Response
      Queue Backup
      DB Overload
```

This architecture addresses all 6 critical failures from the original CareForAll system while maintaining simplicity and scalability.
