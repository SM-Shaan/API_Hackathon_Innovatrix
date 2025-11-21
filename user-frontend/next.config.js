/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  env: {
    API_BASE_URL: 'http://localhost:8080/api',
    WS_URL: 'ws://localhost:8080/ws',
  },
}

module.exports = nextConfig