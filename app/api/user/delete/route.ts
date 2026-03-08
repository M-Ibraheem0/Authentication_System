import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAuthFromRequest } from "@/lib/auth";
import { prisma, db } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { deleteAllUserSessions, clearAuthCookies } from "@/lib/session";

const schema = z.object({
  password: z.string().min(1, "Password required"),
});

export async function DELETE(req: NextRequest) {
  try {
    const payload = await getAuthFromRequest(req);
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { password } = parsed.data;

    const user = await db(() =>
      prisma.user.findUnique({
        where: { id: payload.userId },
        select: { hashedPassword: true },
      })
    );

    if (!user?.hashedPassword) {
      return NextResponse.json(
        { error: "Cannot delete OAuth-only accounts yet" },
        { status: 400 }
      );
    }

    const valid = await verifyPassword(password, user.hashedPassword);
    if (!valid) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 400 }
      );
    }

    // delete all sessions first
    await deleteAllUserSessions(payload.userId);

    // delete user (cascades to sessions + oauth accounts)
    await db(() =>
      prisma.user.delete({
        where: { id: payload.userId },
      })
    );

    const response = NextResponse.json(
      { success: true },
      { status: 200 }
    );

    clearAuthCookies(response);
    return response;
  } catch (err) {
    console.error("[DELETE ACCOUNT ERROR]", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}