import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma, db } from "@/lib/prisma";import { verifyAccessToken } from "@/lib/tokens";
import speakeasy from "speakeasy";
import { toDataURL } from "qrcode";

const confirmSchema = z.object({
  code: z.string().length(6, "Code must be 6 digits"),
});

// GET — generate secret + QR code
export async function GET(req: NextRequest) {
  try {
    const accessToken = req.cookies.get("access_token")?.value;
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyAccessToken(accessToken);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db(() =>prisma.user.findUnique({
      where: { id: payload.userId },
      select: { email: true, mfaEnabled: true },
    }));

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.mfaEnabled) {
      return NextResponse.json(
        { error: "MFA already enabled" },
        { status: 400 }
      );
    }
    const generated = speakeasy.generateSecret({ 
      name: `YourAppName:${user.email}` 
    });
    // generate secret
    const secret = generated.base32;

    // store temporarily in postgres (not active until confirmed)
    await db(() => prisma.user.update({
      where: { id: payload.userId },
      data: { mfaSecret: secret },
    }));

    // generate QR code
    const otpauth = generated.otpauth_url!; // use this for QR
    const qrCode = await toDataURL(otpauth);

    return NextResponse.json(
      { secret, qrCode },
      { status: 200 }
    );
  } catch (err) {
    console.error("[MFA SETUP GET ERROR]", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

// POST — confirm setup with first code
export async function POST(req: NextRequest) {
  try {
    const accessToken = req.cookies.get("access_token")?.value;
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifyAccessToken(accessToken);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors},
        { status: 400 }
      );
    }

    const { code } = parsed.data;

    const user = await db(() =>prisma.user.findUnique({
      where: { id: payload.userId },
      select: { mfaSecret: true, mfaEnabled: true },
    }));

    if (!user?.mfaSecret) {
      return NextResponse.json(
        { error: "MFA setup not initiated" },
        { status: 400 }
      );
    }

    if (user.mfaEnabled) {
      return NextResponse.json(
        { error: "MFA already enabled" },
        { status: 400 }
      );
    }

    // verify the first code to confirm setup
    const isValid = speakeasy.totp.verify({
      token: code,
      secret: user.mfaSecret,
      encoding: 'base32',  // critical
      window: 1,           // allows 30s clock drift between server and phone
    });

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid code. Scan the QR code again." },
        { status: 400 }
      );
    }

    // activate MFA
    await db(() => prisma.user.update({
      where: { id: payload.userId },
      data: { mfaEnabled: true },
    }));

    return NextResponse.json(
      { success: true, message: "MFA enabled successfully" },
      { status: 200 }
    );
  } catch (err) {
    console.error("[MFA SETUP POST ERROR]", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}