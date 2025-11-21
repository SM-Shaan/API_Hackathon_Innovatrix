'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { campaignApi, pledgeApi, totalsApi } from '@/lib/api';
import { Campaign, Pledge, CampaignStats } from '@/types';
import { 
  ArrowLeft, 
  Calendar, 
  Target, 
  Users, 
  DollarSign, 
  Heart,
  Share2,
  TrendingUp,
  Clock,
  CheckCircle,
  Mail,
  User
} from 'lucide-react';

export default function CampaignDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (campaignId) {
      loadCampaignData();
    }
  }, [campaignId]);

  const loadCampaignData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [campaignResponse, pledgesResponse, statsResponse] = await Promise.all([
        campaignApi.getById(campaignId),
        pledgeApi.getByCampaign(campaignId),
        totalsApi.getCampaignTotal(campaignId)
      ]);

      if (campaignResponse.success && campaignResponse.data) {
        setCampaign(campaignResponse.data);
      } else {
        // Mock campaign data for demo
        setCampaign({
          id: campaignId,
          title: 'Emergency Medical Fund',
          description: 'Help fund critical medical treatments for families in need. Every donation makes a difference in saving lives. Our mission is to ensure that no family has to choose between financial stability and medical care. With your support, we can provide essential treatments, medications, and medical equipment to those who need it most. Every contribution, no matter the size, brings hope and healing to families facing medical crises.',
          goal_amount: 25000,
          current_amount: 18750,
          pledge_count: 124,
          status: 'ACTIVE',
          owner_id: 'demo-owner-1',
          owner_name: 'Medical Relief Foundation',
          created_at: '2024-01-15T10:00:00Z',
          ends_at: '2024-02-15T23:59:59Z',
        });
      }

      if (pledgesResponse.success && pledgesResponse.data) {
        setPledges(pledgesResponse.data);
      } else {
        // Mock pledges data for demo
        setPledges([
          {
            id: '1',
            campaign_id: campaignId,
            donor_email: 'john.doe@example.com',
            donor_name: 'John Doe',
            amount: 250,
            status: 'COMPLETED',
            created_at: '2024-01-16T10:30:00Z',
            idempotency_key: 'demo-key-1'
          },
          {
            id: '2',
            campaign_id: campaignId,
            donor_email: 'sarah.wilson@example.com',
            donor_name: 'Sarah Wilson',
            amount: 150,
            status: 'COMPLETED',
            created_at: '2024-01-17T14:20:00Z',
            idempotency_key: 'demo-key-2'
          },
          {
            id: '3',
            campaign_id: campaignId,
            donor_email: 'anonymous@donor.com',
            amount: 500,
            status: 'COMPLETED',
            created_at: '2024-01-18T09:15:00Z',
            idempotency_key: 'demo-key-3'
          }
        ]);
      }

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }

    } catch (err) {
      setError('Failed to load campaign details. Please try again later.');
      console.error('Error loading campaign data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: campaign?.title,
        text: campaign?.description,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Campaign link copied to clipboard!');
    }
  };

  const progressPercentage = campaign 
    ? Math.min((campaign.current_amount / campaign.goal_amount) * 100, 100)
    : 0;

  const daysLeft = campaign?.ends_at 
    ? Math.max(0, Math.ceil((new Date(campaign.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="text-red-500 mb-4">{error || 'Campaign not found'}</div>
            <button onClick={() => router.back()} className="btn-primary">
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to campaigns</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Campaign Header */}
            <div className="card">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                      campaign.status === 'ACTIVE' 
                        ? 'bg-success-100 text-success-700'
                        : campaign.status === 'COMPLETED'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}>
                      {campaign.status}
                    </span>
                    {daysLeft !== null && (
                      <div className="flex items-center space-x-1 text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm">
                          {daysLeft > 0 ? `${daysLeft} days left` : 'Campaign ended'}
                        </span>
                      </div>
                    )}
                  </div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-4">{campaign.title}</h1>
                </div>
                <button
                  onClick={handleShare}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <Share2 className="w-4 h-4" />
                  <span>Share</span>
                </button>
              </div>

              {/* Campaign Image */}
              <div className="relative h-64 bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg mb-6 overflow-hidden">
                {campaign.image_url ? (
                  <img
                    src={campaign.image_url}
                    alt={campaign.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-white">
                    <Target className="w-20 h-20 opacity-80" />
                  </div>
                )}
              </div>

              {/* Progress */}
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-2xl font-bold text-gray-900">
                    ${campaign.current_amount.toLocaleString()}
                  </span>
                  <span className="text-lg text-gray-600">
                    of ${campaign.goal_amount.toLocaleString()} goal
                  </span>
                </div>
                
                <div className="progress-bar h-3">
                  <div
                    className="progress-fill h-3"
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-lg font-semibold text-gray-900">
                      {progressPercentage.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-600">funded</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">
                      {campaign.pledge_count}
                    </div>
                    <div className="text-sm text-gray-600">backers</div>
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-gray-900">
                      {daysLeft !== null ? daysLeft : '∞'}
                    </div>
                    <div className="text-sm text-gray-600">days left</div>
                  </div>
                </div>
              </div>

              {/* Campaign Owner */}
              <div className="border-t border-gray-200 pt-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {campaign.owner_name || 'Campaign Owner'}
                    </h3>
                    <p className="text-sm text-gray-600">Campaign organizer</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="card">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">About this campaign</h2>
              <div className="prose prose-gray max-w-none">
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {campaign.description}
                </p>
              </div>
            </div>

            {/* Recent Donations */}
            <div className="card">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Recent donations</h2>
              
              {pledges.length === 0 ? (
                <div className="text-center py-8">
                  <Heart className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No donations yet. Be the first to support this campaign!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pledges.slice(0, 10).map((pledge) => (
                    <div key={pledge.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-success-100 rounded-full flex items-center justify-center">
                          <Heart className="w-5 h-5 text-success-600" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-gray-900">
                              {pledge.donor_name || 'Anonymous'}
                            </span>
                            {pledge.status === 'COMPLETED' && (
                              <CheckCircle className="w-4 h-4 text-success-600" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            {new Date(pledge.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-primary-600">
                          ${pledge.amount.toLocaleString()}
                        </div>
                        <div className={`text-xs ${
                          pledge.status === 'COMPLETED' 
                            ? 'text-success-600' 
                            : pledge.status === 'PROCESSING'
                            ? 'text-warning-600'
                            : 'text-gray-600'
                        }`}>
                          {pledge.status.toLowerCase()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              {/* Donation Card */}
              <div className="card mb-6">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Support this campaign</h3>
                
                {campaign.status === 'ACTIVE' ? (
                  <div className="space-y-4">
                    <Link
                      href={`/donate?campaign=${campaign.id}`}
                      className="w-full btn-primary flex items-center justify-center space-x-2"
                    >
                      <Heart className="w-5 h-5" />
                      <span>Donate Now</span>
                    </Link>
                    
                    <div className="text-center text-sm text-gray-600">
                      Secure payment powered by Stripe
                    </div>
                  </div>
                ) : campaign.status === 'COMPLETED' ? (
                  <div className="text-center py-4">
                    <CheckCircle className="w-12 h-12 text-success-600 mx-auto mb-2" />
                    <p className="text-success-700 font-medium">Campaign Completed</p>
                    <p className="text-sm text-gray-600 mt-1">Thank you to all supporters!</p>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-gray-700 font-medium">Campaign Ended</p>
                    <p className="text-sm text-gray-600 mt-1">This campaign is no longer accepting donations</p>
                  </div>
                )}
              </div>

              {/* Campaign Info */}
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Campaign details</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">Created</div>
                      <div className="text-sm text-gray-600">
                        {new Date(campaign.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  {campaign.ends_at && (
                    <div className="flex items-center space-x-3">
                      <Clock className="w-5 h-5 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">Ends</div>
                        <div className="text-sm text-gray-600">
                          {new Date(campaign.ends_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-3">
                    <Target className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">Goal</div>
                      <div className="text-sm text-gray-600">
                        ${campaign.goal_amount.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Users className="w-5 h-5 text-gray-400" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">Supporters</div>
                      <div className="text-sm text-gray-600">
                        {campaign.pledge_count} people
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}