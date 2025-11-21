-- CareForAll Database Initialization Script
-- This script runs on first container startup

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
-- (Tables are created by each service on startup)
