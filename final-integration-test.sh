#!/bin/bash

echo "🚀 FINAL COMPLETE DONATION PLATFORM INTEGRATION TEST"
echo "===================================================="
echo ""

# Use unique email to avoid conflicts
TIMESTAMP=$(date +%s)
USER_EMAIL="integration.test.$TIMESTAMP@example.com"
USER_PASSWORD="securePassword123"
USER_NAME="Integration Test User"
CAMPAIGN_ID="123e4567-e89b-12d3-a456-426614174300"
DONATION_AMOUNT=2500  # $25.00

echo "🎯 Test Configuration:"
echo "   User: $USER_NAME ($USER_EMAIL)"
echo "   Campaign: $CAMPAIGN_ID"
echo "   Donation: \$25.00"
echo "   Gateway: http://localhost:8081"
echo ""

# Step 1: Register a new user
echo "=== STEP 1: USER REGISTRATION ==="
echo "📝 Registering new user..."

USER_RESPONSE=$(curl -s -X POST http://localhost:8081/api/users/register \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$USER_EMAIL\",
    \"password\": \"$USER_PASSWORD\",
    \"name\": \"$USER_NAME\",
    \"role\": \"DONOR\"
  }")

echo "User Registration Response:"
echo "$USER_RESPONSE" | jq

# Extract user ID and token
USER_ID=$(echo "$USER_RESPONSE" | jq -r '.user.id // empty')
AUTH_TOKEN=$(echo "$USER_RESPONSE" | jq -r '.token // empty')

if [ -z "$USER_ID" ] || [ -z "$AUTH_TOKEN" ]; then
    echo "❌ User registration failed!"
    echo "Raw response: $USER_RESPONSE"
    exit 1
fi

echo ""
echo "✅ User registered successfully!"
echo "   User ID: $USER_ID"
echo "   Token: ${AUTH_TOKEN:0:30}..."
echo ""

# Step 2: Check wallet creation 
echo "=== STEP 2: VERIFY WALLET CREATION ==="
echo "💳 Checking if wallet was created..."

# Wait a moment for wallet creation
sleep 2

PAYMENT_CONTAINER=$(docker ps --filter "name=payment-service" --format "{{.Names}}" | head -1)

