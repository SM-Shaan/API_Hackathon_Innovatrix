export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'ADMIN' | 'DONOR';
  created_at: string;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  goal_amount: number;
  current_amount: number;
  pledge_count: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  owner_id: string;
  owner_name?: string;
  created_at: string;
  ends_at?: string;
  image_url?: string;
}

export interface Pledge {
  id: string;
  campaign_id: string;
  donor_id?: string;
  donor_email: string;
  donor_name?: string;
  amount: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  created_at: string;
  idempotency_key: string;
}

export interface CreatePledgeDto {
  campaign_id: string;
  donor_email: string;
  donor_name?: string;
  amount: number;
  payment_method: {
    type: 'credit_card';
    card_number: string;
    expiry_month: string;
    expiry_year: string;
    cvv: string;
    cardholder_name: string;
  };
}

export interface Payment {
  id: string;
  pledge_id: string;
  amount: number;
  currency: string;
  state: 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  provider_reference?: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignStats {
  campaign_id: string;
  total_amount: number;
  pledge_count: number;
  last_updated: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface NotificationPreferences {
  email_updates: boolean;
  sms_updates: boolean;
  push_notifications: boolean;
}