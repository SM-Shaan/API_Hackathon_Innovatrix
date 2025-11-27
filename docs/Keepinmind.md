# API Testing Coverage Guide

## Testing Coverage Summary

The `api-testing.http` file provides comprehensive endpoint testing for all services.

| Section | Endpoints Covered | Status |
|---------|------------------|--------|
| 1. Authentication | Register, Login, Profile | Complete |
| 2. Campaigns | CRUD, Search, Totals, Analytics | Complete |
| 3. Pledges + Idempotency | Create with idempotency keys | Complete |
| 4. Payment State Machine | Webhooks (auth/capture/complete/fail) | Complete |
| 5. Analytics | Stats, Recent Donations, Top Donors | Complete |
| 6. Notifications | Email, WebSocket, Read/Unread | Complete |
| 7. Search & Filtering | Category, Status, Date Range | Complete |
| 8. Error Testing | Auth, Validation, Invalid IDs | Complete |
| 9. Load Testing | Random UUIDs, Concurrent requests | Complete |
| 10. Health Checks | All 6 services | Complete |
| 11-13. Advanced Testing | State machine, Security, Edge cases | Complete |

---

## Key Testing Scenarios

### Critical Flows to Test:

1. **Idempotency Testing**
   - Send same request with same `Idempotency-Key` header
   - Verify second request returns cached response
   - Check no duplicate database entries

2. **State Machine Testing**
   - Test valid transitions: PENDING → AUTHORIZED → CAPTURED → COMPLETED
   - Test invalid transitions: CAPTURED → AUTHORIZED (should fail)
   - Verify proper error handling

3. **CQRS Testing**
   - Create pledge via Pledge Service
   - Verify Totals Service updates in real-time
   - Check Redis cache consistency

4. **WebSocket Testing**
   - Connect to `ws://localhost:8081/ws`
   - Subscribe to campaign updates
   - Verify real-time notifications on donations

---

## Quick Test Commands

```bash
# Health check all services
curl http://localhost:8081/api/users/health
curl http://localhost:8081/api/campaigns/health
curl http://localhost:8081/api/pledges/health
curl http://localhost:8081/api/payments/health
curl http://localhost:8081/api/totals/health
curl http://localhost:8081/api/notifications/health

# Test idempotency
curl -X POST http://localhost:8081/api/pledges \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-key-123" \
  -d '{"campaign_id": "xxx", "amount": 100}'

# Run stress test
node tests/stress-test.js
```

---

## Important Notes

- Always use `Idempotency-Key` header for pledge creation
- JWT tokens expire after 24 hours
- Rate limiting: 100 req/s for most endpoints, 50 req/s for totals
- WebSocket notifications require authentication for user-specific messages

---

*Reference: `api-testing.http` in project root*
