import { NextResponse } from "next/server";
import { updateSession } from "./lib/supabase/middleware";
import { isSupabaseConfigured } from "./lib/supabase/config";

export async function proxy(request) {
  if (!isSupabaseConfigured) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
