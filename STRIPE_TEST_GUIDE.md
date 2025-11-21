# Stripe Payment Gateway Test Guide

## Setup Complete ✅

Your Stripe test integration is now configured and running!

### Configuration
- **Test Mode**: Active (using test keys)
- **Secret Key**: Configured in docker-compose.yml
- **Publishable Key**: Available for frontend integration
- **Service Status**: Running with Stripe client initialized

## Testing the Integration

### 1. Check Stripe Status
```bash
# Direct to payment service (bypass gateway)
docker exec api_hackathon_innovatrix-payment-service-1 wget -qO- http://localhost:3004/api/payments/stripe-status
```

### 2. Create Test Payment
```bash
# Create a test PaymentIntent
curl -X POST http://localhost:8080/api/payments/test-stripe \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 2500,
    "currency": "usd",
    "description": "Test donation"
  }'
```

### 3. Create Regular Payment
```bash
curl -X POST http://localhost:8080/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "pledge_id": "test-pledge-001",
    "amount": 5000,
    "currency": "usd",
    "idempotency_key": "unique-key-001",
    "donor_email": "test@example.com"
  }'
```

## Test Card Numbers

Use these test cards for testing:
- **Success**: `4242 4242 4242 4242`
- **Decline**: `4000 0000 0000 9995`
- **Requires Authentication**: `4000 0025 0000 3155`

## Webhook Setup (for production)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/webhooks)
2. Add endpoint URL: `https://your-domain.com/api/payments/webhook/stripe`
3. Select events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.succeeded`
   - `charge.failed`
4. Copy the webhook secret
5. Update `STRIPE_WEBHOOK_SECRET` in docker-compose.yml

## Frontend Integration

To complete the payment flow, add Stripe.js to your frontend:

```javascript
// Initialize Stripe
const stripe = Stripe('pk_test_51SVobkRyZT63UmI38Hen9dd6PSef5mc5C6tsihLJVpEAFmneOdTK1G7yd0Mfj6Yk0e6OBuJPD8r4RoM6MXuuhAWp00AYAsw509');

// After creating PaymentIntent via API, use the client_secret
const { error } = await stripe.confirmPayment({
  elements,
  confirmParams: {
    return_url: 'https://your-site.com/success',
  },
});
```

## Service Logs

Check payment service logs:
```bash
docker-compose logs payment-service -f
```

## Current Status

✅ Stripe client initialized and connected
✅ Test mode active
✅ Payment creation endpoints ready
✅ Webhook handling implemented
⏳ Frontend payment collection (needs Stripe Elements)
⏳ Webhook endpoint registration in Stripe Dashboard

## API Endpoints

- `POST /api/payments` - Create payment for pledge
- `POST /api/payments/test-stripe` - Test Stripe integration
- `GET /api/payments/stripe-status` - Check Stripe configuration
- `POST /api/payments/webhook/stripe` - Stripe webhook endpoint
- `GET /api/payments/:id` - Get payment details
- `GET /api/payments/pledge/:pledgeId` - Get payment by pledge

## Testing Flow

1. Create a pledge through the pledge service
2. Payment service automatically creates a Stripe PaymentIntent
3. Use the client_secret to complete payment on frontend
4. Stripe sends webhook on payment success/failure
5. Payment service updates payment state
6. Events published for other services