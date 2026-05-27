/** @type {import('next').NextConfig} */
const crawlerTraceIncludes = [
  "./scripts/bnbu-crawler/**/*",
  "./node_modules/@napi-rs/canvas*/**/*",
  "./node_modules/pdfjs-dist/node_modules/@napi-rs/canvas*/**/*",
  "./node_modules/pdfjs-dist/package.json",
  "./node_modules/pdfjs-dist/legacy/build/*.mjs",
  "./node_modules/pdfjs-dist/standard_fonts/**/*",
  "./node_modules/pdfjs-dist/cmaps/**/*",
  "./node_modules/pdfjs-dist/wasm/**/*",
  "./node_modules/pdf-parse/package.json",
  "./node_modules/pdf-parse/dist/**/*",
  "./node_modules/pdf-parse/node_modules/pdfjs-dist/package.json",
  "./node_modules/pdf-parse/node_modules/pdfjs-dist/legacy/build/*.mjs",
  "./node_modules/pdf-parse/node_modules/pdfjs-dist/standard_fonts/**/*",
  "./node_modules/pdf-parse/node_modules/pdfjs-dist/cmaps/**/*",
  "./node_modules/pdf-parse/node_modules/pdfjs-dist/wasm/**/*"
];

const nextConfig = {
  serverExternalPackages: ["@prisma/client", "prisma"],
  outputFileTracingIncludes: {
    "/app/api/[...route]": crawlerTraceIncludes,
    "/api/[...route]": crawlerTraceIncludes
  }
};

export default nextConfig;
