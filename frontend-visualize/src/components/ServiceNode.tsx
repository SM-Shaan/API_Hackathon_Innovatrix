'use client';

import React from 'react';
import { ServiceStatus } from '@/types';
import { 
  Server, 
  Database, 
  Shield, 
  Users, 
  CreditCard, 
  BarChart3,
  Bell,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock
} from 'lucide-react';

interface ServiceNodeProps {
  service: ServiceStatus;
  position: { x: number; y: number };
  onClick?: () => void;
}

const serviceIcons = {
  'API Gateway': Shield,
  'User Service': Users,
  'Pledge Service': Database,
  'Payment Service': CreditCard,
  'Campaign Service': BarChart3,
  'Totals Service': Activity,
  'Notification Service': Bell,
  'Database': Database,
  'Redis': Database,
  'Kafka': Server,
};

const statusColors = {
  idle: 'border-gray-300 bg-gray-50',
  active: 'border-primary-500 bg-primary-50',
  processing: 'border-warning-500 bg-warning-50 animate-pulse-slow',
  success: 'border-success-500 bg-success-50',
  error: 'border-error-500 bg-error-50',
};

const healthColors = {
  healthy: 'text-success-600',
  degraded: 'text-warning-600',
  unhealthy: 'text-error-600',
};

export function ServiceNode({ service, position, onClick }: ServiceNodeProps) {
  const Icon = serviceIcons[service.name as keyof typeof serviceIcons] || Server;
  const statusColor = statusColors[service.status];
  const healthColor = healthColors[service.health];

  return (
    <div
      className={`absolute service-node cursor-pointer ${statusColor}`}
      style={{ 
        left: position.x, 
        top: position.y,
        width: '200px',
        minHeight: '120px'
      }}
      onClick={onClick}
    >
      {/* Service Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary-600" />
          <h3 className="font-semibold text-sm">{service.name}</h3>
        </div>
        <div className="flex items-center gap-1">
          {service.health === 'healthy' && <CheckCircle className={`w-4 h-4 ${healthColor}`} />}
          {service.health === 'degraded' && <AlertTriangle className={`w-4 h-4 ${healthColor}`} />}
          {service.health === 'unhealthy' && <XCircle className={`w-4 h-4 ${healthColor}`} />}
        </div>
      </div>

      {/* Status Indicator */}
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-1">
          {service.status === 'processing' && <Clock className="w-3 h-3 animate-spin" />}
          <span className="text-xs font-medium capitalize">{service.status}</span>
        </div>
        <div className="text-xs text-gray-500">
          Last activity: {service.lastActivity.toLocaleTimeString()}
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span>Requests:</span>
          <span className="font-mono">{service.metrics.requestCount}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span>Response:</span>
          <span className="font-mono">{service.metrics.responseTime}ms</span>
        </div>
        <div className="flex justify-between text-xs">
          <span>Error Rate:</span>
          <span className={`font-mono ${service.metrics.errorRate > 5 ? 'text-error-600' : 'text-success-600'}`}>
            {service.metrics.errorRate.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Activity Indicator */}
      {service.status === 'active' && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-primary-500 rounded-full animate-ping"></div>
      )}
      
      {service.status === 'processing' && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-warning-500 rounded-full animate-bounce"></div>
      )}
    </div>
  );
}