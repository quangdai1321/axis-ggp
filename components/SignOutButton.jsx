"use client";

import { useState } from "react";
import { signOutAction } from "@/app/login/actions";

export default function SignOutButton() {
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    await signOutAction();
    // hard reload — avoids any stale client-side route cache after auth state changes
    window.location.href = "/";
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={pending}
      className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full transition disabled:opacity-60"
    >
      {pending ? "Đang thoát..." : "Đăng xuất"}
    </button>
  );
}