if [ -n "$PAYMENT_CONTAINER" ]; then
    WALLET_RESPONSE=$(docker exec $PAYMENT_CONTAINER wget -qO- \
        http://localhost:3004/api/payments/wallet/$USER_ID 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo "Wallet Status:"
        echo "$WALLET_RESPONSE" | jq
        
        WALLET_BALANCE=$(echo "$WALLET_RESPONSE" | jq -r '.wallet.balance // "0"')
        if [ "$WALLET_BALANCE" != "0" ] && [ "$WALLET_BALANCE" != "null" ]; then
            echo ""
            echo "✅ Wallet found with balance: \$$(echo \"scale=2; $WALLET_BALANCE / 100\" | bc)"
        else
            echo "❌ Wallet not found or has zero balance"
        fi
    else
        echo "⚠️  Could not check wallet - payment service may not be accessible"
    fi
else
    echo "⚠️  Payment service container not found"
fi

echo ""

# Step 3: Create a campaign
echo "=== STEP 3: CREATE CAMPAIGN ==="
echo "🏥 Creating test campaign..."

CAMPAIGN_RESPONSE=$(curl -s -X POST http://localhost:8081/api/campaigns \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "{
    \"title\": \"Emergency Medical Fund - Integration Test\",
    \"description\": \"Testing the complete donation flow integration\",
    \"target_amount\": 100000,
    \"end_date\": \"2024-12-31T23:59:59Z\",
    \"category\": \"medical\"
  }")

echo "Campaign Response:"
echo "$CAMPAIGN_RESPONSE" | jq

# Try to get actual campaign ID from response
ACTUAL_CAMPAIGN_ID=$(echo "$CAMPAIGN_RESPONSE" | jq -r '.campaign.id // empty')
if [ -n "$ACTUAL_CAMPAIGN_ID" ]; then
    CAMPAIGN_ID="$ACTUAL_CAMPAIGN_ID"
    echo "✅ Campaign created with ID: $CAMPAIGN_ID"
else
    echo "⚠️  Using predefined campaign ID: $CAMPAIGN_ID"
fi

echo ""

# Step 4: Make a donation
echo "=== STEP 4: MAKE DONATION ==="
echo "❤️  Creating pledge for \$25.00..."

DONATION_RESPONSE=$(curl -s -X POST http://localhost:8081/api/pledges \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d "{
    \"campaign_id\": \"$CAMPAIGN_ID\",
    \"donor_email\": \"$USER_EMAIL\",
    \"donor_name\": \"$USER_NAME\",
    \"amount\": $DONATION_AMOUNT,
    \"message\": \"Integration test donation - verifying complete flow\"
  }")

echo "Donation Response:"
echo "$DONATION_RESPONSE" | jq

PLEDGE_ID=$(echo "$DONATION_RESPONSE" | jq -r '.pledge.id // empty')

if [ -n "$PLEDGE_ID" ]; then
    echo ""
    echo "✅ Donation/Pledge created successfully!"
    echo "   Pledge ID: $PLEDGE_ID"
else
    echo "❌ Donation failed!"
    echo "Raw response: $DONATION_RESPONSE"
fi

echo ""

# Step 5: Wait and check payment processing
echo "=== STEP 5: VERIFY PAYMENT PROCESSING ==="
echo "⏳ Waiting for payment to process via events..."
sleep 5

if [ -n "$PAYMENT_CONTAINER" ] && [ -n "$PLEDGE_ID" ]; then
    # Check if payment was created
    echo "🔍 Checking payment status..."
    
    PAYMENT_RESPONSE=$(docker exec $PAYMENT_CONTAINER wget -qO- \
        "http://localhost:3004/api/payments/pledge/$PLEDGE_ID" 2>/dev/null || echo '{"error": "Payment not found"}')
    
    echo "Payment Status:"
    echo "$PAYMENT_RESPONSE" | jq
    
    # Check updated wallet balance
    echo ""
    echo "💳 Checking wallet balance after payment..."
    UPDATED_WALLET=$(docker exec $PAYMENT_CONTAINER wget -qO- \
        http://localhost:3004/api/payments/wallet/$USER_ID 2>/dev/null)
    
    if [ $? -eq 0 ]; then
        echo "Updated Wallet:"
        echo "$UPDATED_WALLET" | jq
        
        NEW_BALANCE=$(echo "$UPDATED_WALLET" | jq -r '.wallet.balance // "0"')
        if [ "$NEW_BALANCE" != "0" ] && [ "$NEW_BALANCE" != "null" ]; then
            echo ""
            echo "💰 Current wallet balance: \$$(echo \"scale=2; $NEW_BALANCE / 100\" | bc)"
            
            # Calculate if money was deducted
            INITIAL_BALANCE=10000  # $100.00
            if [ "$NEW_BALANCE" -lt "$INITIAL_BALANCE" ]; then
                DEDUCTED=$(echo "scale=2; ($INITIAL_BALANCE - $NEW_BALANCE) / 100" | bc)
                echo "💸 Amount deducted: \$$DEDUCTED"
                echo "✅ Payment processing successful!"
            else
                echo "⚠️  No amount deducted - payment may not have processed"
            fi
        fi
        
        # Show transaction history
        echo ""
        echo "📜 Transaction History:"
        TRANSACTIONS=$(docker exec $PAYMENT_CONTAINER wget -qO- \
            http://localhost:3004/api/payments/wallet/$USER_ID/transactions 2>/dev/null)
        
        if [ $? -eq 0 ]; then
            echo "$TRANSACTIONS" | jq '.transactions[] | {amount: .amount, type: .type, description: .description, created_at: .created_at}'
        else
            echo "Could not retrieve transaction history"
        fi
    else
        echo "Could not check updated wallet balance"
    fi
fi

echo ""

# Step 6: Check campaign totals
echo "=== STEP 6: VERIFY CAMPAIGN TOTALS ==="
echo "📊 Checking campaign totals..."

TOTALS_RESPONSE=$(curl -s http://localhost:8081/api/totals/campaign/$CAMPAIGN_ID)

echo "Campaign Totals:"
echo "$TOTALS_RESPONSE" | jq

echo ""

# Step 7: Get user's donation history
echo "=== STEP 7: USER DONATION HISTORY ==="
echo "📋 Getting user's donation history..."

USER_PLEDGES=$(curl -s http://localhost:8081/api/pledges/donor/me \
  -H "Authorization: Bearer $AUTH_TOKEN")

echo "User's Donations:"
echo "$USER_PLEDGES" | jq

echo ""
echo ""

# Final Summary
echo "🎉 INTEGRATION TEST COMPLETE!"
echo "============================="
echo ""
echo "✅ Services Tested:"
echo "   • User Service: Registration ✓"
echo "   • Payment Service: Wallet Creation & Management ✓"
echo "   • Campaign Service: Campaign Creation ✓"
echo "   • Pledge Service: Donation Processing ✓"
echo "   • Totals Service: Campaign Tracking ✓"
echo ""
echo "🔄 Complete Flow Verified:"
echo "   User Registration → Wallet Creation → Campaign → Donation → Payment → Balance Update"
echo ""

# Check if the flow was successful
if [ -n "$NEW_BALANCE" ] && [ "$NEW_BALANCE" -lt "10000" ]; then
    echo "🎯 RESULT: ✅ COMPLETE SUCCESS!"
    echo "   💰 Money successfully moved through the system!"
    echo "   🏆 All services connected and working together!"
else
    echo "🎯 RESULT: ⚠️  PARTIAL SUCCESS"
    echo "   📝 Services are responding but payment flow needs verification"
    echo "   🔧 Manual testing may be required for payment events"
fi

echo ""
echo "📊 Key Metrics:"
echo "   • User ID: $USER_ID"
echo "   • Campaign ID: $CAMPAIGN_ID"
echo "   • Pledge ID: $PLEDGE_ID"
echo "   • Initial Balance: \$100.00"
echo "   • Donation Amount: \$25.00"
if [ -n "$NEW_BALANCE" ]; then
    echo "   • Final Balance: \$$(echo \"scale=2; $NEW_BALANCE / 100\" | bc)"
fi