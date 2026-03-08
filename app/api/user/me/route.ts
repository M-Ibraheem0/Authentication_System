import { NextRequest, NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { prisma, db } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const payload = await getAuthFromRequest(req);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db(() =>
      prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
          id: true,
          email: true,
          isVerified: true,
          mfaEnabled: true,
          createdAt: true,
        },
      })
    );

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (err) {
    console.error("[ME ERROR]", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}