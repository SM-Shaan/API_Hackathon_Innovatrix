# 🧪 CareForAll Donation Platform - Complete Testing Guide

This guide explains exactly how to test every service and feature in the donation platform based on the actual service implementations.

## 🎯 Table of Contents

1. [Service Overview & Endpoints](#service-overview--endpoints)
2. [Prerequisites & Setup](#prerequisites--setup)
3. [Authentication Testing](#authentication-testing)
4. [Campaign Management Testing](#campaign-management-testing)
5. [Donation Flow Testing (Core Feature)](#donation-flow-testing-core-feature)
6. [Payment State Machine Testing](#payment-state-machine-testing)
7. [Real-time Totals Testing](#real-time-totals-testing)
8. [Notification System Testing](#notification-system-testing)
9. [Error Scenarios & Edge Cases](#error-scenarios--edge-cases)
10. [Load Testing & Performance](#load-testing--performance)
11. [Monitoring & Observability](#monitoring--observability)

---

## 📋 Service Overview & Endpoints

### **Service Architecture**
```
User Frontend (Port 8080) → API Gateway (Port 8081) → Microservices
                                                     ↓
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│  User Service   │ Campaign Service│ Pledge Service  │ Payment Service │
│    Port 3001    │   Port 3002     │   Port 3003     │   Port 3004     │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
┌─────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Totals Service  │Notification Svc │   PostgreSQL    │      Redis      │
│   Port 3005     │   Port 3006     │   Port 5432     │   Port 6379     │
└─────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

### **Core API Endpoints**

#### **1. User Service (`/api/users`)**
- `POST /register` - Register new user
- `POST /login` - User authentication
- `POST /verify` - Verify JWT token
- `GET /me` - Get current user profile

#### **2. Campaign Service (`/api/campaigns`)**
- `GET /` - Get all campaigns
- `GET /:id` - Get campaign by ID
- `POST /` - Create campaign (authenticated)
- `PUT /:id` - Update campaign (owner/admin)
- `GET /stats` - Get campaign statistics (admin)

#### **3. Pledge Service (`/api/pledges`)**
- `POST /` - Create pledge/donation (⭐ Core Feature)
- `GET /:id` - Get pledge details
- `GET /campaign/:campaignId` - Get pledges by campaign
- `GET /donor/me` - Get current user's pledges

#### **4. Payment Service (`/api/payments`)**
- `POST /` - Initiate payment
- `POST /webhook` - Handle payment webhooks (⭐ Core Feature)
- `GET /:id` - Get payment status
- `GET /state-machine/info` - Get state machine info

#### **5. Totals Service (`/api/totals`)**
- `GET /campaign/:campaignId` - Get real-time campaign totals
- `GET /stats` - Get platform statistics
- `POST /rebuild` - Rebuild totals (admin)

#### **6. Notification Service (`/api/notifications`)**
- `GET /` - Get notifications for user
- `GET /unread/count` - Get unread count
- `POST /:id/read` - Mark as read

---

## 🚀 Prerequisites & Setup

### **1. Verify Application is Running**
```bash
# Check all containers are healthy
docker-compose ps

# Should show all services as "Up" and postgres/redis as "healthy"
```

### **2. Get Base URL**
```bash
export BASE_URL="http://localhost:8081/api"
```

### **3. Testing Tools**
- **Option 1**: Use VS Code REST Client with `api-testing.http`
- **Option 2**: Use curl commands (provided below)
- **Option 3**: Use Postman/Insomnia

---

## 🔐 Authentication Testing

### **Step 1: Register a New User**
```bash
curl -X POST "$BASE_URL/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

**Expected Response:**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "testuser@example.com",
    "name": "Test User",
    "role": "DONOR",
    "created_at": "2024-11-21T...",
    "updated_at": "2024-11-21T..."
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### **Step 2: Login Existing User**
```bash
curl -X POST "$BASE_URL/users/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com", 
    "password": "password123"
  }'
```

### **Step 3: Login Admin (Pre-created)**
```bash
curl -X POST "$BASE_URL/users/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@careforall.com",
    "password": "admin123"
  }'
```

### **Step 4: Test Token Verification**
```bash
# Save token from login response
export USER_TOKEN="your-jwt-token-here"
export ADMIN_TOKEN="admin-jwt-token-here"

# Test token
curl -X GET "$BASE_URL/users/me" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**✅ Expected Results:**
- User registration returns user object + JWT token
- Login returns valid JWT token
- Admin login works with pre-created credentials
- Token verification returns user info

---

## 📋 Campaign Management Testing

### **Step 1: Create Campaign (Admin Only)**
```bash
curl -X POST "$BASE_URL/campaigns" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "title": "Help Flood Victims", 
    "description": "Emergency relief for flood-affected families",
    "goal_amount": 50000,
    "image_url": "https://example.com/flood.jpg"
  }'
```

**Expected Response:**
```json
{
  "id": "campaign-uuid-here",
  "title": "Help Flood Victims",
  "description": "Emergency relief for flood-affected families",
  "goal_amount": 50000,
  "current_amount": 0,
  "status": "ACTIVE",
  "owner_id": "admin-user-id",
  "image_url": "https://example.com/flood.jpg",
  "created_at": "2024-11-21T...",
  "updated_at": "2024-11-21T..."
}
```

### **Step 2: Get All Campaigns**
```bash
# Save campaign ID from previous response
export CAMPAIGN_ID="campaign-uuid-here"

# Get campaigns list
curl -X GET "$BASE_URL/campaigns" \
  -H "Authorization: Bearer $USER_TOKEN"
```

### **Step 3: Get Campaign Details**
```bash
curl -X GET "$BASE_URL/campaigns/$CAMPAIGN_ID" \
  -H "Authorization: Bearer $USER_TOKEN"
```

### **Step 4: Get Campaign Statistics (Admin)**
```bash
curl -X GET "$BASE_URL/campaigns/stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**✅ Expected Results:**
- Campaign creation works for admin users
- Campaign list returns all active campaigns
- Campaign details show goal_amount and current_amount
- Statistics endpoint shows platform metrics

---

## 💰 Donation Flow Testing (Core Feature)

This is the **most important** part - the donation flow with idempotency protection.

### **Step 1: Create First Pledge**
```bash
curl -X POST "$BASE_URL/pledges" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Idempotency-Key: test-donation-001" \
  -d '{
    "campaign_id": "'$CAMPAIGN_ID'",
    "donor_email": "testuser@example.com",
    "donor_name": "Test User",
    "amount": 100,
    "message": "Hope this helps!"
  }'
```

**Expected Response:**
```json
{
  "pledge": {
    "id": "pledge-uuid-here",
    "campaign_id": "campaign-uuid",
    "donor_id": "user-uuid",
    "donor_email": "testuser@example.com", 
    "donor_name": "Test User",
    "amount": 100,
    "status": "PENDING",
    "message": "Hope this helps!",
    "created_at": "2024-11-21T...",
    "updated_at": "2024-11-21T..."
  },
  "idempotent": false
}
```

### **Step 2: Test Idempotency Protection (⭐ Critical Test)**
```bash
# SAME request with SAME idempotency key
curl -X POST "$BASE_URL/pledges" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Idempotency-Key: test-donation-001" \
  -d '{
    "campaign_id": "'$CAMPAIGN_ID'",
    "donor_email": "testuser@example.com", 
    "donor_name": "Test User",
    "amount": 100,
    "message": "Hope this helps!"
  }'
```

**Expected Response:**
```json
{
  "pledge": {
    "id": "same-pledge-uuid-as-before",
    "campaign_id": "campaign-uuid",
    "donor_id": "user-uuid", 
    "donor_email": "testuser@example.com",
    "donor_name": "Test User",
    "amount": 100,
    "status": "PENDING",
    "message": "Hope this helps!",
    "created_at": "same-timestamp-as-before",
    "updated_at": "same-timestamp-as-before"
  },
  "idempotent": true  // ← This shows idempotency worked!
}
```

### **Step 3: Create Different Pledge**
```bash
# Different idempotency key = new pledge
curl -X POST "$BASE_URL/pledges" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Idempotency-Key: test-donation-002" \
  -d '{
    "campaign_id": "'$CAMPAIGN_ID'",
    "donor_email": "testuser@example.com",
    "donor_name": "Test User", 
    "amount": 250,
    "message": "Another donation"
  }'
```

### **Step 4: Get User's Pledges**
```bash
# Save pledge ID from first response
export PLEDGE_ID="pledge-uuid-here"

curl -X GET "$BASE_URL/pledges/donor/me" \
  -H "Authorization: Bearer $USER_TOKEN"
```

### **Step 5: Get Pledge Details**
```bash
curl -X GET "$BASE_URL/pledges/$PLEDGE_ID" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**✅ Expected Results:**
- First pledge creates new record with `idempotent: false`
- Retry with same idempotency key returns same response with `idempotent: true`
- Different idempotency key creates different pledge
- User can retrieve their pledges

---

## 💳 Payment State Machine Testing

This tests the core payment processing state machine.

### **Payment States Flow:**
```
PENDING → AUTHORIZED → CAPTURED → COMPLETED
    ↓         ↓           ↓
   FAILED   FAILED    FAILED
```

### **Step 1: Get Payment ID**
```bash
# Get payment associated with pledge
curl -X GET "$BASE_URL/payments/pledge/$PLEDGE_ID" \
  -H "Authorization: Bearer $USER_TOKEN"
```

### **Step 2: Simulate Authorization Webhook**
```bash
export PAYMENT_ID="payment-uuid-from-response"

curl -X POST "$BASE_URL/payments/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_id": "wh_auth_001",
    "event_type": "payment_intent.authorized",
    "provider": "stripe",
    "provider_payment_id": "pi_test_'$(date +%s)'",
    "amount": 100,
    "metadata": {
      "pledge_id": "'$PLEDGE_ID'"
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "payment": {
    "id": "payment-uuid",
    "state": "AUTHORIZED",  // ← State changed from PENDING
    "provider_payment_id": "pi_test_123",
    "amount": 100
  },
  "wasIdempotent": false,
  "transitionResult": {
    "success": true,
    "fromState": "PENDING",
    "toState": "AUTHORIZED"
  }
}
```

### **Step 3: Simulate Capture Webhook**
```bash
curl -X POST "$BASE_URL/payments/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_id": "wh_capture_001", 
    "event_type": "payment_intent.captured",
    "provider": "stripe",
    "provider_payment_id": "pi_test_'$(date +%s)'",
    "metadata": {
      "pledge_id": "'$PLEDGE_ID'"
    }
  }'
```

### **Step 4: Simulate Completion Webhook**
```bash
curl -X POST "$BASE_URL/payments/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_id": "wh_complete_001",
    "event_type": "payment_intent.succeeded", 
    "provider": "stripe",
    "provider_payment_id": "pi_test_'$(date +%s)'",
    "metadata": {
      "pledge_id": "'$PLEDGE_ID'"
    }
  }'
```

**Expected Final Response:**
```json
{
  "success": true,
  "payment": {
    "id": "payment-uuid",
    "state": "COMPLETED",  // ← Final state
    "provider_payment_id": "pi_test_123",
    "amount": 100
  },
  "wasIdempotent": false,
  "transitionResult": {
    "success": true, 
    "fromState": "CAPTURED",
    "toState": "COMPLETED"
  }
}
```

### **Step 5: Test Invalid State Transition**
```bash
# Try to go back to PENDING (should fail)
curl -X POST "$BASE_URL/payments/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_id": "wh_invalid_001",
    "event_type": "payment_intent.created",
    "provider": "stripe", 
    "provider_payment_id": "pi_test_'$(date +%s)'",
    "metadata": {
      "pledge_id": "'$PLEDGE_ID'"
    }
  }'
```

**Expected Error Response:**
```json
{
  "success": false,
  "error": "Invalid state transition from COMPLETED to PENDING"
}
```

### **Step 6: Get Payment State Machine Info**
```bash
curl -X GET "$BASE_URL/payments/state-machine/info"
```

**✅ Expected Results:**
- Payment progresses through states: PENDING → AUTHORIZED → CAPTURED → COMPLETED
- Each webhook creates valid state transition
- Invalid transitions are rejected
- Events are published for completed payments

---

## 📊 Real-time Totals Testing

This tests the event-driven CQRS pattern for real-time campaign totals.

### **Step 1: Check Initial Campaign Totals**
```bash
curl -X GET "$BASE_URL/totals/campaign/$CAMPAIGN_ID" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Expected Response:**
```json
{
  "campaign_id": "campaign-uuid",
  "total_amount": 0,  // ← Should be 0 initially
  "donation_count": 0,
  "average_amount": 0,
  "last_updated": "2024-11-21T..."
}
```

### **Step 2: Complete More Donations**
Follow the donation flow steps above to create and complete several payments.

### **Step 3: Check Updated Totals**
```bash
curl -X GET "$BASE_URL/totals/campaign/$CAMPAIGN_ID" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Expected Response:**
```json
{
  "campaign_id": "campaign-uuid",
  "total_amount": 350,  // ← Should show sum of completed payments
  "donation_count": 2,
  "average_amount": 175,
  "last_updated": "2024-11-21T..." // ← Recent timestamp
}
```

### **Step 4: Get Platform Statistics**
```bash
curl -X GET "$BASE_URL/totals/stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### **Step 5: Test Totals Rebuild (Admin)**
```bash
curl -X POST "$BASE_URL/totals/rebuild" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**✅ Expected Results:**
- Totals start at 0
- Totals update in real-time after payment completion
- Platform statistics show aggregated data
- Rebuild function recalculates from source data

---

## 🔔 Notification System Testing

### **Step 1: Get Notifications for User**
```bash
curl -X GET "$BASE_URL/notifications" \
  -H "Authorization: Bearer $USER_TOKEN"
```

### **Step 2: Get Unread Count**
```bash
curl -X GET "$BASE_URL/notifications/unread/count" \
  -H "Authorization: Bearer $USER_TOKEN"
```

### **Step 3: Send Manual Notification (Admin)**
```bash
curl -X POST "$BASE_URL/notifications/send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "user_id": "user-uuid-here",
    "type": "DONATION_RECEIPT",
    "title": "Thank you for your donation!",
    "message": "Your donation of $100 has been processed successfully."
  }'
```

**✅ Expected Results:**
- Users receive notifications for donation events
- Unread count shows pending notifications
- Admin can send manual notifications

---

## ❌ Error Scenarios & Edge Cases

### **1. Test Duplicate User Registration**
```bash
# Try to register same email twice
curl -X POST "$BASE_URL/users/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",  // Same email as before
    "password": "different123", 
    "name": "Different User"
  }'
```

**Expected**: `400 Bad Request - Email already exists`

### **2. Test Invalid Amount Pledge**
```bash
curl -X POST "$BASE_URL/pledges" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Idempotency-Key: error-test-001" \
  -d '{
    "campaign_id": "'$CAMPAIGN_ID'",
    "donor_email": "test@example.com",
    "donor_name": "Test User",
    "amount": -50  // ← Negative amount
  }'
```

**Expected**: `400 Bad Request - Amount must be positive`

### **3. Test Unauthorized Access**
```bash
# Try to access admin endpoint without admin token
curl -X GET "$BASE_URL/campaigns/stats" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Expected**: `403 Forbidden`

### **4. Test Invalid Campaign ID**
```bash
curl -X GET "$BASE_URL/campaigns/invalid-uuid" \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Expected**: `404 Not Found`

### **5. Test Missing Required Fields**
```bash
curl -X POST "$BASE_URL/pledges" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{
    "amount": 100
    // Missing required fields
  }'
```

**Expected**: `400 Bad Request - Validation errors`

**✅ Expected Results:**
- All error scenarios return appropriate HTTP status codes
- Error messages are descriptive and helpful
- System remains stable under invalid inputs

---

## 🚀 Load Testing & Performance

### **1. Concurrent Pledge Creation**
```bash
# Create multiple pledges simultaneously
for i in {1..10}; do
  curl -X POST "$BASE_URL/pledges" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $USER_TOKEN" \
    -H "Idempotency-Key: load-test-$i" \
    -d '{
      "campaign_id": "'$CAMPAIGN_ID'",
      "donor_email": "loadtest'$i'@example.com",
      "donor_name": "Load Test User '$i'", 
      "amount": '$((RANDOM % 500 + 10))'
    }' &
done
wait
```

### **2. Rapid Webhook Processing**
```bash
# Send multiple payment webhooks
for i in {1..5}; do
  curl -X POST "$BASE_URL/payments/webhook" \
    -H "Content-Type: application/json" \
    -d '{
      "webhook_id": "wh_load_'$i'",
      "event_type": "payment_intent.succeeded",
      "provider": "stripe",
      "provider_payment_id": "pi_load_'$i'", 
      "amount": '$((RANDOM % 100 + 10))'
    }' &
done
wait
```

### **3. Monitor Service Health During Load**
```bash
# Check all services respond under load
curl -X GET "$BASE_URL/users/me" -H "Authorization: Bearer $USER_TOKEN"
curl -X GET "$BASE_URL/campaigns" -H "Authorization: Bearer $USER_TOKEN" 
curl -X GET "$BASE_URL/totals/stats" -H "Authorization: Bearer $USER_TOKEN"
```

**✅ Expected Results:**
- System handles concurrent requests gracefully
- Load balancing distributes requests across service replicas
- Response times remain under 1 second
- No data inconsistencies or race conditions

---

## 📊 Monitoring & Observability

### **1. Check Service Health**
```bash
# All services should have health endpoints
curl -X GET "http://localhost:8081/health"        # Gateway
curl -X GET "$BASE_URL/users/health"              # User Service
curl -X GET "$BASE_URL/campaigns/health"          # Campaign Service
curl -X GET "$BASE_URL/pledges/health"            # Pledge Service
curl -X GET "$BASE_URL/payments/health"           # Payment Service
curl -X GET "$BASE_URL/totals/health"             # Totals Service
curl -X GET "$BASE_URL/notifications/health"      # Notification Service
```

### **2. Monitor Container Logs**
```bash
# Watch event processing in real-time
docker logs -f api_hackathon_innovatrix-totals-service-1
docker logs -f api_hackathon_innovatrix-payment-service-1
docker logs -f api_hackathon_innovatrix-pledge-service-1
```

### **3. Monitor Redis Events**
```bash
# Watch Redis pub/sub events
docker exec api_hackathon_innovatrix-redis-1 redis-cli monitor
```

### **4. Check Database State**
```bash
# Connect to PostgreSQL
docker exec -it api_hackathon_innovatrix-postgres-1 psql -U postgres -d careforall

# Check tables
\dt
SELECT * FROM campaigns LIMIT 5;
SELECT * FROM pledges LIMIT 5;
SELECT * FROM payments LIMIT 5;
SELECT * FROM outbox_events ORDER BY created_at DESC LIMIT 10;
```

### **5. Access Monitoring Dashboards**
- **Grafana**: http://localhost:3000 - Service metrics, performance dashboards
- **Jaeger**: http://localhost:16686 - Distributed tracing across services
- **Prometheus**: http://localhost:9090 - Raw metrics and alerting

**✅ Expected Results:**
- All health endpoints return 200 OK
- Logs show event processing without errors
- Redis shows events being published and consumed
- Database contains consistent data
- Monitoring dashboards show healthy metrics

---

## 🎯 Complete End-to-End Test Sequence

### **Full Testing Flow (15-20 minutes):**

1. **[2 mins] Authentication**
   - Register user → Login user → Login admin
   
2. **[3 mins] Campaign Management**
   - Create campaign → Get campaigns → Get campaign details
   
3. **[5 mins] Donation Flow (Core)**
   - Create pledge → Test idempotency → Create more pledges
   
4. **[5 mins] Payment Processing**
   - Process payment webhooks → Test state machine → Verify completion
   
5. **[2 mins] Real-time Verification**
   - Check updated totals → Verify event processing
   
6. **[3 mins] Error Testing**
   - Test invalid scenarios → Verify error handling

### **Success Criteria:**
- ✅ All API endpoints respond correctly
- ✅ Idempotency protection works
- ✅ Payment state machine enforces valid transitions
- ✅ Real-time totals update after payment completion
- ✅ Events are published and processed correctly
- ✅ Error scenarios are handled gracefully
- ✅ System remains stable under load
- ✅ All monitoring dashboards show healthy metrics

### **Demo Sequence for Hackathon:**
1. Show user registration/login
2. Create campaign as admin
3. Make donation with idempotency key
4. Retry same donation (show idempotency protection)
5. Process payment through state machine
6. Show real-time totals update
7. Display monitoring dashboards
8. Demonstrate error handling

This testing guide validates the complete microservices architecture with proper idempotency, state machines, event-driven patterns, and observability! 🚀