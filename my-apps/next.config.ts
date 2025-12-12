/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  images: {
    remotePatterns: [{ hostname: "www.wikipedia.org" }],
  },
};

module.exports = nextConfig;
