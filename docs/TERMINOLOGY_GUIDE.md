# Technical Terminology Guide

> A beginner-friendly guide to all the technical concepts used in the CareForAll platform.
> Think of this as "Tech Concepts Explained Like You're 5" (but for developers)!

---

## Table of Contents

1. [Architecture Patterns](#1-architecture-patterns)
2. [Design Patterns](#2-design-patterns)
3. [Infrastructure Concepts](#3-infrastructure-concepts)
4. [Observability & Monitoring](#4-observability--monitoring)
5. [Security Concepts](#5-security-concepts)
6. [Database Concepts](#6-database-concepts)
7. [Asynchronous Processing](#7-asynchronous-processing)
8. [Error Handling & Resilience](#8-error-handling--resilience)
9. [API Concepts](#9-api-concepts)
10. [DevOps Concepts](#10-devops-concepts)

---

## 1. Architecture Patterns

### Microservices Architecture

**Simple Explanation:**
Imagine a restaurant. Instead of one person doing everything (cooking, serving, billing), you have specialized staff - a chef, a waiter, and a cashier. Each person is an expert at their job.

**In Our Project:**
Instead of one giant application, we have 6 small services:
- **User Service** - Handles user accounts (like the receptionist)
- **Campaign Service** - Manages fundraising campaigns (like the menu manager)
- **Pledge Service** - Handles donation promises (like the order taker)
- **Payment Service** - Processes payments (like the cashier)
- **Totals Service** - Keeps track of donation totals (like the accountant)
- **Notification Service** - Sends alerts and messages (like the announcement system)

**Why It's Good:**
- If the notification system breaks, people can still donate
- Each service can be updated independently
- Different teams can work on different services

**Where It's Used:** The entire `services/` folder structure

---

### Event-Driven Architecture

**Simple Explanation:**
Think of a domino effect. When one domino falls (an event happens), it triggers the next one to fall, and so on. Services don't directly talk to each other - they just announce what happened, and whoever cares about it can react.

**Real-World Analogy:**
You post on social media: "I just donated $100!" (event). Your friends see it and might:
- Like it (Notification Service reacts)
- Update their "friends who donated" list (Totals Service reacts)
- Nothing at all (Payment Service doesn't care)

**In Our Project:**
When someone makes a pledge:
1. Pledge Service says: "Hey everyone, a new pledge was made!"
2. Totals Service hears it and updates the campaign total
3. Notification Service hears it and sends a "thank you" email

**Where It's Used:** `services/pledge-service/src/outbox-worker.ts`, `services/totals-service/src/event-subscriber.ts`

---

### CQRS (Command Query Responsibility Segregation)

**Simple Explanation:**
Imagine a library. The librarian who puts books on shelves (writing) is different from the one who helps you find books (reading). They have different jobs optimized for different tasks.

**Breaking Down the Name:**
- **Command** = "Do something" (create, update, delete)
- **Query** = "Tell me something" (read data)
- **Segregation** = Keep them separate

**In Our Project:**
- **Writing:** When you donate, it goes to the PostgreSQL database
- **Reading:** When you check campaign totals, it reads from Redis cache (super fast!)

**Why It's Good:**
- Reading is much faster because it uses pre-calculated data
- Writing doesn't slow down reading operations
- Each can be scaled independently

**Where It's Used:** `services/totals-service/`

---

### API Gateway Pattern

**Simple Explanation:**
Think of a hotel concierge. Instead of guests wandering around looking for the restaurant, gym, or spa, they ask the concierge who directs them to the right place.

**In Our Project:**
Nginx acts as the "front door" to our application:
- User wants to log in? Gateway sends them to User Service
- User wants to donate? Gateway sends them to Pledge Service
- User wants to see campaigns? Gateway sends them to Campaign Service

**Why It's Good:**
- Users only need to know ONE address
- Security checks happen in one place
- Load balancing (sharing work among servers)

**Where It's Used:** `gateway/` directory, Nginx configuration

---

## 2. Design Patterns

### Outbox Pattern

**Simple Explanation:**
Imagine you're writing letters. Instead of running to the mailbox every time you finish a letter, you put them in an "outbox" tray on your desk. Later, someone collects all letters and mails them together.

**The Problem It Solves:**
What if your app crashes RIGHT AFTER saving a donation but BEFORE sending the notification? The donation is saved, but no one knows about it!

**How It Works:**
1. When a pledge is created, we save TWO things in ONE database transaction:
   - The pledge itself
   - An "event" in the outbox table saying "new pledge created"
2. A background worker checks the outbox every second
3. Worker publishes events to Redis
4. Worker marks events as "sent"

**Why It's Brilliant:**
- If the app crashes after step 1, the event is already saved - it will be sent later
- Nothing gets lost!

**Where It's Used:** `services/pledge-service/src/outbox.ts`, `services/pledge-service/src/outbox-worker.ts`

```
┌─────────────────────────────────────────────────────────┐
│                    OUTBOX PATTERN                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│   1. User makes pledge                                   │
│         │                                                │
│         ▼                                                │
│   ┌─────────────┐      SINGLE TRANSACTION               │
│   │  Database   │  ◄─────────────────────────┐          │
│   │             │                             │          │
│   │  Pledge ✓   │   INSERT pledge             │          │
│   │  Outbox ✓   │   INSERT outbox_event       │          │
│   └─────────────┘                             │          │
│         │                                     │          │
│         │ (later)                                        │
│         ▼                                                │
│   ┌─────────────┐                                        │
│   │   Worker    │ ── Reads outbox every 1 second        │
│   └─────────────┘                                        │
│         │                                                │
│         ▼                                                │
│   ┌─────────────┐                                        │
│   │   Redis     │ ── Publishes event                    │
│   └─────────────┘                                        │
│         │                                                │
│         ▼                                                │
│   Other services receive the event!                      │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

### Idempotency Pattern

**Simple Explanation:**
Press an elevator button once, the elevator comes. Press it 100 times, the elevator still comes just once - it doesn't come 100 times!

**The Problem It Solves:**
What if someone's internet is slow and they click "Donate $100" button three times? We don't want to charge them $300!

**How It Works:**
1. Every request has a unique "idempotency key" (like a receipt number)
2. First time we see this key: Process the request, save the key
3. Second time we see the same key: "Already did this, here's the previous result"

**Real Example:**
```
Request 1: {key: "abc123", amount: $100} → Process donation → Save key
Request 2: {key: "abc123", amount: $100} → "Already processed, here's your receipt"
Request 3: {key: "abc123", amount: $100} → "Already processed, here's your receipt"
```

**Where It's Used:** `services/pledge-service/src/idempotency.ts`, `services/payment-service/src/idempotency.ts`

---

### State Machine Pattern

**Simple Explanation:**
Think of a traffic light. It can only be RED, YELLOW, or GREEN. And it can only change in certain ways:
- GREEN → YELLOW ✓
- YELLOW → RED ✓
- RED → GREEN ✓
- GREEN → RED ✗ (can't skip yellow!)

**In Our Project (Payment States):**
```
PENDING → AUTHORIZED → CAPTURED → COMPLETED
    ↓          ↓           ↓
  FAILED     FAILED      FAILED
```

**Rules:**
- Can't go backwards (CAPTURED → AUTHORIZED is not allowed)
- Can't skip states (PENDING → COMPLETED is not allowed)
- Can fail from any state

**Why It's Important:**
- Prevents weird situations like "completed but not authorized"
- Makes debugging easier - you know exactly what states are possible
- Business rules are enforced by code

**Where It's Used:** `services/payment-service/src/state-machine.ts`

---

### Repository Pattern

**Simple Explanation:**
Imagine a warehouse manager. You don't go into the warehouse yourself - you tell the manager "I need product X" and they get it for you. You don't need to know WHERE it's stored.

**In Our Project:**
Instead of writing database queries everywhere, we have a "repository" that handles all data access:

```typescript
// Without Repository (messy, repeated everywhere)
const result = await db.query('SELECT * FROM pledges WHERE id = $1', [id]);

// With Repository (clean, reusable)
const pledge = await pledgeRepository.findById(id);
```

**Why It's Good:**
- Change database? Only update the repository, not 100 files
- Testing is easier - just mock the repository
- Code is cleaner and more organized

**Where It's Used:** All `repository.ts` files in each service

---

### Factory Pattern

**Simple Explanation:**
A car factory doesn't just give you random car parts - it gives you a fully assembled, ready-to-use car. You just say "I want a red sedan" and get one.

**In Our Project:**
Instead of creating objects piece by piece, we have factory functions:

```typescript
// Creates a fully configured logger
const logger = createLogger('pledge-service');

// Creates fully configured routes with all dependencies
const routes = createPledgeRoutes(pool, redis, logger);
```

**Why It's Good:**
- Consistent configuration everywhere
- Complex object creation in one place
- Easy to change how objects are created

**Where It's Used:** `createLogger()`, `createPledgeRoutes()`, `createPaymentRoutes()`

---

## 3. Infrastructure Concepts

### Containerization (Docker)

**Simple Explanation:**
Imagine you're moving to a new house. Instead of packing each item separately and worrying "will my lamp work with their electricity?", you put your entire room in a shipping container - furniture, electricity, everything. When it arrives, it works exactly the same.

**What Docker Does:**
- Packages your app with EVERYTHING it needs (Node.js, libraries, configurations)
- Works the same on any computer
- "But it works on my machine!" → Now it works everywhere!

**Key Terms:**
- **Image:** The blueprint (like a recipe)
- **Container:** A running instance of an image (like the actual cake)
- **Dockerfile:** Instructions to build the image

**Where It's Used:** All `Dockerfile` files, `docker-compose.yml`

---

### Container Orchestration (Docker Compose)

**Simple Explanation:**
Docker runs ONE container. But we have 6 services + database + Redis + Nginx... Docker Compose is like a conductor leading an orchestra - it starts everything in the right order and makes sure they can talk to each other.

**What docker-compose.yml Does:**
- Defines all services
- Sets up networking between them
- Configures environment variables
- Manages startup order (database before services)
- Handles restarts on failure

**Where It's Used:** `docker-compose.yml`

---

### Load Balancing

**Simple Explanation:**
Imagine a busy supermarket with 10 checkout counters but only 1 cashier. Everyone waits in a long line. Now imagine 10 cashiers - customers are distributed evenly. That's load balancing!

**In Our Project:**
- We might have 3 copies of Pledge Service running
- Nginx distributes requests among them
- If one is busy, requests go to another

**Why It's Important:**
- Handles more users
- If one service crashes, others keep working
- Better performance

**Where It's Used:** Nginx configuration, Docker Compose `replicas` setting

---

### Message Queue / Pub-Sub

**Simple Explanation:**

**Message Queue (like a mailbox):**
You put a letter in someone's mailbox. They'll get it when they check. The letter waits until collected.

**Pub-Sub (like a radio station):**
The radio station broadcasts music. Anyone who's tuned in hears it. If you're not listening, you miss it.

**In Our Project:**
We use Redis Pub-Sub:
1. Pledge Service "publishes" an event: "New pledge created!"
2. Totals Service is "subscribed" - it hears and updates totals
3. Notification Service is "subscribed" - it hears and sends email

**Where It's Used:** Redis pub/sub on "events" channel

---

### Caching (Redis)

**Simple Explanation:**
You're writing an essay and keep looking up the same word's definition. Instead of going to the dictionary every time, you write the definition on a sticky note on your desk. That sticky note is a cache!

**In Our Project:**
Redis stores:
- **Campaign totals** - Instead of counting all pledges every time, store the total
- **Idempotency keys** - Remember which requests we've already processed
- **Session data** - Who's logged in

**Why It's Fast:**
- Redis stores everything in memory (RAM)
- Database stores on disk
- RAM is ~100,000x faster than disk!

**TTL (Time To Live):**
Cache entries expire after a set time. Like sticky notes that auto-delete after 24 hours.

**Where It's Used:** Throughout all services

---

### Connection Pooling

**Simple Explanation:**
Imagine 1000 people need to use 1 phone to make calls. Instead of everyone waiting for one phone, you have 10 phones that people can borrow and return. That's a connection pool!

**The Problem:**
- Creating a database connection takes time (~50ms)
- Creating it for every request is wasteful
- Too many connections can crash the database

**The Solution:**
- Create 10 connections at startup
- Requests "borrow" a connection
- When done, connection goes back to the pool
- Next request reuses it

**Where It's Used:** PostgreSQL connection pool in all services

---

## 4. Observability & Monitoring

### Structured Logging

**Simple Explanation:**
Imagine two ways to leave notes:
1. "Something went wrong at some point" (useless)
2. "Error: Payment failed | User: 123 | Amount: $50 | Time: 2pm | Error: Card declined" (useful!)

**Structured Logging:**
Instead of random text, logs are organized JSON:
```json
{
  "level": "error",
  "service": "payment-service",
  "userId": "123",
  "amount": 50,
  "error": "Card declined",
  "timestamp": "2024-01-15T14:00:00Z"
}
```

**Why It's Better:**
- Can search logs: "Show me all errors for user 123"
- Can analyze: "How many payment failures today?"
- Machines can read and process them

**Where It's Used:** `services/shared/src/logger.ts` (Pino library)

---

### Metrics

**Simple Explanation:**
Like your car's dashboard showing speed, fuel, and engine temperature - metrics are measurements about your application's health.

**Types of Metrics in Our Project:**

**Counter (always goes up):**
- `http_requests_total` - How many requests received
- Like a car's odometer (total miles driven)

**Histogram (distribution of values):**
- `http_request_duration_seconds` - How long requests take
- Like tracking "most trips take 10-20 minutes, some take 30+"

**Where It's Used:** All services expose `/metrics` endpoint, Prometheus collects them

---

### Distributed Tracing

**Simple Explanation:**
Imagine tracking a package from Amazon:
- 9am: Left warehouse
- 11am: Arrived at sorting facility
- 2pm: Out for delivery
- 4pm: Delivered

You can see the ENTIRE journey. Distributed tracing does this for requests across services.

**In Our Project:**
A donation request might go:
```
Gateway → Pledge Service → Payment Service → Notification Service
  50ms       100ms            200ms              50ms
Total: 400ms
```

If it's slow, you can see exactly WHERE it's slow.

**Where It's Used:** Jaeger (configured in `docker-compose.yml`)

---

### Prometheus

**Simple Explanation:**
A diligent assistant who visits every service every 15 seconds asking "How many requests? How fast? Any errors?" and writes everything down in a notebook.

**How It Works:**
1. Each service exposes metrics at `/metrics`
2. Prometheus "scrapes" (visits) each service periodically
3. Stores all metrics in a time-series database
4. You can query: "Show me request rate for last hour"

**Where It's Used:** `observability/prometheus.yml`

---

### Grafana

**Simple Explanation:**
Prometheus collects data but shows ugly numbers. Grafana turns those numbers into beautiful charts and dashboards. Like turning a spreadsheet into a PowerPoint presentation!

**Features:**
- Real-time dashboards
- Alerts when things go wrong
- Historical analysis

**Where It's Used:** `observability/grafana/`

---

## 5. Security Concepts

### JWT (JSON Web Token)

**Simple Explanation:**
Imagine a wristband at a concert. Once you show your ticket at the entrance, you get a wristband. Now you can move around freely - security just checks the wristband, not your ticket every time.

**How It Works:**
1. User logs in with email/password
2. Server verifies and creates a JWT (the wristband)
3. JWT contains: who you are, what you can do, when it expires
4. User sends JWT with every request
5. Server verifies JWT signature (can't be faked)

**JWT Structure:**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.  ← Header (algorithm)
eyJ1c2VySWQiOiIxMjMiLCJyb2xlIjoiRE9OT1IifQ.  ← Payload (data)
SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c  ← Signature (proof it's real)
```

**Where It's Used:** `services/shared/src/jwt.ts`

---

### Authentication vs Authorization

**Simple Explanation:**

**Authentication (AuthN):** "WHO are you?"
- Proving your identity
- Login with email/password
- Getting a JWT

**Authorization (AuthZ):** "WHAT can you do?"
- Checking permissions
- Admin can delete campaigns
- Donor can only view and donate

**In Our Project:**
```typescript
// Authentication - verify who they are
const token = verifyToken(request.headers.authorization);

// Authorization - check what they can do
if (token.role !== 'ADMIN') {
  throw new Error('Only admins can do this');
}
```

---

### Webhook Idempotency

**Simple Explanation:**
Payment providers (like Stripe) send us notifications: "Payment successful!" But sometimes they send the same notification twice (network issues). We use idempotency to process it only once.

**How It Works:**
1. Webhook arrives with ID "webhook_123"
2. Check Redis: "Have we seen webhook_123?"
3. No? Process it and save "webhook_123"
4. Yes? Ignore it (already processed)

**Where It's Used:** `services/payment-service/src/routes.ts`

---

## 6. Database Concepts

### ACID Transactions

**Simple Explanation:**
ACID is a promise that database transactions are reliable. Like a bank transfer - either BOTH accounts update, or NEITHER does.

**A - Atomicity (All or Nothing):**
Transfer $100 from Account A to Account B:
- Deduct from A AND add to B → Success
- If adding to B fails → Undo deduction from A
- Never ends up with money "missing"

**C - Consistency (Rules Always Followed):**
If rule says "balance can't be negative":
- Transaction that would make balance negative → Rejected

**I - Isolation (No Interference):**
Two people buying the last concert ticket simultaneously:
- Only ONE gets it
- They don't interfere with each other

**D - Durability (Permanent):**
Once transaction completes, it's saved forever:
- Even if power goes out 1 second later
- Data is on disk, not just in memory

**Where It's Used:** `services/pledge-service/src/service.ts` (BEGIN...COMMIT pattern)

---

### Database Indexing

**Simple Explanation:**
Imagine a textbook with no index. To find "photosynthesis", you'd read every page. With an index, you look up "photosynthesis → page 47" and go directly there.

**In Our Project:**
```sql
CREATE INDEX idx_users_email ON users(email);
```

Now finding a user by email is instant instead of scanning all users.

**When to Index:**
- Columns you search by frequently (email, user_id)
- Columns in WHERE clauses
- Foreign keys

**Where It's Used:** `init-db.sql`

---

### UUID (Universally Unique Identifier)

**Simple Explanation:**
A super long random ID that's guaranteed to be unique across the entire universe. Like a fingerprint for data.

**Example:**
```
550e8400-e29b-41d4-a716-446655440000
```

**Why Not Use 1, 2, 3?:**
- Sequential IDs reveal information ("user 5" means only 5 users)
- Hard to merge databases (both have "user 1")
- UUIDs can be generated anywhere without coordination

**Where It's Used:** All primary keys (`gen_random_uuid()`)

---

### Optimistic Locking

**Simple Explanation:**
Two people editing the same Google Doc. Instead of locking the document, both edit freely. When saving, if someone else changed it, you get "Document has been modified. Reload?"

**How It Works:**
1. Read record with version number (version: 5)
2. Make changes
3. Save with condition: "UPDATE ... WHERE version = 5"
4. If someone else saved first (version is now 6), your update fails
5. You reload and try again

**Why "Optimistic"?:**
Assumes conflicts are rare. Doesn't lock anything upfront.

**Where It's Used:** Payment state transitions

---

## 7. Asynchronous Processing

### Background Workers

**Simple Explanation:**
Like a dishwasher. You don't stand there washing dishes immediately after each meal. You load the dishwasher (queue work), and it runs later (background processing).

**In Our Project:**
The Outbox Worker:
1. Runs in the background
2. Every 1 second, checks for unsent events
3. Publishes them to Redis
4. Marks them as sent
5. Cleans up old events (every hour)

**Why Background Processing?:**
- User doesn't wait for email to be sent
- Faster response times
- Can retry failed operations

**Where It's Used:** `services/pledge-service/src/outbox-worker.ts`

---

### Event Sourcing (Concept)

**Simple Explanation:**
Instead of just storing "Account balance: $500", store ALL events:
1. Account opened: $0
2. Deposit: +$1000
3. Withdrawal: -$300
4. Purchase: -$200
5. Current balance: $500

You can replay events to understand HOW you got to current state.

**Benefits:**
- Complete audit trail
- Can "time travel" to any point
- Debug by replaying events

---

### WebSocket

**Simple Explanation:**
HTTP is like sending letters - you send one, wait for a response, send another.
WebSocket is like a phone call - once connected, both sides can talk anytime.

**In Our Project:**
Used for real-time notifications:
- User connects once
- Server pushes updates: "Your campaign reached $10,000!"
- No need for user to keep asking "Any updates?"

**Where It's Used:** `services/notification-service/src/websocket.ts`

---

## 8. Error Handling & Resilience

### Graceful Shutdown

**Simple Explanation:**
Imagine a restaurant closing. Bad way: Lock the doors immediately (customers still eating!). Good way: Stop taking new customers, let current ones finish, then close.

**In Our Project:**
When service receives shutdown signal:
1. Stop accepting new requests
2. Finish processing current requests
3. Close database connections properly
4. Close Redis connections
5. Exit cleanly

**Why It Matters:**
- No data corruption
- No lost transactions
- Clean restart

**Where It's Used:** `process.on('SIGTERM', ...)` in all service `index.ts` files

---

### Circuit Breaker Pattern

**Simple Explanation:**
Like an electrical circuit breaker in your house. If there's a problem, it "trips" to prevent damage. After some time, you can try resetting it.

**States:**
```
CLOSED (normal) → Too many failures → OPEN (blocking)
                                          ↓
                                    After timeout
                                          ↓
                                    HALF-OPEN (testing)
                                          ↓
                                    Success? → CLOSED
                                    Failure? → OPEN
```

**Example:**
Payment service calling external payment provider:
- If provider fails 5 times → Circuit opens
- All requests immediately fail (don't even try)
- After 30 seconds → Try one request
- If it works → Circuit closes, normal operation

**Why It's Important:**
- Prevents cascading failures
- Gives failing service time to recover
- Fails fast instead of waiting for timeout

---

### Graceful Degradation

**Simple Explanation:**
When Netflix is overloaded, it might show lower quality video instead of crashing. The experience is worse, but it still works.

**In Our Project:**
If Notification Service is down:
- Donations still work! (core functionality)
- You just don't get the email (nice-to-have)

**Levels of Degradation:**
1. Full functionality - everything works
2. Partial - notifications delayed but delivered later
3. Minimal - donations work, no notifications
4. Emergency - read-only mode

---

### Health Checks

**Simple Explanation:**
Like a doctor checking your pulse. A simple test to see if a service is alive and working.

**In Our Project:**
Every service has `/health` endpoint:
```json
{
  "status": "healthy",
  "service": "pledge-service",
  "version": "1.0.0"
}
```

**Used By:**
- Load balancer: Don't send traffic to unhealthy services
- Kubernetes/Docker: Restart unhealthy containers
- Monitoring: Alert when services are unhealthy

**Where It's Used:** All services have `/health` endpoint

---

### Retry Pattern

**Simple Explanation:**
If at first you don't succeed, try, try again! But be smart about it.

**Types of Retry:**

**Simple Retry:**
Failed? Try again immediately.
Problem: Might overwhelm an already struggling service.

**Exponential Backoff:**
```
Attempt 1: Wait 1 second
Attempt 2: Wait 2 seconds
Attempt 3: Wait 4 seconds
Attempt 4: Wait 8 seconds
```
Gives the failing service breathing room.

**With Jitter (randomness):**
If 1000 requests all retry at exactly 2 seconds, they all hit at once!
Adding randomness spreads the load.

---

## 9. API Concepts

### REST API

**Simple Explanation:**
A standard way for computers to talk to each other over the internet, using web addresses (URLs) and actions (HTTP methods).

**HTTP Methods (CRUD):**
| Method | Action | Example |
|--------|--------|---------|
| POST | Create | Create a new donation |
| GET | Read | Get donation details |
| PUT | Update | Update donation amount |
| DELETE | Delete | Cancel donation |

**RESTful URLs:**
```
GET    /api/v1/pledges        → List all pledges
GET    /api/v1/pledges/123    → Get pledge #123
POST   /api/v1/pledges        → Create new pledge
PUT    /api/v1/pledges/123    → Update pledge #123
DELETE /api/v1/pledges/123    → Delete pledge #123
```

**Where It's Used:** All service routes

---

### API Versioning

**Simple Explanation:**
Like iPhone versions. iPhone 14 users and iPhone 15 users can both use their phones. When we release API "v2", v1 users aren't suddenly broken.

**In Our Project:**
```
/api/v1/pledges  ← Current version
/api/v2/pledges  ← Future version (different features)
```

**Why Version?:**
- Can make breaking changes in new version
- Old apps keep working with old version
- Smooth migration path

---

### HTTP Status Codes

**Simple Explanation:**
Standard "reply codes" that tell you what happened.

**Common Codes:**
| Code | Meaning | Example |
|------|---------|---------|
| 200 | OK | Request successful |
| 201 | Created | New resource created |
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Not logged in |
| 403 | Forbidden | Logged in but not allowed |
| 404 | Not Found | Resource doesn't exist |
| 500 | Server Error | Something broke on our end |
| 503 | Unavailable | Service is down |

---

### Middleware

**Simple Explanation:**
Like airport security checkpoints. Before you board the plane (reach your destination), you go through several checks: ID verification, bag scanning, metal detector.

**In Our Project:**
Every request goes through:
1. **CORS** - Is this website allowed to call us?
2. **Body Parser** - Convert JSON text to usable object
3. **Logger** - Record this request
4. **Metrics** - Count this request
5. **Route Handler** - Actually process the request

**Where It's Used:** `app.use()` calls in each service

---

## 10. DevOps Concepts

### CI/CD (Continuous Integration / Continuous Deployment)

**Simple Explanation:**

**Continuous Integration (CI):**
Every time someone pushes code:
- Automatically run tests
- Automatically build the project
- Check: "Does this code break anything?"

**Continuous Deployment (CD):**
If CI passes:
- Automatically deploy to servers
- No manual steps needed

**In Our Project (GitHub Actions):**
```
Push Code → Run Tests → Build Docker Images → Deploy
```

**Why It's Important:**
- Catch bugs early
- Consistent deployments
- Faster release cycles

**Where It's Used:** `.github/workflows/ci.yml`

---

### Environment Variables

**Simple Explanation:**
Settings that change between environments (development, testing, production) without changing code.

**Examples:**
```bash
# Development
DATABASE_URL=localhost:5432/dev_db
LOG_LEVEL=debug

# Production
DATABASE_URL=prod-server:5432/prod_db
LOG_LEVEL=error
```

**Why Not Hardcode?:**
- Security: Secrets not in code
- Flexibility: Different settings per environment
- 12-Factor App best practice

**Where It's Used:** `docker-compose.yml` environment sections

---

### Infrastructure as Code (IaC)

**Simple Explanation:**
Instead of clicking buttons in AWS console to create servers, you write code that describes your infrastructure. Like a recipe instead of cooking from memory.

**In Our Project:**
`docker-compose.yml` defines our entire infrastructure:
- All services
- Databases
- Networks
- Volumes

**Benefits:**
- Version controlled (can see history)
- Repeatable (same result every time)
- Reviewable (others can check your infrastructure)

---

### Blue-Green Deployment

**Simple Explanation:**
Running two identical production environments:
- **Blue:** Current version (serving users)
- **Green:** New version (being prepared)

Deploy process:
1. Deploy new version to Green
2. Test Green thoroughly
3. Switch traffic from Blue to Green
4. Blue becomes the new staging area

**Benefits:**
- Zero downtime
- Instant rollback (just switch back)
- Test in production-like environment

---

### Horizontal vs Vertical Scaling

**Simple Explanation:**

**Vertical Scaling (Scale Up):**
Make your server bigger. Like upgrading from a sedan to a truck.
- More CPU
- More RAM
- Has limits (can't buy infinite hardware)

**Horizontal Scaling (Scale Out):**
Add more servers. Like getting more cars instead of one big truck.
- Run 10 copies of pledge service
- Distribute load among them
- Nearly unlimited scaling

**In Our Project:**
`docker-compose.yml` uses horizontal scaling:
```yaml
deploy:
  replicas: 3  # Run 3 copies!
```

---

## Summary Table

| Pattern | One-Line Description | Analogy |
|---------|---------------------|---------|
| Microservices | Split app into small, independent services | Restaurant with specialized staff |
| Event-Driven | Services communicate through events | Domino effect |
| CQRS | Separate read and write operations | Different librarians for organizing vs finding |
| Outbox Pattern | Reliable event publishing | Letter outbox tray |
| Idempotency | Same request = same result | Elevator button |
| State Machine | Enforce valid state transitions | Traffic light |
| Circuit Breaker | Stop calling failing services | Electrical breaker |
| Graceful Degradation | Work with reduced functionality | Netflix lowering video quality |
| JWT | Stateless authentication tokens | Concert wristband |
| ACID | Reliable database transactions | Bank transfer guarantee |

---

## Quick Reference: When to Use What

| Problem | Solution |
|---------|----------|
| Need reliable event delivery | Outbox Pattern |
| Prevent duplicate processing | Idempotency Pattern |
| Track valid state changes | State Machine |
| Service keeps failing | Circuit Breaker |
| Need fast reads | CQRS + Caching |
| Debugging request flow | Distributed Tracing |
| Real-time updates | WebSocket |
| Secure user sessions | JWT |
| Scale application | Horizontal Scaling |
| Zero-downtime deployments | Blue-Green Deployment |

---

*Generated for the CareForAll Donation Platform*
