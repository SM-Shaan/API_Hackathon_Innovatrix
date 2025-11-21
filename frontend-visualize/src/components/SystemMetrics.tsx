'use client';

import React from 'react';
import { 
  Activity,
  Clock,
  Users,
  TrendingUp,
  Server,
  AlertCircle,
  CheckCircle,
  Zap
} from 'lucide-react';

interface SystemMetricsProps {
  metrics: {
    totalRequests: number;
    activeConnections: number;
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
    uptime: number;
  };
}

export function SystemMetrics({ metrics }: SystemMetricsProps) {
  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const getHealthStatus = () => {
    if (metrics.errorRate > 10) return { status: 'critical', color: 'red', icon: AlertCircle };
    if (metrics.errorRate > 5) return { status: 'warning', color: 'yellow', icon: AlertCircle };
    return { status: 'healthy', color: 'green', icon: CheckCircle };
  };

  const health = getHealthStatus();
  const HealthIcon = health.icon;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Requests */}
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-600">Total Requests</div>
          <Activity className="w-4 h-4 text-primary-600" />
        </div>
        <div className="text-2xl font-bold text-gray-900">
          {metrics.totalRequests.toLocaleString()}
        </div>
        <div className="text-sm text-gray-500">
          All time
        </div>
      </div>

      {/* Active Connections */}
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-600">Active Users</div>
          <Users className="w-4 h-4 text-success-600" />
        </div>
        <div className="text-2xl font-bold text-gray-900">
          {metrics.activeConnections}
        </div>
        <div className="text-sm text-gray-500">
          Connected now
        </div>
      </div>

      {/* Response Time */}
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-600">Response Time</div>
          <Clock className="w-4 h-4 text-warning-600" />
        </div>
        <div className="text-2xl font-bold text-gray-900">
          {metrics.averageResponseTime}ms
        </div>
        <div className="text-sm text-gray-500">
          Average
        </div>
      </div>

      {/* Throughput */}
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-600">Throughput</div>
          <TrendingUp className="w-4 h-4 text-purple-600" />
        </div>
        <div className="text-2xl font-bold text-gray-900">
          {metrics.throughput}
        </div>
        <div className="text-sm text-gray-500">
          req/sec
        </div>
      </div>

      {/* Error Rate */}
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-600">Error Rate</div>
          <AlertCircle className={`w-4 h-4 text-${health.color}-600`} />
        </div>
        <div className={`text-2xl font-bold text-${health.color}-600`}>
          {metrics.errorRate.toFixed(1)}%
        </div>
        <div className="text-sm text-gray-500">
          Last 5 minutes
        </div>
      </div>

      {/* System Health */}
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-600">System Health</div>
          <HealthIcon className={`w-4 h-4 text-${health.color}-600`} />
        </div>
        <div className={`text-lg font-bold text-${health.color}-600 capitalize`}>
          {health.status}
        </div>
        <div className="text-sm text-gray-500">
          All services
        </div>
      </div>

      {/* Uptime */}
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-600">System Uptime</div>
          <Server className="w-4 h-4 text-primary-600" />
        </div>
        <div className="text-lg font-bold text-gray-900">
          {formatUptime(metrics.uptime)}
        </div>
        <div className="text-sm text-gray-500">
          99.9% availability
        </div>
      </div>

      {/* Performance Score */}
      <div className="bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-gray-600">Performance</div>
          <Zap className="w-4 h-4 text-yellow-600" />
        </div>
        <div className="text-2xl font-bold text-gray-900">
          {Math.round(100 - (metrics.errorRate * 2 + metrics.averageResponseTime / 10))}
        </div>
        <div className="text-sm text-gray-500">
          Score (0-100)
        </div>
      </div>
    </div>
  );
}