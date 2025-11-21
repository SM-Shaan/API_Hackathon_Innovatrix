import axios from 'axios';
import { Campaign, Pledge, CreatePledgeDto, User, CampaignStats, ApiResponse } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for adding auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: async (email: string, password: string, name?: string) => {
    const response = await api.post<ApiResponse<{ user: User; token: string }>>('/users/register', {
      email,
      password,
      name,
    });
    return response.data;
  },

  login: async (email: string, password: string) => {
    const response = await api.post<ApiResponse<{ user: User; token: string }>>('/users/login', {
      email,
      password,
    });
    return response.data;
  },

  logout: async () => {
    await api.post('/users/logout');
    localStorage.removeItem('auth_token');
  },

  getProfile: async () => {
    const response = await api.get<ApiResponse<User>>('/users/profile');
    return response.data;
  },
};

// Campaign API
export const campaignApi = {
  getAll: async (): Promise<ApiResponse<Campaign[]>> => {
    const response = await api.get('/campaigns');
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<Campaign>> => {
    const response = await api.get(`/campaigns/${id}`);
    return response.data;
  },

  create: async (campaign: Omit<Campaign, 'id' | 'current_amount' | 'pledge_count' | 'created_at' | 'owner_id'>) => {
    const response = await api.post<ApiResponse<Campaign>>('/campaigns', campaign);
    return response.data;
  },

  update: async (id: string, updates: Partial<Campaign>) => {
    const response = await api.put<ApiResponse<Campaign>>(`/campaigns/${id}`, updates);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete<ApiResponse<void>>(`/campaigns/${id}`);
    return response.data;
  },
};

// Pledge API
export const pledgeApi = {
  create: async (pledgeData: CreatePledgeDto): Promise<ApiResponse<Pledge>> => {
    // Generate idempotency key
    const idempotencyKey = `pledge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const response = await api.post('/pledges', pledgeData, {
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });
    return response.data;
  },

  getById: async (id: string): Promise<ApiResponse<Pledge>> => {
    const response = await api.get(`/pledges/${id}`);
    return response.data;
  },

  getByEmail: async (email: string): Promise<ApiResponse<Pledge[]>> => {
    const response = await api.get(`/pledges/by-email/${encodeURIComponent(email)}`);
    return response.data;
  },

  getByCampaign: async (campaignId: string): Promise<ApiResponse<Pledge[]>> => {
    const response = await api.get(`/pledges/by-campaign/${campaignId}`);
    return response.data;
  },
};

// Totals API
export const totalsApi = {
  getCampaignTotal: async (campaignId: string): Promise<ApiResponse<CampaignStats>> => {
    const response = await api.get(`/totals/campaign/${campaignId}`);
    return response.data;
  },

  getAllTotals: async (): Promise<ApiResponse<CampaignStats[]>> => {
    const response = await api.get('/totals');
    return response.data;
  },

  getSystemStats: async () => {
    const response = await api.get('/totals/stats');
    return response.data;
  },
};

// Payment API
export const paymentApi = {
  getByPledge: async (pledgeId: string) => {
    const response = await api.get(`/payments/by-pledge/${pledgeId}`);
    return response.data;
  },

  getStatus: async (paymentId: string) => {
    const response = await api.get(`/payments/${paymentId}/status`);
    return response.data;
  },
};

// Health check
export const healthApi = {
  checkAll: async () => {
    const response = await api.get('/health');
    return response.data;
  },
};

export default api;