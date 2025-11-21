'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { CampaignCard } from '@/components/CampaignCard';
import { campaignApi, totalsApi } from '@/lib/api';
import { Campaign, CampaignStats } from '@/types';
import { 
  Heart, 
  Shield, 
  Zap, 
  TrendingUp, 
  Users, 
  DollarSign,
  ArrowRight,
  Activity,
  CheckCircle
} from 'lucide-react';

export default function HomePage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<{
    totalCampaigns: number;
    totalRaised: number;
    totalDonors: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load campaigns and totals
      const [campaignsResponse, totalsResponse] = await Promise.all([
        campaignApi.getAll(),
        totalsApi.getAllTotals(),
      ]);

      if (campaignsResponse.success && campaignsResponse.data) {
        setCampaigns(campaignsResponse.data);
      }

      if (totalsResponse.success && totalsResponse.data) {
        const totals = totalsResponse.data;
        setStats({
          totalCampaigns: totals.length,
          totalRaised: totals.reduce((sum, t) => sum + t.total_amount, 0),
          totalDonors: totals.reduce((sum, t) => sum + t.pledge_count, 0),
        });
      }
    } catch (err) {
      setError('Failed to load campaigns. Please try again later.');
      console.error('Error loading data:', err);
      
      // Mock data for demo purposes
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
      ]);

      setStats({
        totalCampaigns: 3,
        totalRaised: 60050,
        totalDonors: 467,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary-600 to-primary-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl lg:text-5xl font-bold mb-6">
                Making a Difference,
                <span className="block text-primary-200">One Donation at a Time</span>
              </h1>
              <p className="text-xl text-primary-100 mb-8">
                Join our secure, transparent platform where every contribution creates real impact. 
                Powered by cutting-edge technology for maximum trust and efficiency.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/donate" className="btn-primary bg-white text-primary-600 hover:bg-gray-100">
                  Start Donating
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
                <Link href="/monitor" className="btn-secondary border-white text-white hover:bg-white hover:text-primary-600">
                  <Activity className="mr-2 w-5 h-5" />
                  View System Monitor
                </Link>
              </div>
            </div>
            
            <div className="lg:text-center">
              <div className="grid grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2">
                    ${stats?.totalRaised.toLocaleString() || '0'}
                  </div>
                  <div className="text-primary-200">Total Raised</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2">
                    {stats?.totalDonors.toLocaleString() || '0'}
                  </div>
                  <div className="text-primary-200">Happy Donors</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2">
                    {stats?.totalCampaigns || '0'}
                  </div>
                  <div className="text-primary-200">Active Campaigns</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold mb-2">99.9%</div>
                  <div className="text-primary-200">Uptime</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Choose CareForAll?
            </h2>
            <p className="text-lg text-gray-600">
              Built with enterprise-grade architecture for maximum security and reliability
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Bulletproof Security</h3>
              <p className="text-gray-600">
                Advanced idempotency protection prevents duplicate charges. 
                Your donations are processed safely every time.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-success-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">100% Reliable</h3>
              <p className="text-gray-600">
                Transactional outbox pattern ensures no donations are lost. 
                Event-driven architecture guarantees delivery.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-warning-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-warning-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Lightning Fast</h3>
              <p className="text-gray-600">
                CQRS architecture provides instant campaign totals. 
                Sub-millisecond response times for the best experience.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Campaigns Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-12">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">
                Featured Campaigns
              </h2>
              <p className="text-lg text-gray-600">
                Support causes that matter to you
              </p>
            </div>
            
            <Link 
              href="/campaigns" 
              className="btn-secondary flex items-center space-x-2"
            >
              <span>View All</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
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
              <button onClick={loadData} className="btn-primary">
                Try Again
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {campaigns.slice(0, 6).map((campaign) => (
                <CampaignCard key={campaign.id} campaign={campaign} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Technical Architecture Showcase */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Built for Scale & Reliability
            </h2>
            <p className="text-lg text-gray-600">
              Experience our microservices architecture in real-time
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-2xl font-bold text-primary-600 mb-2">7</div>
              <div className="text-sm text-gray-600">Microservices</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-success-600 mb-2">1000+</div>
              <div className="text-sm text-gray-600">Requests/Second</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-warning-600 mb-2">&lt;50ms</div>
              <div className="text-sm text-gray-600">Response Time</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600 mb-2">99.9%</div>
              <div className="text-sm text-gray-600">Availability</div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link 
              href="/monitor" 
              className="btn-primary inline-flex items-center space-x-2"
            >
              <Activity className="w-5 h-5" />
              <span>View Live Architecture</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Heart className="w-6 h-6 text-primary-500" />
                <span className="text-xl font-bold">CareForAll</span>
              </div>
              <p className="text-gray-400">
                A next-generation donation platform built with modern microservices architecture.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/campaigns" className="hover:text-white">Campaigns</Link></li>
                <li><Link href="/donate" className="hover:text-white">Donate</Link></li>
                <li><Link href="/monitor" className="hover:text-white">System Monitor</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Architecture</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Microservices</li>
                <li>Event-Driven</li>
                <li>CQRS Pattern</li>
                <li>Real-time Updates</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Security</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Idempotency Protection</li>
                <li>State Machine Validation</li>
                <li>Transactional Outbox</li>
                <li>Full Observability</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 CareForAll. Hackathon Demo - Built with ❤️ by Team API Avengers</p>
          </div>
        </div>
      </footer>
    </div>
  );
}