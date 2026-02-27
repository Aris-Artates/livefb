/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  async headers() {
    const prod = process.env.NODE_ENV === "production";
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Facebook JS SDK
              "script-src 'self' 'unsafe-inline' https://connect.facebook.net",
              // Facebook video embeds
              "frame-src https://www.facebook.com",
              // Facebook profile pictures / CDN
              "img-src 'self' data: https://*.fbcdn.net https://*.facebook.com",
              // API calls
              `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}`,
              "style-src 'self' 'unsafe-inline'",
              "font-src 'self'",
            ].join("; "),
          },
          ...(prod
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
        ],
      },
    ];
  },

  images: {
    domains: ["graph.facebook.com", "platform-lookaside.fbsbx.com"],
  },
};

module.exports = nextConfig;
