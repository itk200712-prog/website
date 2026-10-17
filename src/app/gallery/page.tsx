// Photo Gallery page — title + description සමඟ (user requirement)

export const dynamic = "force-dynamic"; // ✅ admin දත්ත දැම්ම ගමන් ම ප්‍රධාන site එකේ පේනවා

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { GalleryGrid } from "@/components/gallery-grid";
import { getGallery } from "@/lib/data";

export const metadata = { title: "Photo Gallery | Panduwasnuwara MPCS" };

export default async function GalleryPage() {
  const items = await getGallery();
  return (
    <>
      <SiteHeader />
      <section className="hero-dark text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <div className="section-badge !text-amber-300">Photo Gallery</div>
          <h1 className="mt-3 text-3xl sm:text-5xl font-black">ඡායාරූප ගැලරිය</h1>
          <p className="mt-3 text-slate-300 max-w-2xl">සමිතියේ වැඩසටහන් සහ අවස්ථා ඡායාරූප — Photo Gallery</p>
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <GalleryGrid items={items} />
      </section>
      <SiteFooter />
    </>
  );
}
