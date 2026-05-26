/** @type {import('next').NextConfig} */
const crawlerTraceIncludes = [
  "./scripts/bnbu-crawler/**/*",
  "./node_modules/pdfjs-dist/package.json",
  "./node_modules/pdfjs-dist/legacy/build/*.mjs",
  "./node_modules/pdfjs-dist/standard_fonts/**/*",
  "./node_modules/pdfjs-dist/cmaps/**/*",
  "./node_modules/pdfjs-dist/wasm/**/*"
];

const nextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  outputFileTracingIncludes: {
    "/app/api/[...route]": crawlerTraceIncludes,
    "/api/[...route]": crawlerTraceIncludes
  }
};

export default nextConfig;
