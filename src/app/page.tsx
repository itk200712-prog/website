// ============================================================================
//  Home — reference site (alpha) එකේ පිළිවෙලට සකසන ලද පිටුව
//  /si · /en routes සමඟ bilingual (HomeSections client component එක තුළ)
// ============================================================================

export const dynamic = "force-dynamic"; // ✅ admin දත්ත දැම්ම ගමන් ම ප්‍රධාන site එකේ පේනවා

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HomeSections } from "@/components/home-sections";
import { getBoard, getBusinesses, getGallery, getNews, getSettings } from "@/lib/data";

export default async function HomePage() {
  const [businesses, news, board, settings, gallery] = await Promise.all([
    getBusinesses(),
    getNews(),
    getBoard(),
    getSettings(),
    getGallery(),
  ]);
  const publicBusinesses = businesses.filter((b) => b.active);

  return (
    <>
      <SiteHeader />
      <HomeSections
        businesses={publicBusinesses}
        news={news}
        board={board}
        settings={settings}
        gallery={gallery}
      />
      <SiteFooter />
    </>
  );
}
