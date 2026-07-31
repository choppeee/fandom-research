/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium", "puppeteer"],
  outputFileTracingIncludes: {
    "/**": ["./node_modules/@sparticuz/chromium/**"],
  },
};

module.exports = nextConfig;
