import crypto from "crypto";
import { NextRequest } from "next/server";

export function getFingerprint(req: NextRequest): string {
  const components = [
    req.headers.get("user-agent") ?? "unknown",
    req.headers.get("accept-language") ?? "unknown",
    req.headers.get("accept-encoding") ?? "unknown",
    req.headers.get("sec-ch-ua") ?? "unknown",
    req.headers.get("sec-ch-ua-platform") ?? "unknown",
  ];

  return crypto
    .createHash("sha256")
    .update(components.join("|"))
    .digest("hex");
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