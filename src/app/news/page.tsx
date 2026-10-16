// News & Notices page

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { NewsList } from "@/components/news-client";
import { getNews } from "@/lib/data";

export const metadata = { title: "News & Notices | Panduwasnuwara MPCS" };

export default async function NewsPage() {
  const news = await getNews();
  return (
    <>
      <SiteHeader />
      <section className="hero-dark text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <div className="section-badge !text-amber-300">News & Notices</div>
          <h1 className="mt-3 text-3xl sm:text-5xl font-black">පුවත් හා නිවේදන</h1>
          <p className="mt-3 text-slate-300 max-w-2xl">සමිතියේ නිල නිවේදන, රැකියා අවස්ථා සහ පුවත්.</p>
        </div>
      </section>
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        <NewsList news={news} />
      </section>
      <SiteFooter />
    </>
  );
}
