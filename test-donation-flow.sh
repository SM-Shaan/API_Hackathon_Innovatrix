#!/bin/bash

echo "🎯 TESTING COMPLETE DONATION FLOW"
echo "=================================="
echo ""

# Test users (UUIDs)
USER1="550e8400-e29b-41d4-a716-446655440001"
USER2="550e8400-e29b-41d4-a716-446655440002"
CAMPAIGN1="123e4567-e89b-12d3-a456-426614174100"
CAMPAIGN2="123e4567-e89b-12d3-a456-426614174101"

# Get payment service container
PAYMENT_CONTAINER=$(docker ps --filter "name=payment-service" --format "{{.Names}}" | head -1)

echo "📋 Using container: $PAYMENT_CONTAINER"
echo ""

# Scenario 1: New user registration - Create wallet
echo "=== SCENARIO 1: USER REGISTRATION ==="
echo "👤 New user registers: $USER1"
echo "💰 Creating wallet with $200.00 initial balance..."
echo ""

docker exec $PAYMENT_CONTAINER wget -qO- \
    --header="Content-Type: application/json" \
    --post-data="{\"user_id\": \"$USER1\", \"initial_balance\": 20000}" \
    http://localhost:3004/api/payments/wallet/create | jq

echo ""

# Check initial wallet balance
echo "💳 Checking wallet balance..."
docker exec $PAYMENT_CONTAINER wget -qO- \
    http://localhost:3004/api/payments/wallet/$USER1 | jq

echo ""
echo ""

# Scenario 2: First donation attempt
echo "=== SCENARIO 2: FIRST DONATION ATTEMPT ==="
echo "❤️  User wants to donate $50 to Campaign A"
echo "💭 First, let's check if user has enough balance..."
echo ""

