/** @type {import('next').NextConfig} */
const nextConfig = {
  // Guide HTML is read from disk at request time; make sure it ships with the route
  outputFileTracingIncludes: {
    "/project-builder/[slug]": ["./src/content/project-builder/**"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

module.exports = nextConfig;
