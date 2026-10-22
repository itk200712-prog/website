// Photo Gallery page — title + description සමඟ (user requirement)

export const dynamic = "force-dynamic"; // ✅ admin දත්ත දැම්ම ගමන් ම ප්‍රධාන site එකේ පේනවා

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { GalleryGrid, GalleryHero } from "@/components/gallery-grid";
import { getGallery } from "@/lib/data";

export const metadata = { title: "Photo Gallery | Panduwasnuwara MPCS" };

export default async function GalleryPage() {
  const items = await getGallery();
  return (
    <>
      <SiteHeader />
      <GalleryHero />
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <GalleryGrid items={items} />
      </section>
      <SiteFooter />
    </>
  );
}
