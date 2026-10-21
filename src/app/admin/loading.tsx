// ============================================================================
// Admin පිටු අතර මාරු වන විට පේන loading එක — sidebar එක එහෙම්ම තියෙලා
// content තැන විතරක් spinner එකක් පේනවා.
// ============================================================================

export default function AdminLoading() {
  return (
    <div className="flex min-h-[55vh] items-center justify-center" role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <span className="h-9 w-9 rounded-full border-[3px] border-indigo-200 border-t-indigo-600 animate-spin" />
        <span className="text-[12.5px] font-semibold">Loading… · පූරණය වෙමින්…</span>
      </div>
    </div>
  );
}
