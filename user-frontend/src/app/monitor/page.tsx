'use client';

import React, { useEffect } from 'react';
import { Activity, ExternalLink, Monitor } from 'lucide-react';
import Link from 'next/link';

export default function MonitorPage() {
  useEffect(() => {
    // Redirect to the architecture visualization frontend
    const timeout = setTimeout(() => {
      window.open('http://localhost:3000', '_blank');
    }, 1000);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-2xl mx-auto text-center p-8">
        <div className="mb-8">
          <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Monitor className="w-12 h-12 text-primary-600" />
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            System Architecture Monitor
          </h1>
          
          <p className="text-lg text-gray-600 mb-8">
            Redirecting to the real-time architecture visualization dashboard...
          </p>
          
          <div className="flex items-center justify-center space-x-2 text-primary-600 mb-8">
            <Activity className="w-5 h-5 animate-pulse" />
            <span className="font-medium">Loading visualization...</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="font-semibold text-gray-900 mb-2">Real-Time Monitoring</h3>
            <p className="text-sm text-gray-600">
              Watch live donation flows through our microservices architecture
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg border">
            <h3 className="font-semibold text-gray-900 mb-2">Interactive Demo</h3>
            <p className="text-sm text-gray-600">
              Submit test donations and see the system patterns in action
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary inline-flex items-center space-x-2"
          >
            <ExternalLink className="w-5 h-5" />
            <span>Open Architecture Monitor</span>
          </a>
          
          <div>
            <Link href="/" className="btn-secondary">
              Back to Home
            </Link>
          </div>
        </div>

        <div className="mt-12 p-6 bg-primary-50 rounded-lg border border-primary-200">
          <h4 className="font-semibold text-primary-900 mb-2">What You'll See:</h4>
          <ul className="text-sm text-primary-800 space-y-1">
            <li>• Real-time service interactions and data flow</li>
            <li>• Idempotency protection and duplicate prevention</li>
            <li>• Transactional outbox pattern ensuring reliability</li>
            <li>• Payment state machine preventing corruption</li>
            <li>• CQRS read models for instant performance</li>
            <li>• Complete system observability and monitoring</li>
          </ul>
        </div>
      </div>
    </div>
  );
}