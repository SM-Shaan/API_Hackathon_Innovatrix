# CareForAll Frontend - System Architecture Visualization

A Next.js-based real-time visualization dashboard that demonstrates the complete CareForAll donation platform architecture with live workflow simulation.

## Features

### 🎯 Real-Time Architecture Visualization
- **Interactive Service Map**: Visual representation of all microservices
- **Live Flow Tracking**: Watch donation requests flow through the system
- **Service Health Monitoring**: Real-time status indicators for each service
- **Connection Visualization**: See HTTP requests, responses, and events

### 🔄 Donation Flow Simulation
- **Manual Testing**: Submit test donations to see the system in action
- **Auto Demo Mode**: Continuous simulation with random donations
- **Step-by-Step Tracking**: Monitor each phase of the donation process
- **Failure Simulation**: Observe how the system handles errors gracefully

### 📊 System Monitoring
- **Live Metrics**: Request counts, response times, error rates
- **Event Logging**: Real-time system events with detailed metadata
- **Performance Dashboards**: System health and performance indicators
- **Circuit Breaker Status**: Monitor service protection mechanisms

### 🏗️ Architecture Patterns Demonstrated

#### ✅ Idempotency Protection
- Visual indicators show duplicate request handling
- Redis-based idempotency key checking
- Prevents double-charging scenarios

#### ✅ Transactional Outbox Pattern
- Watch events being reliably published
- Database transaction + outbox table writes
- Guaranteed event delivery to message queues

#### ✅ Payment State Machine
- Visual state transitions: PENDING → AUTHORIZED → CAPTURED → COMPLETED
- Invalid transition prevention
- Audit trail of all state changes

#### ✅ CQRS (Command Query Responsibility Segregation)
- Separate read/write models for optimal performance
- Real-time totals updates via materialized views
- Sub-millisecond read responses

#### ✅ Event-Driven Architecture
- Kafka message flow visualization
- Asynchronous service communication
- Loose coupling between services

#### ✅ Circuit Breaker Pattern
- Service failure simulation and recovery
- Cascading failure prevention
- Health-based traffic routing

## Technology Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Animations**: Framer Motion
- **Real-time**: WebSocket simulation

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Navigate to frontend directory**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   ```
   http://localhost:3000
   ```

### Building for Production

```bash
npm run build
npm start
```

## Usage Guide

### 1. **System Overview**
- The main dashboard shows the complete microservices architecture
- Each service displays real-time metrics and health status
- Connections between services show the flow of requests and events

### 2. **Testing Donations**
- Use the donation form on the right sidebar
- Fill in amount, email, and payment details (all simulated)
- Click "Donate" to start a new flow
- Watch the real-time visualization as your donation moves through the system

### 3. **Auto Demo Mode**
- Click "Start Auto Demo" to run continuous simulations
- Random donations will be processed every 8 seconds
- Observe different scenarios including occasional failures
- Stop anytime by clicking "Stop Auto Demo"

### 4. **Event Monitoring**
- The Event Log shows all system activities in real-time
- Events are color-coded: Info (blue), Success (green), Warning (yellow), Error (red)
- Click on events to see detailed metadata

### 5. **Service Details**
- Click on any service node to see detailed information
- View metrics like request counts, response times, and error rates
- Monitor health status and recent activity

## Architecture Components

### Services Visualized

1. **API Gateway** - Request routing, rate limiting, authentication
2. **User Service** - User management and authentication
3. **Campaign Service** - Fundraising campaign management
4. **Pledge Service** - Donation processing with idempotency
5. **Payment Service** - Payment processing with state machine
6. **Totals Service** - Real-time campaign totals (CQRS read model)
7. **Notification Service** - Email and SMS notifications

### Infrastructure Components

1. **Database (PostgreSQL)** - Persistent data storage
2. **Redis** - Caching and session management  
3. **Kafka** - Event streaming and message queues

## Flow Demonstrations

### Complete Donation Flow
1. **Request Validation** - API Gateway validates and routes request
2. **Idempotency Check** - Pledge Service checks for duplicate requests
3. **Pledge Creation** - Transactional outbox pattern ensures data consistency
4. **Payment Processing** - State machine manages payment lifecycle
5. **Event Publishing** - Kafka distributes events to interested services
6. **Totals Update** - CQRS pattern updates materialized views
7. **Notifications** - Confirmation emails sent to donors

### Failure Scenarios
- **Service Timeouts** - Circuit breakers prevent cascading failures
- **Duplicate Requests** - Idempotency protection handles retries
- **Payment Failures** - State machine manages failed transactions
- **Database Issues** - Graceful degradation with cached data

## Configuration

### Environment Variables
```env
API_BASE_URL=http://localhost:8080    # Backend API URL
WS_URL=ws://localhost:8080            # WebSocket URL for real-time updates
```

### Customization
- Modify service positions in `ArchitectureVisualization.tsx`
- Adjust simulation timing in `mockData.ts`
- Customize colors and styling in `tailwind.config.js`

## Educational Value

This frontend serves as a **live documentation** of the system architecture:

- **Visual Learning**: See abstract concepts like "idempotency" in action
- **Failure Understanding**: Watch how resilience patterns work
- **Performance Impact**: Observe the difference CQRS makes to read performance  
- **Event-Driven Benefits**: See loose coupling in practice
- **Scalability Patterns**: Understand how microservices scale independently

## Perfect for Demonstrations

- **Hackathon Presentations**: Show judges a working system
- **Technical Interviews**: Demonstrate architecture knowledge
- **Team Training**: Teach distributed systems concepts
- **Client Demos**: Visualize complex backend systems
- **Educational Content**: Create engaging architecture tutorials

This visualization transforms abstract distributed systems concepts into concrete, observable behaviors that anyone can understand and appreciate.