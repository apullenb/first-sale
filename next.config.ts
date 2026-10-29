import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // PGlite loads its WebAssembly files from disk, which breaks when bundled
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    // Room for a 4 MB document upload plus the form's own overhead
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  // The overview of every step is /start; task pages stay at /checklist/<id>
  async redirects() {
    return [{ source: "/checklist", destination: "/start", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // No framing, so sign-in pages can't be overlaid by another site
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // Owners' files never run scripts on this site; later rules win
        source: "/documents/:id/file",
        headers: [{ key: "Content-Security-Policy", value: "sandbox; frame-ancestors 'none'" }],
      },
      {
        source: "/brand/files/:id",
        headers: [{ key: "Content-Security-Policy", value: "sandbox; frame-ancestors 'none'" }],
      },
      {
        source: "/brand-library/files/:id",
        headers: [{ key: "Content-Security-Policy", value: "sandbox; frame-ancestors 'none'" }],
      },
      {
        source: "/photos/:id/file",
        headers: [{ key: "Content-Security-Policy", value: "sandbox; frame-ancestors 'none'" }],
      },
      {
        source: "/photos/:id/versions/:versionId/file",
        headers: [{ key: "Content-Security-Policy", value: "sandbox; frame-ancestors 'none'" }],
      },
      {
        // Viewing in the browser: its PDF viewer doesn't run in a sandboxed page. Files are checked by their first bytes.
        source: "/documents/:id/file",
        has: [{ type: "query", key: "view", value: "1" }],
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'none'" }],
      },
    ];
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
