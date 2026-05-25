import { NextRequest, NextResponse } from "next/server";
import { localeCookieName, localeFromCountry, normalizeLocale } from "@/lib/i18n";

function adminHosts() {
  return (process.env.ADMIN_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function crawlerHosts() {
  return (process.env.CRAWLER_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".localhost");
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/admin-login" || pathname.startsWith("/api/admin") || pathname === "/api/auth/admin-login" || pathname === "/api/auth/developer-login";
}

function isAdminAuthPath(pathname: string) {
  return pathname === "/admin-login" || pathname === "/api/auth/admin-login" || pathname === "/api/auth/developer-login";
}

function isCrawlerPath(pathname: string) {
  return pathname === "/crawler" || pathname.startsWith("/crawler/") || pathname.startsWith("/api/crawler");
}

export function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  const allowedAdminHost = adminHosts().includes(hostname);
  const allowedCrawlerHost = crawlerHosts().includes(hostname);
  const response = NextResponse.next();
  const existingLocale = normalizeLocale(request.cookies.get(localeCookieName)?.value);
  if (!existingLocale) {
    const country = request.headers.get("x-vercel-ip-country") ?? request.headers.get("cf-ipcountry");
    response.cookies.set(localeCookieName, localeFromCountry(country), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax"
    });
  }

  if (allowedAdminHost && url.pathname === "/") {
    return NextResponse.redirect(new URL("/admin-login", request.url));
  }

  if (allowedCrawlerHost && url.pathname === "/") {
    return NextResponse.redirect(new URL("/crawler", request.url));
  }

  if (isAdminPath(url.pathname) && !isLocalHost(hostname) && !allowedAdminHost && !(allowedCrawlerHost && isAdminAuthPath(url.pathname))) {
    return new NextResponse("Not Found", { status: 404 });
  }

  if (isCrawlerPath(url.pathname) && !isLocalHost(hostname) && !allowedCrawlerHost) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads|.*\\..*).*)"]
};
