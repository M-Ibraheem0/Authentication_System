import { NextRequest } from "next/server";

export function getFingerprint(req: NextRequest): string {
  const components = [
    req.headers.get("user-agent") ?? "unknown",
    req.headers.get("accept-language") ?? "unknown",
    req.headers.get("accept-encoding") ?? "unknown",
    req.headers.get("sec-ch-ua") ?? "unknown",
    req.headers.get("sec-ch-ua-platform") ?? "unknown",
  ].join("|");

  // simple hash without crypto module
  let hash = 0;
  for (let i = 0; i < components.length; i++) {
    const char = components.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

export function getIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export function getDeviceInfo(req: NextRequest): string {
  const ua = req.headers.get("user-agent") ?? "unknown";
  const platform = req.headers.get("sec-ch-ua-platform") ?? "unknown";
  return `${ua} | ${platform}`;
}