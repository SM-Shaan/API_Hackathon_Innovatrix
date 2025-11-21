'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { EventLog, ServiceStatus, DonationFlow } from '@/types';

interface WebSocketData {
  type: string;
  payload: any;
}

export function useWebSocket(url: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [services, setServices] = useState<Record<string, ServiceStatus>>({});
  const [flows, setFlows] = useState<Record<string, DonationFlow>>({});
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    try {
      wsRef.current = new WebSocket(url);
      
      wsRef.current.onopen = () => {
        setIsConnected(true);
        console.log('WebSocket connected');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data: WebSocketData = JSON.parse(event.data);
          
          switch (data.type) {
            case 'event_log':
              setEvents(prev => [data.payload, ...prev].slice(0, 100)); // Keep last 100 events
              break;
              
            case 'service_status':
              setServices(prev => ({
                ...prev,
                [data.payload.name]: data.payload
              }));
              break;
              
            case 'flow_update':
              setFlows(prev => ({
                ...prev,
                [data.payload.id]: data.payload
              }));
              break;
              
            case 'system_metrics':
              // Handle system metrics updates
              break;
              
            default:
              console.log('Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        setIsConnected(false);
        console.log('WebSocket disconnected');
        
        // Attempt to reconnect after 3 seconds
        setTimeout(connect, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setTimeout(connect, 3000);
    }
  }, [url]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    isConnected,
    events,
    services,
    flows,
    sendMessage,
    connect,
    disconnect,
  };
}