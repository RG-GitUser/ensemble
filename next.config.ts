import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  // Nothing gained by naming the framework and its version to every scanner.
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Room for project-file zips on integration quote requests (25MB + form overhead).
      bodySizeLimit: "26mb",
    },
  },
};

export default nextConfig;
