# Notification Service Setup Guide

## Overview

The notification service supports:
- **Email notifications** (SMTP - Gmail, etc.)
- **WebSocket real-time notifications**
- **Event-driven notifications** (Redis pub/sub)

---

## 1. Gmail SMTP Setup

### Step 1: Enable 2-Factor Authentication
1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification**

### Step 2: Generate App Password
1. Go to [App Passwords](https://myaccount.google.com/apppasswords)
2. Select app: **Mail**
3. Select device: **Other** (enter "CareForAll")
4. Click **Generate**
5. Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)

### Step 3: Update Environment Variables

Add these to `docker-compose.yml` under `notification-service`:

```yaml
notification-service:
  build: ./services/notification-service
  environment:
    - PORT=3006
    - DB_HOST=postgres
    - DB_PORT=5432
    - DB_NAME=careforall
    - DB_USER=postgres
    - DB_PASSWORD=postgres
    - REDIS_URL=redis://redis:6379
    - JWT_SECRET=careforall-jwt-secret-change-in-production
    # Gmail SMTP Configuration
    - SMTP_HOST=smtp.gmail.com
    - SMTP_PORT=587
    - SMTP_SECURE=false
    - SMTP_USER=your-email@gmail.com
    - SMTP_PASS=abcd efgh ijkl mnop  # App password (no spaces)
    - EMAIL_FROM=CareForAll <your-email@gmail.com>
```

### Step 4: Restart Services

```bash
docker-compose down notification-service
docker-compose up -d notification-service
```

---

## 2. Alternative: Using MailHog (Development/Demo)

MailHog is a local email testing tool that captures all emails.

### Add MailHog to docker-compose.yml:

```yaml
services:
  # ... other services ...

  mailhog:
    image: mailhog/mailhog:latest
    ports:
      - "1025:1025"   # SMTP server
      - "8025:8025"   # Web UI
    networks:
      - careforall-network

  notification-service:
    environment:
      # ... other env vars ...
      - SMTP_HOST=mailhog
      - SMTP_PORT=1025
      # No auth needed for MailHog
```

### View Captured Emails:
Open http://localhost:8025 to see all captured emails.

---

## 3. Testing Notifications

### 3.1 Test Email Notification (Manual Send)

```bash
# Send a test notification
curl -X POST http://localhost:8081/api/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "type": "EMAIL",
    "subject": "Test Notification",
    "content": "<h1>Hello!</h1><p>This is a test email from CareForAll.</p>"
  }'
```

### 3.2 Test Donation Notification Flow

```bash
# 1. Create a pledge (triggers pledge.created event)
TOKEN="your-jwt-token"
CAMPAIGN_ID="your-campaign-id"

curl -X POST http://localhost:8081/api/pledges \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "campaign_id": "'$CAMPAIGN_ID'",
    "amount": 100,
    "donor_name": "Test Donor",
    "donor_email": "donor@example.com",
    "idempotency_key": "test-notification-001"
  }'

# 2. Complete the pledge (triggers notification)
PLEDGE_ID="pledge-id-from-response"
curl -X POST "http://localhost:8081/api/pledges/$PLEDGE_ID/complete"
```

### 3.3 Test WebSocket Notifications

```javascript
// Connect to WebSocket (in browser console or Node.js)
const ws = new WebSocket('ws://localhost:8081/ws');

// Authenticate (optional)
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    userId: 'your-user-id',
    email: 'your@email.com'
  }));
};

// Listen for notifications
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

// Subscribe to campaign updates
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'campaign:your-campaign-id'
}));
```

### 3.4 Get Notification History

```bash
# Get notifications by email
curl "http://localhost:8081/api/notifications?email=donor@example.com"

# Get notifications by user ID
curl "http://localhost:8081/api/notifications?userId=user-uuid"

# Get unread count
curl "http://localhost:8081/api/notifications/unread/count?userId=user-uuid"
```

### 3.5 Mark Notifications as Read

```bash
# Mark single notification as read
curl -X POST "http://localhost:8081/api/notifications/NOTIFICATION_ID/read"

# Mark all as read for user
curl -X POST "http://localhost:8081/api/notifications/read-all" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid"}'
```

---

## 4. Event Types That Trigger Notifications

| Event | Notification Type | Recipient |
|-------|------------------|-----------|
| `pledge.completed` | Email + WebSocket | Donor |
| `payment.completed` | Email | Donor |
| `campaign.goal_reached` | Email + Broadcast | Campaign Owner + All |
| `user.registered` | Email | New User |

---

## 5. Publishing Events (For Testing)

You can manually publish events to Redis to trigger notifications:

```bash
# Connect to Redis container
docker exec -it api_hackathon_innovatrix-redis-1 redis-cli

# Publish a test event
PUBLISH events '{"id":"test-001","type":"pledge.completed","aggregateType":"pledge","aggregateId":"pledge-123","payload":{"donorEmail":"test@example.com","donorName":"John","amount":100,"campaignTitle":"Help Flood Victims","pledgeId":"pledge-123"},"timestamp":"2025-01-01T00:00:00Z"}'
```

---

## 6. Troubleshooting

### Check Notification Service Logs
```bash
docker logs api_hackathon_innovatrix-notification-service-1 -f
```

### Verify SMTP Connection
```bash
# Inside the container
docker exec -it api_hackathon_innovatrix-notification-service-1 sh
# Test connection
nc -zv smtp.gmail.com 587
```

### Common Issues

| Issue | Solution |
|-------|----------|
| "Invalid credentials" | Check App Password (remove spaces) |
| "Connection timeout" | Check firewall, use port 587 |
| "Less secure app" | Use App Password, not regular password |
| No emails received | Check spam folder, verify SMTP_USER |

---

## 7. Email Templates

The service includes these templates:
- **donationReceivedTemplate** - Sent when donation is completed
- **campaignGoalReachedTemplate** - Sent when campaign reaches goal
- **paymentConfirmedTemplate** - Sent when payment is confirmed
- **Welcome email** - Sent on user registration

All templates are styled with CareForAll branding.
