import { ServiceStatus, DonationFlow, FlowStep, EventLog, SystemMetrics } from '@/types';

// Mock service status data
export const initialServices: Record<string, ServiceStatus> = {
  'API Gateway': {
    name: 'API Gateway',
    status: 'idle',
    health: 'healthy',
    lastActivity: new Date(),
    metrics: {
      requestCount: 1247,
      responseTime: 45,
      errorRate: 0.2,
    },
  },
  'User Service': {
    name: 'User Service',
    status: 'idle',
    health: 'healthy',
    lastActivity: new Date(),
    metrics: {
      requestCount: 892,
      responseTime: 78,
      errorRate: 0.1,
    },
  },
  'Campaign Service': {
    name: 'Campaign Service',
    status: 'idle',
    health: 'healthy',
    lastActivity: new Date(),
    metrics: {
      requestCount: 445,
      responseTime: 65,
      errorRate: 0.3,
    },
  },
  'Pledge Service': {
    name: 'Pledge Service',
    status: 'idle',
    health: 'healthy',
    lastActivity: new Date(),
    metrics: {
      requestCount: 2108,
      responseTime: 120,
      errorRate: 0.5,
    },
  },
  'Payment Service': {
    name: 'Payment Service',
    status: 'idle',
    health: 'healthy',
    lastActivity: new Date(),
    metrics: {
      requestCount: 1876,
      responseTime: 340,
      errorRate: 1.2,
    },
  },
  'Totals Service': {
    name: 'Totals Service',
    status: 'idle',
    health: 'healthy',
    lastActivity: new Date(),
    metrics: {
      requestCount: 5432,
      responseTime: 23,
      errorRate: 0.1,
    },
  },
  'Notification Service': {
    name: 'Notification Service',
    status: 'idle',
    health: 'healthy',
    lastActivity: new Date(),
    metrics: {
      requestCount: 1654,
      responseTime: 156,
      errorRate: 2.1,
    },
  },
  'Database': {
    name: 'Database',
    status: 'idle',
    health: 'healthy',
    lastActivity: new Date(),
    metrics: {
      requestCount: 8765,
      responseTime: 89,
      errorRate: 0.05,
    },
  },
  'Redis': {
    name: 'Redis',
    status: 'idle',
    health: 'healthy',
    lastActivity: new Date(),
    metrics: {
      requestCount: 12340,
      responseTime: 12,
      errorRate: 0.01,
    },
  },
  'Kafka': {
    name: 'Kafka',
    status: 'idle',
    health: 'healthy',
    lastActivity: new Date(),
    metrics: {
      requestCount: 4567,
      responseTime: 34,
      errorRate: 0.1,
    },
  },
};

export const initialMetrics: SystemMetrics = {
  totalRequests: 38526,
  activeConnections: 47,
  averageResponseTime: 89,
  errorRate: 0.4,
  throughput: 156,
  uptime: 345678,
};

