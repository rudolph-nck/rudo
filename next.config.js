/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // Serve the NOVA app (separate Vercel project built with NOVA_BASE_PATH=/nova)
  // at rudo-ai.com/nova. Set NOVA_APP_URL to that deployment's origin to enable.
  async rewrites() {
    const novaUrl = process.env.NOVA_APP_URL?.replace(/\/$/, "");
    if (!novaUrl) return [];
    return [
      { source: "/nova", destination: `${novaUrl}/nova` },
      { source: "/nova/:path*", destination: `${novaUrl}/nova/:path*` },
    ];
  },
};

module.exports = nextConfig;
