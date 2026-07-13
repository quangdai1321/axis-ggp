import Link from "next/link";

export default function NavBarSkeleton() {
  return (
    <nav className="sticky top-0 z-30 backdrop-blur bg-axis-navy/80 border-b border-white/10">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="font-display font-extrabold text-lg shrink-0">
          AXIS <span className="text-axis-yellow">GGP</span>
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/5 animate-pulse" />
          <div className="w-16 h-4 rounded bg-white/5 animate-pulse" />
          <div className="w-16 h-4 rounded bg-white/5 animate-pulse" />
          <div className="w-20 h-8 rounded-full bg-white/5 animate-pulse" />
        </div>
      </div>
    </nav>
  );
}
