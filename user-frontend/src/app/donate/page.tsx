'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Header } from '@/components/Header';
import { campaignApi, pledgeApi } from '@/lib/api';
import { Campaign, CreatePledgeDto } from '@/types';
import { CreditCard, DollarSign, Heart, Shield, ArrowLeft } from 'lucide-react';

export default function DonatePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const campaignId = searchParams.get('campaign');
  
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    amount: '',
    donor_email: '',
    donor_name: '',
    payment_method: {
      type: 'credit_card' as const,
      card_number: '',
      expiry_month: '',
      expiry_year: '',
      cvv: '',
      cardholder_name: ''
    }
  });

  useEffect(() => {
    if (campaignId) {
      loadCampaign();
    }
  }, [campaignId]);

  const loadCampaign = async () => {
    if (!campaignId) return;
    
    try {
      setLoading(true);
      const response = await campaignApi.getById(campaignId);
      if (response.success && response.data) {
        setCampaign(response.data);
      }
    } catch (err) {
      setError('Failed to load campaign details');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name.startsWith('payment_method.')) {
      const field = name.split('.')[1];
      setFormData(prev => ({
        ...prev,
        payment_method: {
          ...prev.payment_method,
          [field]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!campaignId) {
      setError('No campaign selected');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const pledgeData: CreatePledgeDto = {
        campaign_id: campaignId,
        donor_email: formData.donor_email,
        donor_name: formData.donor_name || undefined,
        amount: parseFloat(formData.amount),
        payment_method: formData.payment_method
      };

      const response = await pledgeApi.create(pledgeData);
      
      if (response.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push(`/campaigns/${campaignId}`);
        }, 2000);
      } else {
        setError(response.error || 'Failed to process donation');
      }
    } catch (err) {
      setError('Failed to process donation. Please try again.');
      console.error('Donation error:', err);
    } finally {
      setSubmitting(false);
    }
  };

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

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Heart className="w-8 h-8 text-success-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Thank You!</h1>
            <p className="text-lg text-gray-600 mb-6">
              Your donation has been submitted successfully. You will receive a confirmation email shortly.
            </p>
            <p className="text-sm text-gray-500">
              Redirecting you back to the campaign page...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Back Button */}
        <button
          onClick={() => router.back()}
          className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 mb-8"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Campaign Info */}
          <div className="card">
            {campaign ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  Support: {campaign.title}
                </h2>
                <p className="text-gray-600 mb-6">{campaign.description}</p>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Goal:</span>
                    <span className="font-semibold">${campaign.goal_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Raised:</span>
                    <span className="font-semibold text-primary-600">
                      ${campaign.current_amount.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700">Donors:</span>
                    <span className="font-semibold">{campaign.pledge_count}</span>
                  </div>
                </div>

                <div className="mt-6">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${Math.min((campaign.current_amount / campaign.goal_amount) * 100, 100)}%`
                      }}
                    ></div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600">Loading campaign details...</p>
              </div>
            )}
          </div>

          {/* Donation Form */}
          <div className="card">
            <div className="flex items-center space-x-2 mb-6">
              <Heart className="w-6 h-6 text-primary-600" />
              <h2 className="text-2xl font-bold text-gray-900">Make a Donation</h2>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Amount */}
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                  Donation Amount *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="number"
                    id="amount"
                    name="amount"
                    required
                    min="1"
                    step="0.01"
                    value={formData.amount}
                    onChange={handleInputChange}
                    className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Donor Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="donor_email" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    id="donor_email"
                    name="donor_email"
                    required
                    value={formData.donor_email}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label htmlFor="donor_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="donor_name"
                    name="donor_name"
                    value={formData.donor_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Your full name"
                  />
                </div>
              </div>

              {/* Payment Information */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                  <CreditCard className="w-5 h-5" />
                  <span>Payment Information</span>
                </h3>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="cardholder_name" className="block text-sm font-medium text-gray-700 mb-2">
                      Cardholder Name *
                    </label>
                    <input
                      type="text"
                      id="cardholder_name"
                      name="payment_method.cardholder_name"
                      required
                      value={formData.payment_method.cardholder_name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Name on card"
                    />
                  </div>

                  <div>
                    <label htmlFor="card_number" className="block text-sm font-medium text-gray-700 mb-2">
                      Card Number *
                    </label>
                    <input
                      type="text"
                      id="card_number"
                      name="payment_method.card_number"
                      required
                      maxLength={19}
                      value={formData.payment_method.card_number}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="1234 5678 9012 3456"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="expiry_month" className="block text-sm font-medium text-gray-700 mb-2">
                        Month *
                      </label>
                      <input
                        type="text"
                        id="expiry_month"
                        name="payment_method.expiry_month"
                        required
                        maxLength={2}
                        value={formData.payment_method.expiry_month}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="MM"
                      />
                    </div>
                    <div>
                      <label htmlFor="expiry_year" className="block text-sm font-medium text-gray-700 mb-2">
                        Year *
                      </label>
                      <input
                        type="text"
                        id="expiry_year"
                        name="payment_method.expiry_year"
                        required
                        maxLength={4}
                        value={formData.payment_method.expiry_year}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="YYYY"
                      />
                    </div>
                    <div>
                      <label htmlFor="cvv" className="block text-sm font-medium text-gray-700 mb-2">
                        CVV *
                      </label>
                      <input
                        type="text"
                        id="cvv"
                        name="payment_method.cvv"
                        required
                        maxLength={4}
                        value={formData.payment_method.cvv}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="123"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Notice */}
              <div className="bg-gray-50 rounded-lg p-4 flex items-start space-x-3">
                <Shield className="w-5 h-5 text-primary-600 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-1">Secure Payment</h4>
                  <p className="text-sm text-gray-600">
                    Your payment information is encrypted and secure. We use industry-standard security measures to protect your data.
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || !campaignId}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <Heart className="w-5 h-5 mr-2" />
                    Donate ${formData.amount || '0'}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}