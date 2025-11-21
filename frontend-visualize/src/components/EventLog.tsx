'use client';

import React, { useEffect, useRef } from 'react';
import { EventLog as EventLogType } from '@/types';
import { 
  Info, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Clock
} from 'lucide-react';

interface EventLogProps {
  events: EventLogType[];
  maxHeight?: string;
}

const typeIcons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
};

const typeColors = {
  info: 'text-primary-500 bg-primary-50 border-primary-200',
  success: 'text-success-500 bg-success-50 border-success-200',
  warning: 'text-warning-500 bg-warning-50 border-warning-200',
  error: 'text-error-500 bg-error-50 border-error-200',
};

export function EventLog({ events, maxHeight = '400px' }: EventLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to bottom when new events arrive
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  return (
    <div className="bg-white rounded-lg border shadow-sm">
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">System Event Log</h3>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            <span>Live Updates</span>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
      
      <div
        ref={scrollRef}
        className="overflow-y-auto p-4 space-y-3"
        style={{ maxHeight }}
      >
        {events.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <Info className="w-8 h-8 mx-auto mb-2 text-gray-400" />
            <p>No events yet. Start a donation flow to see real-time logs.</p>
          </div>
        ) : (
          events.map((event) => {
            const Icon = typeIcons[event.type];
            const colorClass = typeColors[event.type];
            
            return (
              <div
                key={event.id}
                className={`p-3 rounded-lg border-l-4 ${colorClass} transition-all duration-300 hover:shadow-sm`}
              >
                <div className="flex items-start gap-3">
                  <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">
                        {event.service}
                      </span>
                      <span className="text-xs text-gray-500">
                        {event.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-700 break-words">
                      {event.message}
                    </p>
                    
                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                          View metadata
                        </summary>
                        <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}