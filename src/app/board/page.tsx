// ============================================================================
// Board of Directors page
// ============================================================================

export const dynamic = "force-dynamic"; // ✅ admin දත්ත දැම්ම ගමන් ම ප්‍රධාන site එකේ පේනවා

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { SectionHead, PersonCard } from "@/components/site-sections";
import { BoardGroups } from "@/components/board-groups";
import { getBoard } from "@/lib/data";

export const metadata = { title: "Board of Directors | Panduwasnuwara MPCS" };

export default async function BoardPage() {
  const board = await getBoard();
  return (
    <>
      <SiteHeader />
      <section className="hero-dark text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <div className="section-badge !text-amber-300">Leadership</div>
          <h1 className="mt-3 text-3xl sm:text-5xl font-black">අධ්‍යක්ෂ මණ්ඩලය</h1>
          <p className="mt-3 text-slate-300 max-w-2xl">
            පඳුවස්නුවර නව බහු අරමුණු සමූපකාර සමිතියේ නායකත්ව කණ්ඩායම — Board of Directors
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
        <SectionHead badge="Board of Directors" title="සියලු නිලධාරීන්" sub="සභාපති, උප සභාපති, අධ්‍යක්ෂවරුන් සහ පරිපාලන නිලධාරීන්" />
        <BoardGroups board={board} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 mt-8">
          {board.map((p) => (
            // ✅ id (DB primary key) — order/name duplicate වුණත් key එක unique
            <PersonCard key={p.id ?? `${p.order}-${p.name_en}`} person={p} />
          ))}
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
