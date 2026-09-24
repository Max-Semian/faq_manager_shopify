import type { Metadata } from "next";
import type { ReactNode } from "react";

// The API key is read from env at request time, not baked in at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FAQ Manager",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="shopify-api-key" content={process.env.SHOPIFY_API_KEY} />
        {/* App Bridge must load synchronously and before any other script. */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script src="https://cdn.shopify.com/shopifycloud/polaris.js" />
      </head>
      <body>{children}</body>
    </html>
  );
}
