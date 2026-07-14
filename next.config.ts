import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel doesn't need "standalone" — it handles the build automatically
  output: undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: ["*.space-z.ai", "*.chatglm.cn"],
  // Prisma doit rester un module externe (pas bundlé) pour fonctionner en production
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
};

export default nextConfig;