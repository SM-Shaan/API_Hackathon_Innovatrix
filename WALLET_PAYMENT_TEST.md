# Mock Wallet Payment System - Test Guide

## ✅ IMPLEMENTATION COMPLETE

Your payment service now uses a **mock wallet system** instead of Stripe! Here's how it works:

### System Overview

1. **User Registration** → Creates a wallet with $100.00 initial balance
2. **Payment Request** → Checks wallet balance → Deducts amount → Updates payment status
3. **Real-time Updates** → Payment events published → Other services notified

### API Endpoints

#### Wallet Management

```bash
# 1. Create a wallet for a user (during registration)
curl -X POST http://localhost:8080/api/payments/wallet/create \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-123", "initial_balance": 10000}'

# 2. Check wallet balance
curl http://localhost:8080/api/payments/wallet/user-123

# 3. Add funds to wallet (for testing)
curl -X POST http://localhost:8080/api/payments/wallet/user-123/add-funds \
  -H "Content-Type: application/json" \
  -d '{"amount": 5000, "description": "Added test funds"}'

# 4. Get transaction history
curl http://localhost:8080/api/payments/wallet/user-123/transactions
```

#### Payment Processing

```bash
# 5. Create a payment (requires user_id now)
curl -X POST http://localhost:8080/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "pledge_id": "pledge-001",
    "amount": 2500,
    "user_id": "user-123",
    "idempotency_key": "payment-001",
    "donor_email": "test@example.com"
  }'
```

### Test Scenarios

#### Scenario 1: Successful Payment
```bash
# Step 1: Create wallet with funds
curl -X POST http://localhost:8080/api/payments/wallet/create \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-123", "initial_balance": 10000}'

# Step 2: Make a payment
curl -X POST http://localhost:8080/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "pledge_id": "pledge-001",
    "amount": 2500,
    "user_id": "user-123",
    "idempotency_key": "payment-001"
  }'

# Step 3: Check updated balance
curl http://localhost:8080/api/payments/wallet/user-123
```

#### Scenario 2: Insufficient Funds
```bash
# Step 1: Create wallet with low funds
curl -X POST http://localhost:8080/api/payments/wallet/create \
  -H "Content-Type: application/json" \
  -d '{"user_id": "user-456", "initial_balance": 1000}'

# Step 2: Try to make payment exceeding balance
curl -X POST http://localhost:8080/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "pledge_id": "pledge-002",
    "amount": 2500,
    "user_id": "user-456",
    "idempotency_key": "payment-002"
  }'

# Expected: Payment fails with "Insufficient balance" error
```

### Database Tables Created

The wallet service creates these tables:

```sql
-- User wallets
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Wallet transaction history
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  amount DECIMAL(15,2) NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('debit', 'credit')),
  description TEXT NOT NULL,
  reference_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Integration with User Registration

To integrate wallet creation with user registration, add this to your user service:

```javascript
// After successful user registration
const response = await fetch('http://payment-service:3004/api/payments/wallet/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    user_id: newUser.id,
    initial_balance: 10000 // $100.00 in cents
  })
});
```

### Payment Flow

1. **User makes pledge** → Pledge service creates pledge
2. **Pledge event published** → Payment service listens
3. **Payment service** → Checks wallet balance → Processes payment
4. **Payment completed** → Events published → Totals updated

### Advantages of Mock System

✅ **No external dependencies** - Works offline  
✅ **Instant payments** - No waiting for webhooks  
✅ **Predictable testing** - Control exact scenarios  
✅ **Full transaction history** - Complete audit trail  
✅ **Idempotency protection** - Prevents duplicate charges  

### Demo Ready!

Your payment system is now completely functional with:
- Real wallet balances that decrease with payments
- Transaction history tracking
- Proper error handling for insufficient funds
- Event-driven architecture
- Complete API for testing

Perfect for hackathon demos and development!