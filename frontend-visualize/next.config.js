/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  env: {
    API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:8080',
    WS_URL: process.env.WS_URL || 'ws://localhost:8080',
  },
}

module.exports = nextConfig