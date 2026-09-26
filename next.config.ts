import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Izinkan domain ngrok mengakses server development Next.js
  allowedDevOrigins: [
    '*.ngrok-free.dev',
    '*.ngrok-free.app',
    'aroma-quench-gallantly.ngrok-free.dev',
  ],
};

export default nextConfig;