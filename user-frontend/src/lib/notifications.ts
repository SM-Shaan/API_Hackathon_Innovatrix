import { io, Socket } from 'socket.io-client';
import { ApiResponse } from '@/types';

export interface Notification {
  id: string;
  type: 'donation' | 'campaign_update' | 'system' | 'payment_status';
  title: string;
  message: string;
  data?: any;
  timestamp: string;
  read: boolean;
}

export interface NotificationPreferences {
  email_updates: boolean;
  sms_updates: boolean;
  push_notifications: boolean;
  donation_alerts: boolean;
  campaign_updates: boolean;
  system_notifications: boolean;
}

class NotificationService {
  private socket: Socket | null = null;
  private notifications: Notification[] = [];
  private listeners: ((notifications: Notification[]) => void)[] = [];
  private unreadCount = 0;

  constructor() {
    this.initializeWebSocket();
  }

  private initializeWebSocket() {
    const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8081';
    
    try {
      this.socket = io(WS_URL, {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        retries: 3
      });

      this.socket.on('connect', () => {
        console.log('Connected to notification service');
        this.authenticateSocket();
      });

      this.socket.on('notification', (notification: Notification) => {
        this.addNotification(notification);
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from notification service');
      });

      this.socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
      });

    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
    }
  }

  private authenticateSocket() {
    const token = localStorage.getItem('auth_token');
    if (token && this.socket) {
      this.socket.emit('authenticate', { token });
    }
  }

  private addNotification(notification: Notification) {
    this.notifications.unshift(notification);
    if (!notification.read) {
      this.unreadCount++;
    }
    this.notifyListeners();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.notifications));
  }

  // Subscribe to notification updates
  subscribe(callback: (notifications: Notification[]) => void) {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }

  // Get all notifications
  getNotifications(): Notification[] {
    return this.notifications;
  }

  // Get unread notification count
  getUnreadCount(): number {
    return this.unreadCount;
  }

  // Mark notification as read
  markAsRead(notificationId: string) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification && !notification.read) {
      notification.read = true;
      this.unreadCount = Math.max(0, this.unreadCount - 1);
      this.notifyListeners();
    }
  }

  // Mark all notifications as read
  markAllAsRead() {
    this.notifications.forEach(notification => {
      notification.read = true;
    });
    this.unreadCount = 0;
    this.notifyListeners();
  }

  // Clear all notifications
  clear() {
    this.notifications = [];
    this.unreadCount = 0;
    this.notifyListeners();
  }

  // Show browser notification (if permission granted)
  showBrowserNotification(title: string, message: string, options?: NotificationOptions) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: message,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });
    }
  }

  // Request notification permission
  async requestPermission(): Promise<NotificationPermission> {
    if ('Notification' in window) {
      return await Notification.requestPermission();
    }
    return 'denied';
  }

  // Disconnect WebSocket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // Reconnect WebSocket
  reconnect() {
    this.disconnect();
    this.initializeWebSocket();
  }

  // Join campaign notifications
  joinCampaign(campaignId: string) {
    if (this.socket) {
      this.socket.emit('join_campaign', { campaignId });
    }
  }

  // Leave campaign notifications
  leaveCampaign(campaignId: string) {
    if (this.socket) {
      this.socket.emit('leave_campaign', { campaignId });
    }
  }

  // Send test notification (development)
  sendTestNotification() {
    if (this.socket) {
      this.socket.emit('test_notification');
    }
  }
}

// Create singleton instance
const notificationService = new NotificationService();

// Notification API functions for HTTP requests
export const notificationApi = {
  getPreferences: async (): Promise<ApiResponse<NotificationPreferences>> => {
    try {
      const response = await fetch('/api/notifications/preferences', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: 'Failed to fetch notification preferences'
      };
    }
  },

  updatePreferences: async (preferences: Partial<NotificationPreferences>): Promise<ApiResponse<NotificationPreferences>> => {
    try {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(preferences)
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: 'Failed to update notification preferences'
      };
    }
  },

  getHistory: async (limit = 50, offset = 0): Promise<ApiResponse<Notification[]>> => {
    try {
      const response = await fetch(`/api/notifications/history?limit=${limit}&offset=${offset}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: 'Failed to fetch notification history'
      };
    }
  },

  sendEmail: async (to: string, subject: string, body: string): Promise<ApiResponse<void>> => {
    try {
      const response = await fetch('/api/notifications/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ to, subject, body })
      });
      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: 'Failed to send email notification'
      };
    }
  }
};

export default notificationService;