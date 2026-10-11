import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const cspDirectives = [
  "default-src 'self'",
  isProd
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.rbxcdn.com https://thumbnails.roblox.com https://api.sandbox.midtrans.com https://api.midtrans.com",
  "font-src 'self' data:",
  "connect-src 'self' https://api.sandbox.midtrans.com https://api.midtrans.com",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
];

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: cspDirectives.join('; '),
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  // Izinkan domain ngrok mengakses server development Next.js
  allowedDevOrigins: [
    '*.ngrok-free.dev',
    '*.ngrok-free.app',
    'aroma-quench-gallantly.ngrok-free.dev',
  ],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;