# 🚀 Quick Start Guide - CareForAll Donation Platform

A simple guide to get your microservices donation platform up and running.

---

## ✅ Prerequisites

Make sure you have these installed:
- **Docker** (version 20.10+)
- **Docker Compose** (version 2.0+)

Check if installed:
```bash
docker --version
docker-compose --version
```

---

## 🏃 Running the Platform

### Step 1: Start Everything

**Option A - Using the startup script:**
```bash
chmod +x start.sh
./start.sh
```

**Option B - Using Docker Compose directly:**
```bash
docker-compose up --build
```

### Step 2: Wait for Services to Start

Wait **2-3 minutes** for all services to initialize. You'll see logs from:
- PostgreSQL database
- Redis cache
- 6 microservices (user, campaign, pledge, payment, totals, notification)
- API Gateway
- Frontend
- Monitoring tools (Prometheus, Grafana, Jaeger)

### Step 3: Verify Everything is Running

Check container status:
```bash
docker-compose ps
```

All services should show `Up` status. PostgreSQL and Redis should show `healthy`.

---

## 🌐 Access Points

Once running, access these URLs:

| Service | URL | Purpose |
|---------|-----|---------|
| **User Frontend** | http://localhost:8080 | Main donation website |
| **API Gateway** | http://localhost:8081 | Backend API endpoint |
| **Grafana** | http://localhost:3000 | Metrics dashboard (admin/admin) |
| **Prometheus** | http://localhost:9090 | Metrics collection |
| **Jaeger** | http://localhost:16686 | Request tracing |

---

## 🧪 Quick Test

### 1. Test API Gateway

```bash
curl http://localhost:8081/api/health
```

Expected: `{"status":"ok"}` or similar

### 2. Register a User

```bash
curl -X POST http://localhost:8081/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

Save the `token` from the response.

### 3. Login (or use admin)

```bash
# Login as admin (pre-created)
# Note: If this doesn't work, try password "admin" instead of "admin123"
curl -X POST http://localhost:8081/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@careforall.com",
    "password": "admin"
  }'
```

Save the admin `token`.

**Alternative:** If admin login fails, register a new user and use that token instead.

### 4. Create a Campaign

Replace `YOUR_ADMIN_TOKEN` with the token from step 3:

```bash
curl -X POST http://localhost:8081/api/campaigns \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxNzE3YWVlMS0wZWU3LTRjMGQtOTI1ZC0yZjAwMDExNmNhNDMiLCJlbWFpbCI6ImFkbWluQGNhcmVmb3JhbGwuY29tIiwicm9sZSI6IkRPTk9SIiwiaWF0IjoxNzYzNzA4NTA5LCJleHAiOjE3NjM3OTQ5MDl9.d3z09uek7QAIMkip4DlHn6z6WCXIwDm3AGytFnDuVhc" \
  -d '{
    "title": "Help Flood Victims",
    "description": "Emergency relief fund",
    "goal_amount": 50000,
    "image_url": "https://example.com/image.jpg"
  }'
```

Save the `campaign_id` from the response.

### 5. Make a Donation

Replace `YOUR_USER_TOKEN` and `CAMPAIGN_ID`:

```bash
curl -X POST http://localhost:8081/api/pledges \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxNzE3YWVlMS0wZWU3LTRjMGQtOTI1ZC0yZjAwMDExNmNhNDMiLCJlbWFpbCI6ImFkbWluQGNhcmVmb3JhbGwuY29tIiwicm9sZSI6IkRPTk9SIiwiaWF0IjoxNzYzNzA4NTA5LCJleHAiOjE3NjM3OTQ5MDl9.d3z09uek7QAIMkip4DlHn6z6WCXIwDm3AGytFnDuVhc" \
  -H "Idempotency-Key: test-donation-001" \
  -d '{
    "campaign_id": "5e9d4adb-e134-4853-b34c-92a2c854484d",
    "donor_email": "test@example.com",
    "donor_name": "Test User",
    "amount": 100,
    "message": "Hope this helps!"
  }'
```

### 6. Test Idempotency (Important!)

Run the **exact same** request again with the same `Idempotency-Key`:

```bash
curl -X POST http://localhost:8081/api/pledges \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Idempotency-Key: test-donation-001" \
  -d '{
    "campaign_id": "CAMPAIGN_ID",
    "donor_email": "test@example.com",
    "donor_name": "Test User",
    "amount": 100,
    "message": "Hope this helps!"
  }'
```

Expected: Same response with `"idempotent": true` - this prevents double charging!

---

## 📋 Using the HTTP Test File

For easier testing, use the provided `api-testing.http` file:

1. Open in VS Code
2. Install "REST Client" extension (if not installed)
3. Click "Send Request" above each request
4. Update variables (`@userToken`, `@campaignId`, etc.) as you go

---

## 🛑 Stopping the Platform

```bash
# Stop all services
docker-compose down

# Stop and remove all data (fresh start)
docker-compose down -v
```

---

## 🔍 Troubleshooting

### Services won't start?
```bash
# Check logs
docker-compose logs

# Check specific service logs
docker-compose logs user-service
docker-compose logs postgres
```

### Port already in use?
- Stop other services using ports 8080, 8081, 3000, 5432, 6379
- Or modify ports in `docker-compose.yml`

### Database connection errors?
- Wait longer (database takes time to initialize)
- Check: `docker-compose ps` - postgres should be `healthy`

### Reset everything?
```bash
docker-compose down -v
docker-compose up --build
```

---

## 📚 What's Running?

This platform includes:

- **6 Microservices**: User, Campaign, Pledge, Payment, Totals, Notification
- **API Gateway**: Routes requests to services
- **PostgreSQL**: Main database
- **Redis**: Caching and message queue
- **Monitoring**: Prometheus, Grafana, Jaeger
- **Frontend**: Next.js donation website

---

## 🎯 Next Steps

1. ✅ Platform is running
2. ✅ Basic API test passed
3. 📖 Read `TESTING_GUIDE.md` for comprehensive testing
4. 📖 Read `ARCHITECTURE.md` for system design details
5. 🎨 Visit http://localhost:8080 to see the frontend

---

**Need help?** Check the logs: `docker-compose logs -f`

