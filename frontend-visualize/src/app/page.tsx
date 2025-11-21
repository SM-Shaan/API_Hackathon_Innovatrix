'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArchitectureVisualization } from '@/components/ArchitectureVisualization';
import { DonationForm } from '@/components/DonationForm';
import { EventLog } from '@/components/EventLog';
import { SystemMetrics } from '@/components/SystemMetrics';
import { ServiceStatus, DonationFlow, EventLog as EventLogType } from '@/types';
import {
  initialServices,
  initialMetrics,
  createDonationFlow,
  simulateDonationFlow,
} from '@/utils/mockData';
import { 
  Activity, 
  Play, 
  Square, 
  RefreshCw, 
  Monitor,
  Settings,
  Database,
  Zap
} from 'lucide-react';

export default function Home() {
  const [services, setServices] = useState<Record<string, ServiceStatus>>(initialServices);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [events, setEvents] = useState<EventLogType[]>([]);
  const [activeFlow, setActiveFlow] = useState<DonationFlow | null>(null);
  const [isProcessingDonation, setIsProcessingDonation] = useState(false);
  const [simulationMode, setSimulationMode] = useState<'manual' | 'auto'>('manual');
  const [autoSimulationActive, setAutoSimulationActive] = useState(false);

  // Add new event to the log
  const addEvent = useCallback((event: EventLogType) => {
    setEvents(prev => [event, ...prev].slice(0, 100)); // Keep last 100 events
  }, []);

  // Update service status
  const updateServiceStatus = useCallback((serviceName: string, status: ServiceStatus['status']) => {
    setServices(prev => ({
      ...prev,
      [serviceName]: {
        ...prev[serviceName],
        status,
        lastActivity: new Date(),
        metrics: {
          ...prev[serviceName].metrics,
          requestCount: prev[serviceName].metrics.requestCount + 1,
        },
      },
    }));
  }, []);

  // Handle donation submission
  const handleDonationSubmit = async (donationData: {
    amount: number;
    email: string;
    campaignId: string;
    cardToken: string;
  }) => {
    if (isProcessingDonation) return;

    setIsProcessingDonation(true);
    
    // Create new donation flow
    const flow = createDonationFlow(donationData);
    setActiveFlow(flow);

    addEvent({
      id: `event_${Date.now()}`,
      type: 'info',
      service: 'System',
      message: `New donation flow started: $${donationData.amount} to ${donationData.campaignId}`,
      timestamp: new Date(),
      metadata: {
        flowId: flow.id,
        amount: donationData.amount,
        email: donationData.email,
      },
    });

    try {
      // Simulate the donation flow
      const completedFlow = await simulateDonationFlow(
        flow,
        (updatedFlow) => setActiveFlow(updatedFlow),
        addEvent,
        updateServiceStatus
      );

      // Update metrics after successful donation
      setMetrics(prev => ({
        ...prev,
        totalRequests: prev.totalRequests + 8, // Approximate requests per donation
        throughput: prev.throughput + Math.random() * 10,
      }));

    } catch (error) {
      addEvent({
        id: `event_${Date.now()}`,
        type: 'error',
        service: 'System',
        message: `Donation flow failed: ${error}`,
        timestamp: new Date(),
        metadata: { flowId: flow.id },
      });
    } finally {
      setIsProcessingDonation(false);
      
      // Clear active flow after 5 seconds
      setTimeout(() => {
        setActiveFlow(null);
      }, 5000);
    }
  };

  // Auto simulation effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoSimulationActive) {
      interval = setInterval(() => {
        if (!isProcessingDonation) {
          // Generate random donation
          const amounts = [25, 50, 100, 250, 500];
          const emails = [
            'donor1@example.com',
            'donor2@example.com', 
            'donor3@example.com',
            'generous@donor.com',
            'helper@example.com'
          ];
          const campaigns = ['campaign-1', 'campaign-2', 'campaign-3'];

          handleDonationSubmit({
            amount: amounts[Math.floor(Math.random() * amounts.length)],
            email: emails[Math.floor(Math.random() * emails.length)],
            campaignId: campaigns[Math.floor(Math.random() * campaigns.length)],
            cardToken: `tok_${Math.random().toString(36).substr(2, 9)}`,
          });
        }
      }, 8000); // Every 8 seconds
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoSimulationActive, isProcessingDonation, handleDonationSubmit]);

  // Metrics update effect
  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        ...prev,
        activeConnections: Math.max(1, prev.activeConnections + Math.floor(Math.random() * 6 - 3)),
        averageResponseTime: Math.max(20, prev.averageResponseTime + Math.floor(Math.random() * 20 - 10)),
        throughput: Math.max(50, prev.throughput + Math.floor(Math.random() * 20 - 10)),
        uptime: prev.uptime + 5,
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Activity className="w-8 h-8 text-primary-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">CareForAll Architecture</h1>
                  <p className="text-sm text-gray-600">Real-time Microservices Visualization</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Simulation Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setAutoSimulationActive(!autoSimulationActive);
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    autoSimulationActive
                      ? 'bg-error-100 text-error-700 hover:bg-error-200'
                      : 'bg-success-100 text-success-700 hover:bg-success-200'
                  }`}
                >
                  {autoSimulationActive ? (
                    <>
                      <Square className="w-4 h-4" />
                      Stop Auto Demo
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Start Auto Demo
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    setEvents([]);
                    setServices(initialServices);
                    setActiveFlow(null);
                  }}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg text-sm font-medium transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reset
                </button>
              </div>

              {/* Status Indicators */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    activeFlow ? 'bg-warning-500 animate-pulse' : 'bg-success-500'
                  }`}></div>
                  <span className="text-gray-600">
                    {activeFlow ? 'Processing' : 'Ready'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-success-600" />
                  <span className="text-gray-600">All Services Online</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* System Metrics */}
        <div className="mb-6">
          <SystemMetrics metrics={metrics} />
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Architecture Visualization */}
          <div className="xl:col-span-2">
            <div className="bg-white rounded-lg border shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Monitor className="w-5 h-5 text-primary-600" />
                  <h2 className="text-lg font-semibold text-gray-900">System Architecture</h2>
                </div>
                
                {activeFlow && (
                  <div className="flex items-center gap-2 text-sm">
                    <Zap className="w-4 h-4 text-warning-500 animate-pulse" />
                    <span className="text-warning-700 font-medium">Flow Active</span>
                  </div>
                )}
              </div>
              
              <div className="h-[600px]">
                <ArchitectureVisualization
                  services={services}
                  activeFlow={activeFlow || undefined}
                />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Donation Form */}
            <DonationForm
              onSubmit={handleDonationSubmit}
              loading={isProcessingDonation}
            />

            {/* Event Log */}
            <EventLog
              events={events}
              maxHeight="400px"
            />
          </div>
        </div>

        {/* Info Panel */}
        <div className="mt-8 bg-gradient-to-r from-primary-50 to-primary-100 border border-primary-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <Settings className="w-6 h-6 text-primary-600 mt-1 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-primary-900 mb-2">
                Architecture Patterns Demonstrated
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-primary-800">
                <div>
                  <strong>✅ Idempotency:</strong> Prevents duplicate charges with unique keys
                </div>
                <div>
                  <strong>✅ Outbox Pattern:</strong> Guarantees event delivery with transactional outbox
                </div>
                <div>
                  <strong>✅ State Machine:</strong> Enforces valid payment state transitions only
                </div>
                <div>
                  <strong>✅ CQRS:</strong> Separate read/write models for optimal performance
                </div>
                <div>
                  <strong>✅ Circuit Breakers:</strong> Prevents cascading failures
                </div>
                <div>
                  <strong>✅ Event-Driven:</strong> Async communication via message queues
                </div>
                <div>
                  <strong>✅ Observability:</strong> Full tracing, logging, and monitoring
                </div>
                <div>
                  <strong>✅ Scalability:</strong> Horizontal scaling with load balancing
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}