export function HospitalStamp({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none select-none ${className}`}>
      <div className="relative flex h-20 w-20 -rotate-12 flex-col items-center justify-center rounded-full border-2 border-emerald-700/60 text-center text-emerald-700/70">
        <div className="absolute inset-[15%] rounded-full border border-emerald-700/60" />
        <span className="text-[8px] font-bold tracking-wider">GARDEN CITY</span>
        <span className="mt-0.5 px-1 text-[6.5px] font-bold leading-tight">SPECIALIST HOSPITAL</span>
        <span className="mt-0.5 text-[6.5px] tracking-widest">★ OFFICIAL ★</span>
      </div>
    </div>
  );
}
