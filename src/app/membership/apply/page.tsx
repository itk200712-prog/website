// Apply for Membership — certified rubber-stamp form

import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ApplyForm } from "@/components/apply-form";

export const metadata = { title: "Apply for Membership | Panduwasnuwara MPCS" };

export default function ApplyPage() {
  return (
    <>
      <SiteHeader />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <ApplyForm />
      </div>
      <SiteFooter />
    </>
  );
}
