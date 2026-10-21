// ============================================================================
// Navigation loading skeleton — click කළ ගමන්ම මේක පේනවා (පරණ පිටුවේ
// හිරවෙලා වගේ නොපෙනී). Server data එනකල් තත්පර කිහිපයක් මේක තියෙනවා.
// ============================================================================

export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50" role="status" aria-label="Loading">
      {/* header තැන */}
      <div className="h-[72px] bg-slate-900" />
      {/* hero තැන */}
      <div className="hero-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-16">
          <div className="h-6 w-56 rounded-full bg-white/15 animate-pulse" />
          <div className="mt-8 h-10 w-2/3 max-w-xl rounded-xl bg-white/15 animate-pulse" />
          <div className="mt-4 h-4 w-1/2 max-w-md rounded bg-white/10 animate-pulse" />
          <div className="mt-2.5 h-4 w-1/3 max-w-sm rounded bg-white/10 animate-pulse" />
        </div>
      </div>
      {/* content තැන */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-40 rounded-3xl bg-white shadow-sm ring-1 ring-slate-100 animate-pulse" />
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