BALANCE=$(docker exec $PAYMENT_CONTAINER wget -qO- \
    http://localhost:3004/api/payments/wallet/$USER1 | jq -r '.wallet.balance')

DONATION_AMOUNT=5000  # $50.00 in cents
echo "💰 Current Balance: \$$((${BALANCE%.*} / 100)).${BALANCE#*.}"
echo "💸 Donation Amount: \$50.00"

if (( $(echo "$BALANCE >= $DONATION_AMOUNT" | bc -l) )); then
    echo "✅ SUFFICIENT FUNDS - Processing donation..."
    echo ""
    
    # Process the donation
    docker exec $PAYMENT_CONTAINER wget -qO- \
        --header="Content-Type: application/json" \
        --post-data="{\"pledge_id\": \"$CAMPAIGN1\", \"amount\": $DONATION_AMOUNT, \"user_id\": \"$USER1\", \"idempotency_key\": \"donation-001\", \"campaign_id\": \"$CAMPAIGN1\", \"donor_email\": \"user1@example.com\"}" \
        http://localhost:3004/api/payments | jq
    
    echo ""
    echo "💳 Updated wallet balance:"
    docker exec $PAYMENT_CONTAINER wget -qO- \
        http://localhost:3004/api/payments/wallet/$USER1 | jq
else
    echo "❌ INSUFFICIENT FUNDS - Donation rejected"
fi

echo ""
echo ""

# Scenario 3: Multiple donations
echo "=== SCENARIO 3: MULTIPLE DONATIONS ==="
echo "❤️  User wants to make another donation of $100 to Campaign B"
echo ""

BALANCE=$(docker exec $PAYMENT_CONTAINER wget -qO- \
    http://localhost:3004/api/payments/wallet/$USER1 | jq -r '.wallet.balance')

DONATION_AMOUNT2=10000  # $100.00 in cents
echo "💰 Current Balance: \$$((${BALANCE%.*} / 100)).${BALANCE#*.}"
echo "💸 Donation Amount: \$100.00"

if (( $(echo "$BALANCE >= $DONATION_AMOUNT2" | bc -l) )); then
    echo "✅ SUFFICIENT FUNDS - Processing second donation..."
    echo ""
    
    docker exec $PAYMENT_CONTAINER wget -qO- \
        --header="Content-Type: application/json" \
        --post-data="{\"pledge_id\": \"$CAMPAIGN2\", \"amount\": $DONATION_AMOUNT2, \"user_id\": \"$USER1\", \"idempotency_key\": \"donation-002\", \"campaign_id\": \"$CAMPAIGN2\", \"donor_email\": \"user1@example.com\"}" \
        http://localhost:3004/api/payments | jq
    
    echo ""
    echo "💳 Final wallet balance:"
    docker exec $PAYMENT_CONTAINER wget -qO- \
        http://localhost:3004/api/payments/wallet/$USER1 | jq
else
    echo "❌ INSUFFICIENT FUNDS - Second donation rejected"
fi

echo ""
echo ""

# Scenario 4: Attempt donation exceeding balance
echo "=== SCENARIO 4: LARGE DONATION ATTEMPT ==="
echo "❤️  User tries to donate $200 (more than remaining balance)"
echo ""

BALANCE=$(docker exec $PAYMENT_CONTAINER wget -qO- \
    http://localhost:3004/api/payments/wallet/$USER1 | jq -r '.wallet.balance')

DONATION_AMOUNT3=20000  # $200.00 in cents
echo "💰 Current Balance: \$$((${BALANCE%.*} / 100)).${BALANCE#*.}"
echo "💸 Donation Amount: \$200.00"

if (( $(echo "$BALANCE >= $DONATION_AMOUNT3" | bc -l) )); then
    echo "✅ SUFFICIENT FUNDS - Processing large donation..."
    
    docker exec $PAYMENT_CONTAINER wget -qO- \
        --header="Content-Type: application/json" \
        --post-data="{\"pledge_id\": \"$CAMPAIGN1\", \"amount\": $DONATION_AMOUNT3, \"user_id\": \"$USER1\", \"idempotency_key\": \"donation-003\"}" \
        http://localhost:3004/api/payments | jq
else
    echo "❌ INSUFFICIENT FUNDS - Large donation will be rejected"
    echo "🔄 Let's try anyway to see the error handling..."
    echo ""
    
    docker exec $PAYMENT_CONTAINER wget -qO- \
        --header="Content-Type: application/json" \
        --post-data="{\"pledge_id\": \"123e4567-e89b-12d3-a456-426614174102\", \"amount\": $DONATION_AMOUNT3, \"user_id\": \"$USER1\", \"idempotency_key\": \"donation-003\"}" \
        http://localhost:3004/api/payments | jq
fi

echo ""
echo ""

# Scenario 5: User with insufficient funds from start
echo "=== SCENARIO 5: POOR USER SCENARIO ==="
echo "👤 New user with low funds: $USER2"
echo "💰 Creating wallet with only $10.00..."
echo ""

docker exec $PAYMENT_CONTAINER wget -qO- \
    --header="Content-Type: application/json" \
    --post-data="{\"user_id\": \"$USER2\", \"initial_balance\": 1000}" \
    http://localhost:3004/api/payments/wallet/create | jq

echo ""
echo "❤️  User tries to donate $25.00"

DONATION_AMOUNT4=2500  # $25.00 in cents
echo "💸 Donation Amount: \$25.00"
echo "🔄 Attempting donation..."
echo ""

docker exec $PAYMENT_CONTAINER wget -qO- \
    --header="Content-Type: application/json" \
    --post-data="{\"pledge_id\": \"$CAMPAIGN1\", \"amount\": $DONATION_AMOUNT4, \"user_id\": \"$USER2\", \"idempotency_key\": \"donation-004\"}" \
    http://localhost:3004/api/payments | jq

echo ""
echo ""

# Show complete transaction history
echo "=== TRANSACTION HISTORY SUMMARY ==="
echo ""
echo "💳 User 1 Transaction History:"
docker exec $PAYMENT_CONTAINER wget -qO- \
    http://localhost:3004/api/payments/wallet/$USER1/transactions | jq '.transactions[] | {amount: .amount, type: .type, description: .description, created_at: .created_at}'

echo ""
echo "💳 User 2 Transaction History:"
docker exec $PAYMENT_CONTAINER wget -qO- \
    http://localhost:3004/api/payments/wallet/$USER2/transactions | jq '.transactions[] | {amount: .amount, type: .type, description: .description, created_at: .created_at}'

echo ""
echo "🎯 DONATION FLOW TESTING COMPLETE!"
echo "=================================="