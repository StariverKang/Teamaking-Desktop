import { NextRequest, NextResponse } from "next/server";

function adminHosts() {
  return (process.env.ADMIN_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1" || hostname.endsWith(".localhost");
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/") || pathname === "/admin-login" || pathname.startsWith("/api/admin") || pathname === "/api/auth/developer-login";
}

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get("host")?.split(":")[0]?.toLowerCase() ?? "";
  const allowedAdminHost = adminHosts().includes(hostname);

  if (allowedAdminHost && url.pathname === "/") {
    return NextResponse.redirect(new URL("/admin-login", request.url));
  }

  if (isAdminPath(url.pathname) && !isLocalHost(hostname) && !allowedAdminHost) {
    return new NextResponse("Not Found", { status: 404 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/admin/:path*", "/admin-login", "/api/admin/:path*", "/api/auth/developer-login"]
};
