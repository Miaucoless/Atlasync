/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Allow Mapbox GL to be imported correctly on the client
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs:  false,
        net: false,
        tls: false,
      };
    }
    return config;
  },

  // Allow images from Supabase storage, Unsplash, and Google avatars
  images: {
    domains: [
      'vsuavfymhowylcvdxnnq.supabase.co',
      'images.unsplash.com',
      'lh3.googleusercontent.com',
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options',        value: 'DENY'    },
          { key: 'X-XSS-Protection',       value: '1; mode=block' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
