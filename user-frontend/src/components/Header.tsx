'use client';

import React from 'react';
import Link from 'next/link';
import { Heart, User, Monitor, LogOut } from 'lucide-react';

interface HeaderProps {
  user?: {
    email: string;
    name?: string;
    role: 'ADMIN' | 'DONOR';
  };
  onLogout?: () => void;
}

export function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Navigation */}
          <div className="flex items-center space-x-8">
            <Link href="/" className="flex items-center space-x-2">
              <Heart className="w-8 h-8 text-primary-600" />
              <span className="text-xl font-bold text-gray-900">CareForAll</span>
            </Link>
            
            <nav className="hidden md:flex items-center space-x-6">
              <Link 
                href="/"
                className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
              >
                Campaigns
              </Link>
              
              <Link 
                href="/donate"
                className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
              >
                Donate
              </Link>
              
              {user && (
                <Link 
                  href="/my-donations"
                  className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
                >
                  My Donations
                </Link>
              )}
              
              {user?.role === 'ADMIN' && (
                <Link 
                  href="/admin"
                  className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
                >
                  Admin
                </Link>
              )}
            </nav>
          </div>

          {/* Right side - User menu and System Monitor */}
          <div className="flex items-center space-x-4">
            {/* System Monitor Link */}
            <Link
              href="/monitor"
              className="flex items-center space-x-1 text-gray-600 hover:text-primary-600 transition-colors"
              title="System Architecture Monitor"
            >
              <Monitor className="w-5 h-5" />
              <span className="hidden sm:block text-sm font-medium">Monitor</span>
            </Link>

            {/* User Menu */}
            {user ? (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-gray-400" />
                  <div className="hidden sm:block">
                    <p className="text-sm font-medium text-gray-900">
                      {user.name || user.email}
                    </p>
                    <p className="text-xs text-gray-500">{user.role}</p>
                  </div>
                </div>
                
                <button
                  onClick={onLogout}
                  className="flex items-center space-x-1 text-gray-600 hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="hidden sm:block text-sm">Logout</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  href="/login"
                  className="text-gray-700 hover:text-primary-600 font-medium"
                >
                  Login
                </Link>
                <Link
                  href="/register"
                  className="btn-primary"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}