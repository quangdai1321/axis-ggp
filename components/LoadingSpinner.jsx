export default function LoadingSpinner({ label = "Đang tải..." }) {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 px-5">
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full border-4 border-white/10" />
        <div className="absolute inset-0 rounded-full border-4 border-axis-blue border-t-axis-yellow animate-spin" />
      </div>
      <p className="text-white/60 text-sm font-bold tracking-wide">{label}</p>
    </div>
  );
}
