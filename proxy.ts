import { NextResponse, type NextRequest } from "next/server";

const SHOP_DOMAIN = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/;

export function proxy(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get("shop");
  const shopOrigin = shop && SHOP_DOMAIN.test(shop) ? `https://${shop}` : "https://*.myshopify.com";

  const response = NextResponse.next();
  response.headers.set(
    "Content-Security-Policy",
    `frame-ancestors ${shopOrigin} https://admin.shopify.com;`,
  );
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
