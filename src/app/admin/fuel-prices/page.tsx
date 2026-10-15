"use client";

// ============================================================================
// Fuel Price Management — petrol 92 / super diesel / kerosene
// ============================================================================

import { useEffect, useState } from "react";
import { Check, Fuel, RefreshCw } from "lucide-react";
import { AdminTopbar, dbUpdate, useNotice } from "@/components/admin";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { FUEL_PRICES } from "@/lib/seed";

export default function AdminFuelPricesPage() {
  const { show, node } = useNotice();
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(FUEL_PRICES.map((f) => [f.type, String(f.price)]))
  );

  // DB එකෙන් saved prices load කරන්න
  useEffect(() => {
    (async () => {
      if (!isSupabaseConfigured()) return;
      try {
        const { data } = await createClient().from("fuel_prices").select("*");
        if (data && data.length) {
          setPrices((p) => {
            const next = { ...p };
            for (const r of data as { type: string; price: number | string }[]) {
              if (r.type in next) next[r.type] = String(r.price ?? next[r.type]);
            }
            return next;
          });
        }
      } catch { /* ignore */ }
    })();
  }, []);

  return (
    <div>
      <AdminTopbar title="Fuel Price Management" sub="Review and manage member records, moderate gallery discussions, and configure communication preferences." />
      {node}

      <div className="card p-7 max-w-5xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <Fuel size={22} className="text-amber-600" /> Today&apos;s Fuel Price Management
            </h2>
            <p className="text-slate-500 text-[12.5px] mt-1">
              Update the official retail price per liter for the three designated fuel categories.
            </p>
          </div>
          <div className="text-[11px] text-slate-400 font-semibold">
            Last updated: {new Date().toLocaleDateString("en-US")}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3 mt-7">
          {FUEL_PRICES.map((f) => (
            <div key={f.type} className="rounded-2xl border-2 p-6" style={{ borderColor: f.color + "55" }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-slate-900">{f.name_en}</div>
                  <div className="text-slate-500 text-[11.5px]">
                    {f.name_en} / {f.name_si}
                  </div>
                </div>
                <span className="badge-amber rounded-full px-2.5 py-1 text-[9.5px] font-bold">LKR / L</span>
              </div>
              <label className="field-label mt-4">Price Per Liter (Rs.)</label>
              <input
                value={prices[f.type]}
                onChange={(e) => setPrices((p) => ({ ...p, [f.type]: e.target.value }))}
                className="field text-lg font-bold tabular-nums"
                inputMode="decimal"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 mt-7">
          <button
            className="btn btn-primary"
            onClick={async () => {
              let err: string | null = null;
              for (const f of FUEL_PRICES) {
                err = (await dbUpdate("fuel_prices", { type: f.type }, { price: Number(prices[f.type]) })) ?? err;
              }
              show(err ? `⚠ ${err}` : "✅ Fuel prices updated — public Fuel Station page එකේ live වේ");
            }}
          >
            <Check size={17} /> Update Fuel Prices
          </button>
          <button
            className="btn btn-outline"
            onClick={() => {
              setPrices(Object.fromEntries(FUEL_PRICES.map((f) => [f.type, String(f.price)])));
              show("Reloaded current prices");
            }}
          >
            <RefreshCw size={15} /> Reload Current
          </button>
        </div>
      </div>
    </div>
  );
}
