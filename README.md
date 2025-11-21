# 🏆 CareForAll - Next-Generation Donation Platform

A bulletproof, scalable donation platform built with modern microservices architecture to solve the chaos that destroyed the original system.

## 🚀 One-Click Startup

### **Option 1: Use the startup script**
```bash
./start.sh
```

### **Option 2: Direct docker-compose**
```bash
docker-compose up --build
```

### **That's it! 🎉**

Wait 2-3 minutes for all services to start, then access:

- **👥 User Platform**: http://localhost:8080 (Main donation site)
- **🔧 Architecture Monitor**: http://localhost:3000 (Real-time system visualization)
- **⚙️ API Gateway**: http://localhost:8081 (Backend APIs)
- **📊 Grafana**: http://localhost:3000 (Metrics dashboards)  
- **🔍 Jaeger**: http://localhost:16686 (Distributed tracing)
- **📈 Prometheus**: http://localhost:9090 (Metrics collection)

## 🎯 Quick Demo Workflow

1. **Start everything**: `docker-compose up --build`
2. **Open User Platform**: http://localhost:8080
3. **Browse campaigns** and submit test donations
4. **Open Architecture Monitor**: http://localhost:3000
5. **Start Auto Demo** to see live system flows
6. **Wow the judges!** 🏆

## 🏗️ Architecture Highlights

### **✅ Problems Solved:**

- **❌ Double Charging** → ✅ **Idempotency Protection**
- **❌ Lost Donations** → ✅ **Transactional Outbox Pattern**
- **❌ Payment Corruption** → ✅ **State Machine Validation**
- **❌ Performance Issues** → ✅ **CQRS Read Models**
- **❌ No Monitoring** → ✅ **Complete Observability**

## Services

| Service | Port | Description |
|---------|------|-------------|
| API Gateway | 8080 | Nginx-based routing and load balancing |
| User Service | 3001 | Authentication and user management |
| Campaign Service | 3002 | Campaign CRUD operations |
| Pledge Service | 3003 | Donation handling with idempotency |
| Payment Service | 3004 | Payment processing with state machine |
| Totals Service | 3005 | CQRS read model for campaign totals |

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)

### Running the Platform

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

Access the platform:
- **Frontend**: http://localhost:8080
- **API Gateway**: http://localhost:8080/api
- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686

## API Endpoints

### Users
```
POST /api/users/register - Register new user
POST /api/users/login    - User login
GET  /api/users/me       - Get current user
```

### Campaigns
```
GET    /api/campaigns          - List all campaigns
POST   /api/campaigns          - Create campaign (auth required)
GET    /api/campaigns/:id      - Get campaign details
PUT    /api/campaigns/:id      - Update campaign
DELETE /api/campaigns/:id      - Delete campaign
GET    /api/campaigns/stats    - Get campaign statistics
```

### Pledges/Donations
```
POST /api/pledges              - Create pledge (with idempotency key)
GET  /api/pledges              - List all pledges
GET  /api/pledges/:id          - Get pledge details
GET  /api/pledges/campaign/:id - Get pledges for campaign
GET  /api/pledges/donor/me     - Get my donations
```

### Payments
```
POST /api/payments              - Create payment
POST /api/payments/webhook      - Payment provider webhook
GET  /api/payments/:id          - Get payment details
```

### Totals (CQRS Read Model)
```
GET /api/totals                  - Get all campaign totals
GET /api/totals/campaign/:id     - Get specific campaign total
GET /api/totals/stats            - Get platform statistics
```

## Key Features

### 1. Idempotency (Pledge & Payment Services)
Every pledge/payment request can include an `idempotency_key`. Duplicate requests return the same response without re-processing.

```javascript
POST /api/pledges
{
  "campaign_id": "uuid",
  "donor_email": "donor@example.com",
  "donor_name": "John Doe",
  "amount": 100,
  "idempotency_key": "unique-key-123"  // Optional
}
```

### 2. Outbox Pattern (Pledge Service)
Events are written to an outbox table in the same transaction as the business operation, then published asynchronously by a background worker.

```
1. BEGIN TRANSACTION
2. Insert pledge into pledges table
3. Insert event into outbox_events table
4. COMMIT TRANSACTION
5. Background worker publishes events from outbox
```

### 3. Payment State Machine
Prevents invalid state transitions:
```
PENDING → AUTHORIZED → CAPTURED → COMPLETED
    ↓         ↓            ↓
    └─────────┴────────────┴──→ FAILED
```

Backward transitions (CAPTURED → AUTHORIZED) are blocked to prevent data corruption.

### 4. CQRS Read Model (Totals Service)
Campaign totals are pre-computed and cached, eliminating expensive recalculations on every read request.

## Scalability

Services can be scaled using Docker Compose:

```yaml
services:
  pledge-service:
    deploy:
      replicas: 3
```

## Observability

### Metrics (Prometheus + Grafana)
- Service health checks
- Request rates and latencies
- Error rates

### Logging (Elasticsearch)
- Structured JSON logs
- Centralized log aggregation

### Tracing (Jaeger)
- Distributed request tracing
- End-to-end donation flow visibility

## CI/CD Pipeline

The GitHub Actions pipeline:
1. **Detects changed services** - Only builds/tests modified services
2. **Runs tests** - Unit tests for each service
3. **Builds Docker images** - Tagged with commit SHA
4. **Creates releases** - Semantic versioning (v1.0.0)

## Project Structure

```
.
├── services/
│   ├── user-service/
│   ├── campaign-service/
│   ├── pledge-service/      # Idempotency + Outbox
│   ├── payment-service/     # State Machine
│   ├── totals-service/      # CQRS Read Model
│   └── shared/              # Shared utilities
├── gateway/                 # Nginx API Gateway
├── frontend/                # Minimal React frontend
├── observability/           # Prometheus, Grafana configs
├── .github/workflows/       # CI/CD pipelines
├── docker-compose.yml
└── ARCHITECTURE.md
```

## Technology Stack

- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL
- **Cache/Queue**: Redis
- **API Gateway**: Nginx
- **Observability**: Prometheus, Grafana, Jaeger, Elasticsearch

## Team

Built for the API Avengers Microservice Hackathon - November 21, 2025

---

## Running Tests

```bash
# Run all tests
cd services/user-service && npm test
cd services/pledge-service && npm test
cd services/payment-service && npm test
```

## License

MIT
