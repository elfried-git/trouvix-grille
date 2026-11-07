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

  // Sécurité et protection du code
  productionBrowserSourceMaps: false,
  poweredByHeader: false,

  // Suppression des console.log informatifs dans les bundles de production
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error"] } : false,
  },

  // En-têtes HTTP de sécurité
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;