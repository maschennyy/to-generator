import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./lib/generated/prisma/**/*"],
  },
};

export default nextConfig;
