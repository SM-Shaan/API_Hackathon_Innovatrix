# 💳 Stripe Payment Gateway Integration Guide

This guide explains how to integrate and use Stripe payment gateway in the payment service.

## 📋 Overview

The payment service now supports Stripe integration with:
- ✅ PaymentIntent creation for donations
- ✅ Webhook signature verification
- ✅ Automatic state machine transitions
- ✅ Idempotency protection
- ✅ Event-driven architecture

## 🔧 Setup

### 1. Get Stripe API Keys

1. Sign up at [Stripe Dashboard](https://dashboard.stripe.com)
2. Get your **Secret Key** (starts with `sk_`)
3. Get your **Webhook Secret** (starts with `whsec_`)

### 2. Configure Environment Variables

Add to your `.env` file or `docker-compose.yml`:

```bash
STRIPE_SECRET_KEY=sk_test_...  # Your Stripe secret key
STRIPE_WEBHOOK_SECRET=whsec_...  # Your webhook signing secret
```

### 3. Update docker-compose.yml

The service already includes Stripe environment variables:

```yaml
payment-service:
  environment:
    - STRIPE_SECRET_KEY=${STRIPE_SECRET_KEY:-}
    - STRIPE_WEBHOOK_SECRET=${STRIPE_WEBHOOK_SECRET:-}
```

Set these in your environment or `.env` file.

## 🚀 Usage

### Creating a Payment with Stripe

When you create a payment, the service automatically:

1. Creates a Stripe PaymentIntent
2. Stores the PaymentIntent ID in the database
3. Returns the payment with Stripe details

**Example Request:**
```bash
POST /api/payments
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "pledge_id": "uuid-here",
  "amount": 100.00,
  "currency": "USD",
  "idempotency_key": "unique-key-123",
  "donor_email": "donor@example.com",
  "campaign_id": "campaign-uuid"
}
```

**Response:**
```json
{
  "payment": {
    "id": "payment-uuid",
    "pledge_id": "pledge-uuid",
    "amount": 100.00,
    "currency": "USD",
    "state": "PENDING",
    "provider": "stripe",
    "provider_payment_id": "pi_1234567890",
    "metadata": {
      "stripe_payment_intent_id": "pi_1234567890"
    }
  },
  "wasIdempotent": false
}
```

### Frontend Integration

Use the `provider_payment_id` (Stripe PaymentIntent ID) in your frontend:

```javascript
// 1. Create payment via your API
const response = await fetch('/api/payments', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    pledge_id: pledgeId,
    amount: amount,
    currency: 'USD',
    idempotency_key: generateIdempotencyKey(),
    donor_email: email,
    campaign_id: campaignId
  })
});

const { payment } = await response.json();
const paymentIntentId = payment.provider_payment_id; // Stripe PaymentIntent ID

// 2. Confirm payment with Stripe.js
const stripe = Stripe('pk_test_...'); // Your publishable key
const { error } = await stripe.confirmPayment({
  clientSecret: paymentIntentId, // Use PaymentIntent client_secret
  confirmParams: {
    return_url: 'https://your-site.com/success',
  },
});
```

## 🔔 Webhook Configuration

### Setting Up Stripe Webhooks

1. Go to [Stripe Dashboard → Webhooks](https://dashboard.stripe.com/webhooks)
2. Click "Add endpoint"
3. Set endpoint URL: `https://your-domain.com/api/payments/webhook/stripe`
4. Select events to listen to:
   - `payment_intent.created`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.succeeded`
   - `charge.failed`
   - `charge.refunded`
5. Copy the **Signing secret** (starts with `whsec_`)
6. Add it to your environment variables

### Webhook Endpoints

**Production (with signature verification):**
```
POST /api/payments/webhook/stripe
```

**Testing/Development (without signature):**
```
POST /api/payments/webhook
```

### Testing Webhooks Locally

Use [Stripe CLI](https://stripe.com/docs/stripe-cli):

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe  # macOS
# or download from https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:8081/api/payments/webhook/stripe

# Trigger test events
stripe trigger payment_intent.succeeded
```

## 📊 Event Flow

```
1. Frontend → POST /api/payments
   ↓
2. Service creates Stripe PaymentIntent
   ↓
3. Returns PaymentIntent ID to frontend
   ↓
4. Frontend confirms payment with Stripe.js
   ↓
5. Stripe processes payment
   ↓
6. Stripe sends webhook → POST /api/payments/webhook/stripe
   ↓
7. Service verifies signature & processes webhook
   ↓
8. State machine transitions: PENDING → AUTHORIZED → COMPLETED
   ↓
9. Events published to Redis (totals service updates)
```

## 🔐 Security Features

### 1. Webhook Signature Verification

All Stripe webhooks are verified using HMAC signatures to prevent spoofing.

### 2. Idempotency

- Payment creation uses idempotency keys
- Webhook processing tracks processed webhooks
- Duplicate requests return the same response

### 3. State Machine

Invalid state transitions are blocked:
- ✅ PENDING → AUTHORIZED → CAPTURED → COMPLETED
- ❌ COMPLETED → PENDING (blocked)

## 🧪 Testing

### Test Mode

Use Stripe test keys (start with `sk_test_`):

```bash
STRIPE_SECRET_KEY=sk_test_51...
STRIPE_WEBHOOK_SECRET=whsec_test_...
```

### Test Cards

Use Stripe test card numbers:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Requires 3D Secure: `4000 0025 0000 3155`

### Manual Webhook Testing

```bash
# Simulate payment success
curl -X POST http://localhost:8081/api/payments/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "webhook_id": "wh_test_123",
    "event_type": "payment_intent.succeeded",
    "provider": "stripe",
    "provider_payment_id": "pi_test_123",
    "amount": 100
  }'
```

## 🐛 Troubleshooting

### PaymentIntent Not Created

**Problem:** Payment created but no Stripe PaymentIntent

**Solution:**
- Check `STRIPE_SECRET_KEY` is set correctly
- Check logs: `docker-compose logs payment-service`
- Service continues without Stripe if key is missing (graceful degradation)

### Webhook Signature Verification Fails

**Problem:** `Invalid webhook signature` error

**Solution:**
- Ensure `STRIPE_WEBHOOK_SECRET` matches your webhook endpoint secret
- Verify webhook endpoint URL matches Stripe dashboard
- For local testing, use `/api/payments/webhook` (no signature check)

### Payment State Not Updating

**Problem:** Webhook received but payment state unchanged

**Solution:**
- Check webhook event type mapping in `stripe-client.ts`
- Verify payment exists: `GET /api/payments/{id}`
- Check logs for state transition errors

## 📚 API Reference

### Create Payment

```http
POST /api/payments
Authorization: Bearer {token}
Content-Type: application/json

{
  "pledge_id": "string (required)",
  "amount": "number (required)",
  "currency": "string (optional, default: USD)",
  "idempotency_key": "string (required)",
  "donor_email": "string (optional)",
  "campaign_id": "string (optional)"
}
```

### Stripe Webhook

```http
POST /api/payments/webhook/stripe
Stripe-Signature: {signature}
Content-Type: application/json

{Stripe Event JSON}
```

### Get Payment

```http
GET /api/payments/{id}
Authorization: Bearer {token}
```

## 🎯 Next Steps

1. ✅ Set up Stripe account and get API keys
2. ✅ Configure environment variables
3. ✅ Update frontend to use Stripe.js
4. ✅ Configure webhook endpoint in Stripe dashboard
5. ✅ Test with Stripe test cards
6. ✅ Monitor webhook processing in logs

## 📖 Additional Resources

- [Stripe API Documentation](https://stripe.com/docs/api)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)
- [Stripe.js Documentation](https://stripe.com/docs/js)
- [Payment Intents API](https://stripe.com/docs/payments/payment-intents)

---

**Note:** The service gracefully degrades if Stripe is not configured - it will still create payment records but won't create Stripe PaymentIntents. This allows the system to work without Stripe for testing.

