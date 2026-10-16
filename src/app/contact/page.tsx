// Contact page — HQ card + inquiry form (FormSubmit → admin settings email)

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ContactInfoCard } from "@/components/contact-info";
import { InquiryForm } from "@/components/site-sections";
import { Suspense } from "react";

export const metadata = { title: "Contact Us | Panduwasnuwara MPCS" };

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ dept?: string }> }) {
  const { dept } = await searchParams;
  return (
    <>
      <SiteHeader />
      <section className="hero-dark text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
          <div className="section-badge !text-amber-300">Contact Us</div>
          <h1 className="mt-3 text-3xl sm:text-5xl font-black">Get in Touch &amp; Official Inquiries</h1>
          <p className="mt-3 text-slate-300 max-w-2xl">
            අපේ ප්‍රධාන කාර්යාල කළමනාකරුවන් හමුවන්න හෝ ඔබේ විමසුම්, ඉල්ලීම් සහ ප්‍රතිපෝෂණ සෘජුව ඉදිරිපත් කරන්න.
          </p>
        </div>
      </section>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
          <ContactInfoCard />
          <Suspense fallback={null}>
            <InquiryForm department={dept} />
          </Suspense>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
