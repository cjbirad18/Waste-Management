/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [{ hostname: "www.wikipedia.org" }],
  },
};

module.exports = nextConfig;
