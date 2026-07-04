/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  experimental: {},
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'customer-assets.emergentagent.com' },
    ],
  },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  
  // Proxies all client-side /api/* requests directly to our Django backend.
  // This lets the frontend call endpoints like /api/analytics or /api/customers
  // and routes them to Django without needing Next.js API routes.
  async rewrites() {
    const backendServerUrl = process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendServerUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
