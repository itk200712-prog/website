// ============================================================================
// Business detail පිටුවේ loading skeleton — hero + services + contacts
// හැඩයට සමානයි; click කළ ගමන්ම පිටුව එනවා කියලා පේනවා.
// ============================================================================

export default function BusinessDetailLoading() {
  return (
    <div className="min-h-screen bg-slate-50" role="status" aria-label="Loading">
      <div className="h-[72px] bg-slate-900" />
      {/* dark hero තැන (logo + නම + බොත්තම්) */}
      <div className="hero-dark">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 pb-14 text-center">
          <div className="mx-auto h-28 w-28 sm:h-36 sm:w-36 rounded-[1.75rem] bg-white/15 animate-pulse" />
          <div className="mx-auto mt-6 h-9 w-2/3 max-w-md rounded-xl bg-white/15 animate-pulse" />
          <div className="mx-auto mt-4 h-4 w-1/2 max-w-sm rounded bg-white/10 animate-pulse" />
          <div className="mt-7 flex items-center justify-center gap-3">
            <div className="h-11 w-36 rounded-full bg-white/15 animate-pulse" />
            <div className="h-11 w-36 rounded-full bg-white/10 animate-pulse" />
          </div>
        </div>
      </div>
      {/* services + contact පේළි */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 rounded-[1.4rem] bg-white shadow-sm ring-1 ring-slate-100 animate-pulse" />
          ))}
        </div>
        <div className="mt-6 space-y-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-20 rounded-[1.4rem] bg-white shadow-sm ring-1 ring-slate-100 animate-pulse" />
          ))}
        </div>
        <div className="mt-10 flex items-center justify-center gap-3 text-slate-400 text-[12.5px] font-semibold">
          <span className="h-4 w-4 rounded-full border-2 border-indigo-200 border-t-indigo-600 animate-spin" />
          Loading… · පූරණය වෙමින්…
        </div>
      </div>
    </div>
  );
}
