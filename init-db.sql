-- CareForAll Database Initialization Script
-- This script runs on first container startup

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create basic tables that services expect
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'USER',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create admin user on startup
INSERT INTO users (id, email, password_hash, name, role)
VALUES (
  gen_random_uuid(),
  'admin@careforall.com',
  '$2a$10$rQEY9jHzMmJ5KpWq8xZzXuHZJxvM3E5L8aKk9TjF5E5L8aKk9TjF5', -- password: admin123
  'Admin User',
  'ADMIN'
) ON CONFLICT (email) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
