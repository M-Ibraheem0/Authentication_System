import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/tokens";
import { deleteSession, clearAuthCookies } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const accessToken = req.cookies.get("access_token")?.value;
    const sessionId = req.cookies.get("session_id")?.value;

    if (accessToken && sessionId) {
      const payload = await verifyAccessToken(accessToken);
      if (payload && payload.sessionId === sessionId) {
        await deleteSession(sessionId);
      }
    }

    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );

    clearAuthCookies(response);

    return response;
  } catch (err) {
    console.error("[SIGNOUT ERROR]", err);
    // always clear cookies even if something fails
    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );
    clearAuthCookies(response);
    return response;
  }
}