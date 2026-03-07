/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,

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

  // Security headers (Cache-Control in dev prevents refresh loop on some setups)
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';
    return [
      {
        source: '/(.*)',
        headers: [
          ...(isDev ? [{ key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' }] : []),
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options',        value: 'DENY'    },
          { key: 'X-XSS-Protection',       value: '1; mode=block' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
