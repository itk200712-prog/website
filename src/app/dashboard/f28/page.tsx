"use client";

// ============================================================================
// F28 view — authenticate කරපු (active) සාමාජිකයන්ට පමනක්.
//   නැති අයව /dashboard එකට redirect — F28 section එකක් තියෙනවා කියලාවත් පේන්නෑ.
// ============================================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileDown, FileSpreadsheet, Image as ImageIcon } from "lucide-react";
import { authedClient } from "@/lib/supabase/client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

interface F28Item {
  id: string;
  title: string;
  description: string;
  file_url: string;
  created_at: string;
}

export default function F28ViewPage() {
  const r = useRouter();
  const [items, setItems] = useState<F28Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sb = await authedClient();
      const { data: u } = await sb.auth.getUser();
      if (!u?.user) {
        r.replace("/signin");
        return;
      }
      const { data: f28 } = await sb.from("f28_members").select("status").eq("user_id", u.user.id).maybeSingle();
      if (f28?.status !== "active") {
        r.replace("/dashboard"); // ✅ නැති අයට F28 පේන්නෑම නෑ
        return;
      }
      const { data } = await sb.from("f28_items").select("*").order("created_at", { ascending: false });
      setItems((data as unknown as F28Item[]) || []);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <SiteHeader />
      <section className="hero-dark text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="section-badge !text-amber-300">F28</div>
          <h1 className="mt-3 text-3xl sm:text-4xl font-black">F28 — සමිතියේ ගිනුම්</h1>
          <p className="mt-2 text-slate-300 text-[13.5px]">ලාබ අලාබ වාර්තා සහ ගිනුම් තොරතුරු — තෝරාගත් සාමාජිකයන්ට පමනක්.</p>
          <Link href="/dashboard" className="inline-flex items-center gap-2 mt-5 text-amber-300 text-[12.5px] font-bold hover:underline">
            <ArrowLeft size={14} /> Dashboard එකට
          </Link>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {loading ? (
          <p className="text-slate-400 text-[13px] font-semibold py-10 text-center">Loading...</p>
        ) : items.length === 0 ? (
          <div className="card p-12 text-center">
            <FileSpreadsheet size={44} className="mx-auto text-slate-300" />
            <p className="mt-4 font-extrabold text-slate-800 text-lg">F28 තොරතුරු තවම නෑ</p>
            <p className="mt-1.5 text-slate-500 text-[13px]">සමිතියේ නිලධාරීන් තොරතුරු යොදන තුරු රැඳී සිටින්න.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => (
              <div key={it.id} className="card card-hover overflow-hidden">
                {it.file_url ? (
                  /\.(pdf)$/i.test(it.file_url) ? (
                    <a href={it.file_url} target="_blank" rel="noreferrer" className="h-44 bg-slate-800 flex flex-col items-center justify-center text-white/80 hover:bg-slate-700">
                      <FileDown size={38} />
                      <span className="mt-2 text-[12px] font-bold">PDF එක බලන්න / බාගන්න</span>
                    </a>
                  ) : (
                    <a href={it.file_url} target="_blank" rel="noreferrer" className="block h-44 bg-slate-100">
                      <img src={it.file_url} alt={it.title} className="w-full h-full object-cover" />
                    </a>
                  )
                ) : (
                  <div className="h-44 bg-gradient-to-br from-indigo-900 to-slate-800 flex items-center justify-center text-white/30">
                    <ImageIcon size={42} />
                  </div>
                )}
                <div className="p-5">
                  <h3 className="font-extrabold text-slate-900 leading-snug">{it.title}</h3>
                  {it.description && <p className="mt-2 text-[12.5px] text-slate-500 leading-relaxed">{it.description}</p>}
                  <div className="mt-3 text-[11px] text-slate-400">{it.created_at?.slice(0, 10)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <SiteFooter />
    </>
  );
}
