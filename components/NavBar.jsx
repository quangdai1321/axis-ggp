import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import BackgroundMusic from "./BackgroundMusic";
import SignOutButton from "./SignOutButton";

export default async function NavBar() {
  let profile = null;

  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("username, is_admin")
        .eq("id", user.id)
        .maybeSingle();
      profile = data;
    }
  }

  return (
    <nav className="sticky top-0 z-30 backdrop-blur bg-axis-navy/80 border-b border-white/10">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="font-display font-extrabold text-lg shrink-0">
          AXIS <span className="text-axis-yellow">GGP</span>
        </Link>
        <div className="flex items-center gap-4 sm:gap-6 text-sm font-bold flex-wrap justify-end">
          <BackgroundMusic />
          <Link href="/lobby" className="text-white/80 hover:text-white transition">
            Sảnh chờ
          </Link>
          <Link href="/race" className="text-white/80 hover:text-white transition">
            Đường đua
          </Link>
          <Link href="/leaderboard" className="text-white/80 hover:text-white transition">
            Xếp hạng
          </Link>
          {profile ? (
            <div className="flex items-center gap-3">
              <span className="text-axis-yellow">
                {profile.username}
                {profile.is_admin && (
                  <span className="ml-1 text-[10px] bg-axis-yellow text-axis-navy px-1.5 py-0.5 rounded-full align-middle">
                    ADMIN
                  </span>
                )}
              </span>
              <SignOutButton />
            </div>
          ) : (
            <Link
              href="/login"
              className="bg-axis-yellow text-axis-navy px-4 py-1.5 rounded-full hover:scale-105 transition"
            >
              Đăng nhập
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