// Function to create a donation flow simulation
export function createDonationFlow(data: {
  amount: number;
  email: string;
  campaignId: string;
  cardToken: string;
}): DonationFlow {
  const flowId = `flow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const steps: FlowStep[] = [
    {
      id: `step_${Date.now()}_1`,
      service: 'API Gateway',
      action: 'Validate request and route to Pledge Service',
      status: 'pending',
      timestamp: new Date(),
    },
    {
      id: `step_${Date.now()}_2`,
      service: 'Pledge Service',
      action: 'Check idempotency key',
      status: 'pending',
      timestamp: new Date(),
    },
    {
      id: `step_${Date.now()}_3`,
      service: 'Pledge Service',
      action: 'Create pledge record with outbox event',
      status: 'pending',
      timestamp: new Date(),
    },
    {
      id: `step_${Date.now()}_4`,
      service: 'Payment Service',
      action: 'Process payment with state machine',
      status: 'pending',
      timestamp: new Date(),
    },
    {
      id: `step_${Date.now()}_5`,
      service: 'Payment Service',
      action: 'Call external payment provider',
      status: 'pending',
      timestamp: new Date(),
    },
    {
      id: `step_${Date.now()}_6`,
      service: 'Kafka',
      action: 'Publish payment events',
      status: 'pending',
      timestamp: new Date(),
    },
    {
      id: `step_${Date.now()}_7`,
      service: 'Totals Service',
      action: 'Update campaign totals (CQRS)',
      status: 'pending',
      timestamp: new Date(),
    },
    {
      id: `step_${Date.now()}_8`,
      service: 'Notification Service',
      action: 'Send confirmation email',
      status: 'pending',
      timestamp: new Date(),
    },
  ];

  return {
    id: flowId,
    donorEmail: data.email,
    campaignId: data.campaignId,
    amount: data.amount,
    status: 'pending',
    steps,
    createdAt: new Date(),
  };
}

// Function to generate event logs
export function generateEventLog(
  type: 'info' | 'success' | 'warning' | 'error',
  service: string,
  message: string,
  metadata?: Record<string, any>
): EventLog {
  return {
    id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    service,
    message,
    timestamp: new Date(),
    metadata,
  };
}

// Simulate donation flow progression
export async function simulateDonationFlow(
  flow: DonationFlow,
  onStepUpdate: (flow: DonationFlow) => void,
  onEventLog: (log: EventLog) => void,
  onServiceUpdate: (serviceName: string, status: ServiceStatus['status']) => void
): Promise<DonationFlow> {
  const updatedFlow = { ...flow };
  
  for (let i = 0; i < flow.steps.length; i++) {
    const step = flow.steps[i];
    const startTime = Date.now();
    
    // Update step to running
    updatedFlow.steps[i] = { ...step, status: 'running', timestamp: new Date() };
    updatedFlow.status = 'processing';
    onStepUpdate(updatedFlow);
    
    // Update service status
    onServiceUpdate(step.service, 'processing');
    
    // Generate event log
    onEventLog(generateEventLog('info', step.service, `Starting: ${step.action}`, {
      stepId: step.id,
      flowId: flow.id,
    }));
    
    // Simulate processing time
    const processingTime = Math.random() * 2000 + 500; // 0.5-2.5 seconds
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Simulate potential failures (5% chance)
    const shouldFail = Math.random() < 0.05;
    
    if (shouldFail && i > 2) { // Don't fail on early steps for demo purposes
      updatedFlow.steps[i] = { 
        ...step, 
        status: 'failed', 
        timestamp: new Date(),
        duration: Date.now() - startTime
      };
      updatedFlow.status = 'failed';
      
      onServiceUpdate(step.service, 'error');
      onEventLog(generateEventLog('error', step.service, `Failed: ${step.action}`, {
        stepId: step.id,
        flowId: flow.id,
        error: 'Simulated failure for demonstration',
      }));
      
      onStepUpdate(updatedFlow);
      return updatedFlow;
    }
    
    // Complete step successfully
    updatedFlow.steps[i] = { 
      ...step, 
      status: 'completed', 
      timestamp: new Date(),
      duration: Date.now() - startTime
    };
    
    onServiceUpdate(step.service, 'success');
    onEventLog(generateEventLog('success', step.service, `Completed: ${step.action}`, {
      stepId: step.id,
      flowId: flow.id,
      duration: Date.now() - startTime,
    }));
    
    onStepUpdate(updatedFlow);
    
    // Reset service status after a short delay
    setTimeout(() => {
      onServiceUpdate(step.service, 'idle');
    }, 1000);
  }
  
  // Mark flow as completed
  updatedFlow.status = 'completed';
  updatedFlow.completedAt = new Date();
  onStepUpdate(updatedFlow);
  
  onEventLog(generateEventLog('success', 'System', `Donation flow completed successfully`, {
    flowId: flow.id,
    amount: flow.amount,
    campaignId: flow.campaignId,
    totalDuration: Date.now() - flow.createdAt.getTime(),
  }));
  
  return updatedFlow;
}