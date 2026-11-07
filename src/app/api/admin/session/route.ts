import { NextRequest, NextResponse } from "next/server";
import {
  createAdminSessionToken,
  isAdminAuthorized,
  isValidAdminPinOrHash,
} from "@/lib/review-storage";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const authenticated = isAdminAuthorized(req);
  return NextResponse.json({ authenticated });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const pinOrHash = typeof body?.pinHash === "string" ? body.pinHash : typeof body?.pin === "string" ? body.pin : "";

    if (!isValidAdminPinOrHash(pinOrHash)) {
      return NextResponse.json({ error: "Code PIN incorrect" }, { status: 401 });
    }

    const token = createAdminSessionToken();
    const res = NextResponse.json({ ok: true });

    res.cookies.set("benchou_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60, // 24 hours
      path: "/",
    });

    return res;
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("benchou_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });
  return res;
}
