'use client';

import React, { useState, useEffect } from 'react';
import { ServiceNode } from './ServiceNode';
import { FlowArrow } from './FlowArrow';
import { ServiceStatus, DonationFlow } from '@/types';

interface ArchitectureVisualizationProps {
  services: Record<string, ServiceStatus>;
  activeFlow?: DonationFlow;
}

// Define service positions in the architecture diagram
const servicePositions = {
  'API Gateway': { x: 400, y: 50 },
  'User Service': { x: 100, y: 200 },
  'Campaign Service': { x: 300, y: 200 },
  'Pledge Service': { x: 500, y: 200 },
  'Payment Service': { x: 700, y: 200 },
  'Totals Service': { x: 400, y: 350 },
  'Notification Service': { x: 600, y: 350 },
  'Database': { x: 150, y: 500 },
  'Redis': { x: 350, y: 500 },
  'Kafka': { x: 550, y: 500 },
};

// Define service connections
const serviceConnections = [
  // Gateway connections
  { from: 'API Gateway', to: 'User Service', type: 'request' },
  { from: 'API Gateway', to: 'Campaign Service', type: 'request' },
  { from: 'API Gateway', to: 'Pledge Service', type: 'request' },
  { from: 'API Gateway', to: 'Totals Service', type: 'request' },
  
  // Service to service
  { from: 'Pledge Service', to: 'Payment Service', type: 'request' },
  { from: 'Payment Service', to: 'Kafka', type: 'event' },
  { from: 'Pledge Service', to: 'Kafka', type: 'event' },
  { from: 'Kafka', to: 'Totals Service', type: 'event' },
  { from: 'Kafka', to: 'Notification Service', type: 'event' },
  
  // Database connections
  { from: 'User Service', to: 'Database', type: 'request' },
  { from: 'Campaign Service', to: 'Database', type: 'request' },
  { from: 'Pledge Service', to: 'Database', type: 'request' },
  { from: 'Payment Service', to: 'Database', type: 'request' },
  { from: 'Totals Service', to: 'Redis', type: 'request' },
];

export function ArchitectureVisualization({ services, activeFlow }: ArchitectureVisualizationProps) {
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [activeConnections, setActiveConnections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeFlow) {
      // Simulate flow progression through services
      const flowSteps = activeFlow.steps.filter(step => step.status === 'running');
      const activeServices = new Set(flowSteps.map(step => step.service));
      
      // Create active connections based on flow
      const connections = new Set<string>();
      flowSteps.forEach((step, index) => {
        if (index > 0) {
          const prevStep = flowSteps[index - 1];
          connections.add(`${prevStep.service}-${step.service}`);
        }
      });
      
      setActiveConnections(connections);
    } else {
      setActiveConnections(new Set());
    }
  }, [activeFlow]);

  const isConnectionActive = (from: string, to: string) => {
    return activeConnections.has(`${from}-${to}`) || activeConnections.has(`${to}-${from}`);
  };

  return (
    <div className="relative bg-gray-50 rounded-lg border p-8 overflow-hidden">
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      {/* Architecture Title */}
      <div className="absolute top-4 left-4 z-10">
        <h2 className="text-xl font-bold text-gray-900">CareForAll Architecture</h2>
        <p className="text-sm text-gray-600">Real-time system visualization</p>
      </div>

      {/* Layer Labels */}
      <div className="absolute left-4 space-y-4 text-sm font-medium text-gray-600 z-10">
        <div style={{ top: 60 }}>Gateway Layer</div>
        <div style={{ top: 210 }}>Service Layer</div>
        <div style={{ top: 360 }}>Processing Layer</div>
        <div style={{ top: 510 }}>Data Layer</div>
      </div>

      {/* Flow Arrows */}
      {serviceConnections.map((connection, index) => {
        const fromPos = servicePositions[connection.from as keyof typeof servicePositions];
        const toPos = servicePositions[connection.to as keyof typeof servicePositions];
        
        if (!fromPos || !toPos) return null;

        return (
          <FlowArrow
            key={`${connection.from}-${connection.to}-${index}`}
            from={{ x: fromPos.x + 100, y: fromPos.y + 60 }}
            to={{ x: toPos.x + 100, y: toPos.y + 60 }}
            active={isConnectionActive(connection.from, connection.to)}
            type={connection.type as 'request' | 'response' | 'event'}
          />
        );
      })}

      {/* Service Nodes */}
      {Object.entries(servicePositions).map(([serviceName, position]) => {
        const service = services[serviceName] || {
          name: serviceName,
          status: 'idle' as const,
          health: 'healthy' as const,
          lastActivity: new Date(),
          metrics: {
            requestCount: 0,
            responseTime: 0,
            errorRate: 0,
          },
        };

        return (
          <ServiceNode
            key={serviceName}
            service={service}
            position={position}
            onClick={() => setSelectedService(serviceName === selectedService ? null : serviceName)}
          />
        );
      })}

      {/* Active Flow Indicator */}
      {activeFlow && (
        <div className="absolute top-4 right-4 bg-white p-4 rounded-lg border shadow-lg z-20 min-w-64">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 bg-primary-500 rounded-full animate-pulse"></div>
            <h3 className="font-semibold text-gray-900">Active Flow</h3>
          </div>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Flow ID:</span>
              <span className="font-mono text-gray-900">{activeFlow.id.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Amount:</span>
              <span className="font-semibold text-gray-900">${activeFlow.amount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                activeFlow.status === 'completed' ? 'bg-success-100 text-success-700' :
                activeFlow.status === 'failed' ? 'bg-error-100 text-error-700' :
                'bg-warning-100 text-warning-700'
              }`}>
                {activeFlow.status}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-200">
            <h4 className="text-xs font-medium text-gray-700 mb-2">Current Steps:</h4>
            <div className="space-y-1">
              {activeFlow.steps.slice(-3).map((step, index) => (
                <div key={step.id} className="flex items-center gap-2 text-xs">
                  <div className={`w-2 h-2 rounded-full ${
                    step.status === 'completed' ? 'bg-success-500' :
                    step.status === 'running' ? 'bg-warning-500 animate-pulse' :
                    step.status === 'failed' ? 'bg-error-500' :
                    'bg-gray-300'
                  }`}></div>
                  <span className="text-gray-700">{step.action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Service Details Panel */}
      {selectedService && services[selectedService] && (
        <div className="absolute bottom-4 left-4 bg-white p-4 rounded-lg border shadow-lg z-20 max-w-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">{selectedService}</h3>
            <button
              onClick={() => setSelectedService(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Health:</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                services[selectedService].health === 'healthy' ? 'bg-success-100 text-success-700' :
                services[selectedService].health === 'degraded' ? 'bg-warning-100 text-warning-700' :
                'bg-error-100 text-error-700'
              }`}>
                {services[selectedService].health}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Requests:</span>
              <span className="font-mono text-gray-900">
                {services[selectedService].metrics.requestCount}
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Response Time:</span>
              <span className="font-mono text-gray-900">
                {services[selectedService].metrics.responseTime}ms
              </span>
            </div>
            
            <div className="flex justify-between">
              <span className="text-gray-600">Error Rate:</span>
              <span className="font-mono text-gray-900">
                {services[selectedService].metrics.errorRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white p-3 rounded-lg border shadow-sm z-10">
        <h4 className="text-xs font-semibold text-gray-700 mb-2">Legend</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-primary-500 rounded"></div>
            <span>HTTP Request</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-success-500 rounded"></div>
            <span>HTTP Response</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-purple-500 rounded"></div>
            <span>Event Message</span>
          </div>
        </div>
      </div>
    </div>
  );
}