import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@agentic/schemas", "@agentic/database", "@agentic/ai", "@agentic/jobs", "@agentic/auth", "@agentic/logger"],
};

export default config;
