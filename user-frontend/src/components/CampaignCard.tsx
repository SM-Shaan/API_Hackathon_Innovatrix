'use client';

import React from 'react';
import Link from 'next/link';
import { Campaign } from '@/types';
import { Calendar, Target, Users, TrendingUp } from 'lucide-react';

interface CampaignCardProps {
  campaign: Campaign;
  showActions?: boolean;
}

export function CampaignCard({ campaign, showActions = true }: CampaignCardProps) {
  const progressPercentage = Math.min(
    (campaign.current_amount / campaign.goal_amount) * 100,
    100
  );

  const daysLeft = campaign.ends_at 
    ? Math.max(0, Math.ceil((new Date(campaign.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="card hover:shadow-lg transition-all duration-200 group">
      {/* Campaign Image */}
      <div className="relative h-48 bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg mb-4 overflow-hidden">
        {campaign.image_url ? (
          <img
            src={campaign.image_url}
            alt={campaign.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-white">
            <Target className="w-16 h-16 opacity-80" />
          </div>
        )}
        
        {/* Status Badge */}
        <div className="absolute top-3 right-3">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
            campaign.status === 'ACTIVE' 
              ? 'bg-success-500 text-white'
              : campaign.status === 'COMPLETED'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-500 text-white'
          }`}>
            {campaign.status}
          </span>
        </div>
      </div>

      {/* Campaign Content */}
      <div className="space-y-4">
        {/* Title and Description */}
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary-600 transition-colors">
            {campaign.title}
          </h3>
          <p className="text-gray-600 text-sm line-clamp-2">
            {campaign.description}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium text-gray-900">
              ${campaign.current_amount.toLocaleString()} raised
            </span>
            <span className="text-gray-500">
              {progressPercentage.toFixed(1)}%
            </span>
          </div>
          
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          
          <div className="text-sm text-gray-600">
            Goal: ${campaign.goal_amount.toLocaleString()}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
          <div className="flex items-center space-x-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">
              {campaign.pledge_count} donors
            </span>
          </div>
          
          {daysLeft !== null && (
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">
                {daysLeft > 0 ? `${daysLeft} days left` : 'Ended'}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        {showActions && (
          <div className="flex space-x-3 pt-4">
            <Link
              href={`/campaigns/${campaign.id}`}
              className="flex-1 btn-primary text-center"
            >
              View Details
            </Link>
            
            {campaign.status === 'ACTIVE' && (
              <Link
                href={`/donate?campaign=${campaign.id}`}
                className="flex-1 btn-secondary text-center flex items-center justify-center space-x-1"
              >
                <TrendingUp className="w-4 h-4" />
                <span>Donate</span>
              </Link>
            )}
          </div>
        )}

        {/* Owner Info */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs text-gray-500">
          <span>
            By {campaign.owner_name || 'Campaign Owner'}
          </span>
          <span>
            Created {new Date(campaign.created_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}