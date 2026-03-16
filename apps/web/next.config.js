/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@equitylens/core', '@equitylens/store'],
  experimental: {
    serverComponentsExternalPackages: ['better-sqlite3'],
  },
};

module.exports = nextConfig;
