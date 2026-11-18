import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Lets phones/tablets on the LAN load dev assets and HMR (e.g. http://192.168.1.34:3000).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  // cacheComponents / partialPrefetching (Next 16 defaults) are off: with them on, pages
  // hung in the Workers runtime under OpenNext 1.20. Our pages are client-driven anyway.
  experimental: {
    // Upgrade reminders only for published security advisories.
    agentUpgrade: "security",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

// Gives `next dev` access to Cloudflare bindings (env, secrets) like the deployed Worker.
initOpenNextCloudflareForDev();
