// ============================================================================
// Business detail page — default template + special sections
// ============================================================================

import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  BusinessContacts,
  BusinessHero,
  BusinessServices,
  CoopCityBranches,
  FuelPriceSection,
  FuelLiveStockSection,
  RegionalBranches,
  RuralBankNetwork,
} from "@/components/business-detail";
import { getBusiness, getBusinesses, getFuelPrices } from "@/lib/data";

export const dynamic = "force-dynamic"; //✅ admin එකෙන් branches/contacts දැම්ම ගමන් main site එකේ පේනවා

export async function generateStaticParams() {
  const businesses = await getBusinesses();
  return businesses.map((b) => ({ slug: b.slug }));
}

export default async function BusinessDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await getBusiness(slug);
  if (!b || !b.active) notFound();
  const prices = await getFuelPrices();

  return (
    <>
      <SiteHeader />
      <BusinessHero b={b} />

      {/* Fuel Station — daily prices */}
      {b.special === "fuel-station" && <FuelPriceSection prices={prices} />}
      {b.special === "fuel-station" && <FuelLiveStockSection />}

      <BusinessServices b={b} />

      {/* Rural Bank — 22 branch network */}
      {b.special === "rural-bank" && <RuralBankNetwork b={b} />}

      {/* Consumer — regional branches */}
      {b.special === "consumer" && <RegionalBranches b={b} />}

      {/* Coop City — Coop City / Mini Coop City branches above department contacts */}
      {b.slug === "coop-city" && <CoopCityBranches b={b} />}

      <BusinessContacts b={b} />
      <SiteFooter />
    </>
  );
}
