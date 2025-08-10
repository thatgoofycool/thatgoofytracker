/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '200mb'
    }
  },
  async headers() {
    const self = "'self'";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const vercelSelf = 'vercel.live';
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '';
    const connectSrc = [self, supabaseUrl, 'https://api.upstash.com', appUrl, 'https://plausible.io'].filter(Boolean).join(' ');
    const imgSrc = [self, 'data:', 'blob:', supabaseUrl].filter(Boolean).join(' ');
    const mediaSrc = [self, 'blob:', supabaseUrl].filter(Boolean).join(' ');
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' *.vercel.app *.vercel.dev plausible.io",
              `connect-src ${connectSrc}`,
              `img-src ${imgSrc}`,
              `media-src ${mediaSrc}`,
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self'",
              "frame-ancestors 'none'"
            ].join('; ')
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), camera=(), microphone=(), interest-cohort=()'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          }
        ]
      }
    ];
  }
};

export default nextConfig;


