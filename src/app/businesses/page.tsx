// ============================================================================
// Businesses overview — all divisions
// ============================================================================

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SectionHead } from "@/components/site-sections";
import { BusinessCard } from "@/components/home-client";
import { getBusinesses } from "@/lib/data";

export const metadata = { title: "Businesses | Panduwasnuwara MPCS" };

export default async function BusinessesPage() {
  const businesses = await getBusinesses();
  const publicBusinesses = businesses.filter((b) => b.active);

  return (
    <>
      <SiteHeader />
      <section className="hero-dark text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <div className="section-badge !text-amber-300">Our Business Divisions</div>
          <h1 className="mt-3 text-3xl sm:text-5xl font-black">ව්‍යාපාර අංශ</h1>
          <p className="mt-3 text-slate-300 max-w-2xl">
            සමිතියේ ව්‍යාපාර අංශ {publicBusinesses.length}ක් — එක් වහලක් යටතේ බැංකු, සිල්ලර, නියෝජිතායතන, ඉන්ධන සහ සුභසාධන සේවා.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <SectionHead badge="Business Divisions" title="සියලු ව්‍යාපාර" sub="විස්තර බැලීමට ඒකකය තෝරන්න" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {publicBusinesses.map((b) => (
            <BusinessCard key={b.slug} b={b} />
          ))}
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
