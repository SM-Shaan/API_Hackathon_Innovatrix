'use client';

import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { CampaignCard } from '@/components/CampaignCard';
import { campaignApi } from '@/lib/api';
import { Campaign } from '@/types';
import { Search, Filter, TrendingUp, Calendar, Target } from 'lucide-react';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [filteredCampaigns, setFilteredCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'newest' | 'goal' | 'progress'>('newest');

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    filterAndSortCampaigns();
  }, [campaigns, searchTerm, statusFilter, sortBy]);

  const loadCampaigns = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await campaignApi.getAll();
      
      if (response.success && response.data) {
        setCampaigns(response.data);
      } else {
        setError('Failed to load campaigns');
        
        // Mock data for demo
        setCampaigns([
          {
            id: 'demo-1',
            title: 'Emergency Medical Fund',
            description: 'Help fund critical medical treatments for families in need. Every donation makes a difference in saving lives.',
            goal_amount: 25000,
            current_amount: 18750,
            pledge_count: 124,
            status: 'ACTIVE',
            owner_id: 'demo-owner-1',
            owner_name: 'Medical Relief Foundation',
            created_at: '2024-01-15T10:00:00Z',
            ends_at: '2024-02-15T23:59:59Z',
          },
          {
            id: 'demo-2',
            title: 'Children Education Support',
            description: 'Provide quality education and school supplies for underprivileged children in rural areas.',
            goal_amount: 15000,
            current_amount: 9200,
            pledge_count: 87,
            status: 'ACTIVE',
            owner_id: 'demo-owner-2',
            owner_name: 'Education for All',
            created_at: '2024-01-10T08:30:00Z',
            ends_at: '2024-03-10T23:59:59Z',
          },
          {
            id: 'demo-3',
            title: 'Disaster Relief Fund',
            description: 'Support families affected by natural disasters with emergency supplies and temporary housing.',
            goal_amount: 50000,
            current_amount: 32100,
            pledge_count: 256,
            status: 'ACTIVE',
            owner_id: 'demo-owner-3',
            owner_name: 'Crisis Response Team',
            created_at: '2024-01-05T12:00:00Z',
            ends_at: '2024-02-29T23:59:59Z',
          },
          {
            id: 'demo-4',
            title: 'Community Garden Project',
            description: 'Create a sustainable community garden to provide fresh produce and promote environmental awareness.',
            goal_amount: 8000,
            current_amount: 8000,
            pledge_count: 143,
            status: 'COMPLETED',
            owner_id: 'demo-owner-4',
            owner_name: 'Green Community Initiative',
            created_at: '2023-12-01T09:00:00Z',
            ends_at: '2024-01-01T23:59:59Z',
          },
          {
            id: 'demo-5',
            title: 'Youth Sports Program',
            description: 'Fund equipment and facilities for underprivileged youth to participate in organized sports activities.',
            goal_amount: 20000,
            current_amount: 5600,
            pledge_count: 78,
            status: 'ACTIVE',
            owner_id: 'demo-owner-5',
            owner_name: 'Sports for All Foundation',
            created_at: '2024-01-20T14:30:00Z',
            ends_at: '2024-04-20T23:59:59Z',
          }
        ]);
      }
    } catch (err) {
      setError('Failed to load campaigns. Please try again later.');
      console.error('Error loading campaigns:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortCampaigns = () => {
    let filtered = campaigns.filter(campaign => {
      const matchesSearch = campaign.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          campaign.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (campaign.owner_name?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
      
      const matchesStatus = statusFilter === 'ALL' || campaign.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });

    // Sort campaigns
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'goal':
          return b.goal_amount - a.goal_amount;
        case 'progress':
          const progressA = (a.current_amount / a.goal_amount) * 100;
          const progressB = (b.current_amount / b.goal_amount) * 100;
          return progressB - progressA;
        default:
          return 0;
      }
    });

    setFilteredCampaigns(filtered);
  };

  const statsData = {
    total: campaigns.length,
    active: campaigns.filter(c => c.status === 'ACTIVE').length,
    completed: campaigns.filter(c => c.status === 'COMPLETED').length,
    totalRaised: campaigns.reduce((sum, c) => sum + c.current_amount, 0)
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Page Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">All Campaigns</h1>
              <p className="text-lg text-gray-600">
                Discover and support meaningful causes in your community
              </p>
            </div>

            {/* Quick Stats */}
            <div className="mt-6 md:mt-0 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary-600">{statsData.total}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-success-600">{statsData.active}</div>
                <div className="text-sm text-gray-600">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{statsData.completed}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  ${Math.round(statsData.totalRaised / 1000)}K
                </div>
                <div className="text-sm text-gray-600">Raised</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0 lg:space-x-4">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="w-5 h-5 text-gray-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-gray-400" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="newest">Newest First</option>
                  <option value="goal">Highest Goal</option>
                  <option value="progress">Most Progress</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-48 bg-gray-200 rounded-lg mb-4"></div>
                <div className="space-y-3">
                  <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-500 mb-4">{error}</div>
            <button onClick={loadCampaigns} className="btn-primary">
              Try Again
            </button>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No campaigns found</h3>
            <p className="text-gray-600 mb-4">
              Try adjusting your search or filter criteria.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
              }}
              className="btn-secondary"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <>
            {/* Results count */}
            <div className="flex items-center justify-between mb-6">
              <p className="text-gray-600">
                Showing {filteredCampaigns.length} of {campaigns.length} campaigns
              </p>
            </div>

            {/* Campaign Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCampaigns.map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}