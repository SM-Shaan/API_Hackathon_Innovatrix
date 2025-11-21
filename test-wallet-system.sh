#!/bin/bash

echo "🧪 Testing Mock Wallet Payment System"
echo "====================================="
echo ""

# Get payment service container name
PAYMENT_CONTAINER=$(docker ps --filter "name=payment-service" --format "{{.Names}}" | head -1)

if [ -z "$PAYMENT_CONTAINER" ]; then
    echo "❌ Payment service container not found!"
    exit 1
fi

echo "📋 Using container: $PAYMENT_CONTAINER"
echo ""

# Test 1: Create a wallet
echo "🔸 Test 1: Creating wallet for user-123"
echo "----------------------------------------"
docker exec $PAYMENT_CONTAINER wget -qO- \
    --header="Content-Type: application/json" \
    --post-data='{"user_id": "user-123", "initial_balance": 10000}' \
    http://localhost:3004/api/payments/wallet/create

echo ""
echo ""

# Test 2: Check wallet balance
echo "🔸 Test 2: Checking wallet balance"
echo "-----------------------------------"
docker exec $PAYMENT_CONTAINER wget -qO- \
    http://localhost:3004/api/payments/wallet/user-123

echo ""
echo ""

# Test 3: Create a payment
echo "🔸 Test 3: Creating payment (should succeed)"
echo "---------------------------------------------"
docker exec $PAYMENT_CONTAINER wget -qO- \
    --header="Content-Type: application/json" \
    --post-data='{"pledge_id": "pledge-001", "amount": 2500, "user_id": "user-123", "idempotency_key": "pay-001"}' \
    http://localhost:3004/api/payments

echo ""
echo ""

# Test 4: Check wallet balance after payment
echo "🔸 Test 4: Checking wallet balance after payment"
echo "-------------------------------------------------"
docker exec $PAYMENT_CONTAINER wget -qO- \
    http://localhost:3004/api/payments/wallet/user-123

echo ""
echo ""

# Test 5: Try payment with insufficient funds
echo "🔸 Test 5: Creating payment with insufficient funds"
echo "---------------------------------------------------"
docker exec $PAYMENT_CONTAINER wget -qO- \
    --header="Content-Type: application/json" \
    --post-data='{"pledge_id": "pledge-002", "amount": 50000, "user_id": "user-123", "idempotency_key": "pay-002"}' \
    http://localhost:3004/api/payments

echo ""
echo ""

# Test 6: Get transaction history
echo "🔸 Test 6: Getting transaction history"
echo "---------------------------------------"
docker exec $PAYMENT_CONTAINER wget -qO- \
    http://localhost:3004/api/payments/wallet/user-123/transactions

echo ""
echo ""
echo "✅ Test completed! Check results above."