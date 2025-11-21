export interface ServiceStatus {
  name: string;
  status: 'idle' | 'active' | 'processing' | 'success' | 'error';
  health: 'healthy' | 'degraded' | 'unhealthy';
  lastActivity: Date;
  metrics: {
    requestCount: number;
    responseTime: number;
    errorRate: number;
  };
}

export interface FlowStep {
  id: string;
  service: string;
  action: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  timestamp: Date;
  data?: any;
  duration?: number;
}

export interface DonationFlow {
  id: string;
  donorEmail: string;
  campaignId: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  steps: FlowStep[];
  createdAt: Date;
  completedAt?: Date;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  targetAmount: number;
  currentAmount: number;
  pledgeCount: number;
  status: 'active' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: Date;
}

export interface EventLog {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  service: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SystemMetrics {
  totalRequests: number;
  activeConnections: number;
  averageResponseTime: number;
  errorRate: number;
  throughput: number;
  uptime: number;
}

export interface PaymentState {
  pledgeId: string;
  currentState: 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  transitions: Array<{
    from: string;
    to: string;
    timestamp: Date;
    metadata?: any;
  }>;
}

export interface CircuitBreakerState {
  service: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime?: Date;
  successCount: number;
}