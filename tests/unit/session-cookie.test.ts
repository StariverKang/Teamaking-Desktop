import { afterEach, describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { clearSessionCookie, SESSION_COOKIE } from "@/lib/session";

function setCookieHeaders(response: NextResponse) {
  return [...response.headers.entries()]
    .filter(([key]) => key.toLowerCase() === "set-cookie")
    .map(([, value]) => value);
}

describe("session cookie clearing", () => {
  afterEach(() => {
    delete process.env.SESSION_COOKIE_DOMAIN;
  });

  it("clears the host-only session cookie when no shared domain is configured", () => {
    const response = NextResponse.json({ ok: true });

    clearSessionCookie(response);

    const headers = setCookieHeaders(response);
    expect(headers).toHaveLength(1);
    expect(headers[0]).toContain(`${SESSION_COOKIE}=`);
    expect(headers[0]).toContain("Path=/");
    expect(headers[0]).toContain("Max-Age=0");
    expect(headers[0]).not.toContain("Domain=");
  });

  it("clears both host-only and shared-domain session cookies", () => {
    process.env.SESSION_COOKIE_DOMAIN = ".teamingapp.org";
    const response = NextResponse.json({ ok: true });

    clearSessionCookie(response);

    const headers = setCookieHeaders(response);
    expect(headers).toHaveLength(2);
    expect(headers[0]).toContain(`${SESSION_COOKIE}=`);
    expect(headers[0]).toContain("Path=/");
    expect(headers[0]).not.toContain("Domain=");
    expect(headers[1]).toContain(`${SESSION_COOKIE}=`);
    expect(headers[1]).toContain("Domain=.teamingapp.org");
    expect(headers.every((header) => header.includes("Max-Age=0"))).toBe(true);
  });
});
