'use client';

import React, { useState } from 'react';
import { Heart, CreditCard, Mail, DollarSign, Send } from 'lucide-react';

interface DonationFormProps {
  onSubmit: (data: {
    amount: number;
    email: string;
    campaignId: string;
    cardToken: string;
  }) => void;
  loading?: boolean;
}

export function DonationForm({ onSubmit, loading = false }: DonationFormProps) {
  const [formData, setFormData] = useState({
    amount: '',
    email: '',
    cardNumber: '',
    expiryDate: '',
    cvv: '',
  });

  const [selectedCampaign, setSelectedCampaign] = useState('campaign-1');

  const campaigns = [
    {
      id: 'campaign-1',
      title: 'Emergency Medical Fund',
      description: 'Help fund critical medical treatments',
      raised: 15750,
      target: 25000,
    },
    {
      id: 'campaign-2',
      title: 'Children Education Support',
      description: 'Provide education for underprivileged children',
      raised: 8200,
      target: 15000,
    },
    {
      id: 'campaign-3',
      title: 'Disaster Relief Fund',
      description: 'Support disaster-affected families',
      raised: 32100,
      target: 50000,
    },
  ];

  const predefinedAmounts = [25, 50, 100, 250, 500];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.amount || !formData.email) {
      alert('Please fill in all required fields');
      return;
    }

    // Simulate card token generation (in real app, this would be done securely)
    const cardToken = `tok_${Math.random().toString(36).substr(2, 9)}`;

    onSubmit({
      amount: parseFloat(formData.amount),
      email: formData.email,
      campaignId: selectedCampaign,
      cardToken,
    });
  };

  const selectedCampaignData = campaigns.find(c => c.id === selectedCampaign);
  const progressPercentage = selectedCampaignData 
    ? (selectedCampaignData.raised / selectedCampaignData.target) * 100 
    : 0;

  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
      <div className="p-6 bg-gradient-to-r from-primary-500 to-primary-600 text-white">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="w-6 h-6" />
          <h2 className="text-xl font-bold">Make a Donation</h2>
        </div>
        <p className="text-primary-100">
          Support our causes and see the real-time system flow in action
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Campaign Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Select Campaign
          </label>
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                className={`p-4 border rounded-lg cursor-pointer transition-all ${
                  selectedCampaign === campaign.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedCampaign(campaign.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">{campaign.title}</h4>
                  <input
                    type="radio"
                    name="campaign"
                    value={campaign.id}
                    checked={selectedCampaign === campaign.id}
                    onChange={() => setSelectedCampaign(campaign.id)}
                    className="text-primary-600"
                  />
                </div>
                <p className="text-sm text-gray-600 mb-3">{campaign.description}</p>
                
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Raised: ${campaign.raised.toLocaleString()}</span>
                    <span>Goal: ${campaign.target.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min(
                          (campaign.raised / campaign.target) * 100,
                          100
                        )}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Amount Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Donation Amount ($)
          </label>
          <div className="grid grid-cols-5 gap-2 mb-3">
            {predefinedAmounts.map((amount) => (
              <button
                key={amount}
                type="button"
                className={`p-2 border rounded text-sm font-medium transition-all ${
                  formData.amount === amount.toString()
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onClick={() => setFormData(prev => ({ ...prev, amount: amount.toString() }))}
              >
                ${amount}
              </button>
            ))}
          </div>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="number"
              placeholder="Custom amount"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              min="1"
              step="0.01"
            />
          </div>
        </div>

        {/* Contact Information */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="email"
              placeholder="your@email.com"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>
        </div>

        {/* Payment Information */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Payment Information
          </label>
          <div className="space-y-3">
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="1234 5678 9012 3456"
                value={formData.cardNumber}
                onChange={(e) => setFormData(prev => ({ ...prev, cardNumber: e.target.value }))}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                maxLength={19}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="MM/YY"
                value={formData.expiryDate}
                onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                maxLength={5}
              />
              <input
                type="text"
                placeholder="CVV"
                value={formData.cvv}
                onChange={(e) => setFormData(prev => ({ ...prev, cvv: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                maxLength={4}
              />
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !formData.amount || !formData.email}
          className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Processing Donation...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Donate ${formData.amount || '0'}
            </>
          )}
        </button>

        {/* Demo Notice */}
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Demo Mode:</strong> This is a demonstration. No real payment will be processed.
            Watch the system architecture flow in real-time!
          </p>
        </div>
      </form>
    </div>
  );
}