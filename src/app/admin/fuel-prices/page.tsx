"use client";

// ============================================================================
// Fuel Price Management — petrol 92 / super diesel / kerosene
// + Enter Live Stock (save / edit / delete) + call number setting
// ============================================================================

import { useEffect, useState } from "react";
import { Check, Fuel, ListOrdered, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { AdminTopbar, dbDelete, dbInsert, dbUpdate, useNotice } from "@/components/admin";
import { authedClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { FUEL_PRICES } from "@/lib/seed";

type StockRow = { id: string; fuel_type: string; amount: number | string; note?: string; created_at?: string; updated_at?: string };

const TYPE_LABEL: Record<string, string> = {
  petrol92: "Petrol 92 / ඔක්ටේන් 92",
  super_diesel: "Super Diesel / සුපර් ඩීසල්",
  kerosene: "Kerosene / භූමිතෙල්",
};

export default function AdminFuelPricesPage() {
  const { show, node } = useNotice();
  const [prices, setPrices] = useState(() =>
    Object.fromEntries(FUEL_PRICES.map((f) => [f.type, String(f.price)]))
  );
  const [stock, setStock] = useState<Record<string, string>>({ petrol92: "", super_diesel: "", kerosene: "" });
  const [note, setNote] = useState("");
  const [rows, setRows] = useState<StockRow[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editAmt, setEditAmt] = useState("");

  useEffect(() => {
    (async () => {
      if (!isSupabaseConfigured()) return;
      try {
        const sb = await authedClient();
        const { data } = await sb.from("fuel_prices").select("*");
        if (data && data.length) {
          setPrices((p) => {
            const next = { ...p };
            for (const r of data as { type: string; price: number | string }[]) {
              if (r.type in next) next[r.type] = String(r.price ?? next[r.type]);
            }
            return next;
          });
        }
        const { data: st } = await sb.from("fuel_stock").select("*").order("created_at", { ascending: false }).limit(100);
        setRows((st as StockRow[]) ?? []);
      } catch { /* ignore */ }
    })();
  }, []);

  const lastUpdate = rows.reduce((acc, r) => {
    const t = new Date(r.updated_at || r.created_at || 0).getTime();
    return t > acc ? t : acc;
  }, 0);

  async function saveStock() {
    const filled = FUEL_PRICES.filter((f) => stock[f.type] !== "");
    if (!filled.length) return show("⚠ අවම වශයෙන් තෙල් වර්ගයක ලීටර් ගණනක් දාන්න");
    let err: string | null = null;
    for (const f of filled) {
      err = (await dbInsert("fuel_stock", { fuel_type: f.type, amount: Number(stock[f.type]), note })) ?? err;
    }
    if (err) return show(`⚠ ${err}`);
    const sb = await authedClient();
    const { data: st } = await sb.from("fuel_stock").select("*").order("created_at", { ascending: false }).limit(100);
    setRows((st as StockRow[]) ?? []);
    setStock({ petrol92: "", super_diesel: "", kerosene: "" });
    setNote("");
    show("✅ Live stock saved — Fuel Station page එකේ F28 members ලට පේනවා");
  }

  async function saveEdit(id: string) {
    const err = await dbUpdate("fuel_stock", { id }, { amount: Number(editAmt), updated_at: new Date().toISOString() });
    if (err) return show(`⚠ ${err}`);
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, amount: Number(editAmt), updated_at: new Date().toISOString() } : r)));
    setEditId(null);
    show("✅ Updated — 24-hour clock එකත් අලුත් වුණා");
  }

  async function remove(id: string) {
    if (!confirm("මේ live stock entry එක delete කරන්නද?")) return;
    const err = await dbDelete("fuel_stock", { id });
    if (err) return show(`⚠ ${err}`);
    setRows((rs) => rs.filter((r) => r.id !== id));
    show("✅ Deleted");
  }

  return (
    <div>
      <AdminTopbar title="Fuel Price Management" sub="Fuel prices and live stock entries — F28 members ලට පෙනෙන දත්ත" />
      {node}

      {/* ---------------- prices ---------------- */}
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
            Last stock update: {lastUpdate ? new Date(lastUpdate).toLocaleString() : "—"}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-3 mt-7">
          {FUEL_PRICES.map((f) => (
            <div key={f.type} className="rounded-2xl border-2 p-6" style={{ borderColor: f.color + "55" }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-slate-900">{f.name_en}</div>
                  <div className="text-slate-500 text-[11.5px]">{f.name_en} / {f.name_si}</div>
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
            <RefreshCw size={15} /> Reset
          </button>
        </div>
      </div>

      {/* ---------------- live stock ---------------- */}
      <div className="card p-7 max-w-5xl mt-6">
        <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
          <ListOrdered size={20} className="text-indigo-700" /> Enter Live Stock (තෙල් වර්ග තුන වෙන වෙනම)
        </h2>
        <p className="text-slate-500 text-[12px] mt-1">
          දැනට තියෙන ලීටර් ගණන දාන්න — save කරාම F28 members ලට Fuel Station page එකේ Live Stock &amp; Value විදියට පේනවා.
        </p>

        <div className="grid gap-4 sm:grid-cols-3 mt-5">
          {FUEL_PRICES.map((f) => (
            <div key={f.type} className="rounded-2xl border border-slate-200 p-4">
              <label className="field-label">{TYPE_LABEL[f.type]}</label>
              <div className="flex items-center gap-2 mt-1.5">
                <input
                  className="field tabular-nums"
                  inputMode="decimal"
                  placeholder="ලීටර් ගණන (amount)"
                  value={stock[f.type]}
                  onChange={(e) => setStock((s) => ({ ...s, [f.type]: e.target.value }))}
                />
                <span className="text-[11px] font-bold text-slate-400">L</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <input className="field !w-auto flex-1 min-w-[220px]" placeholder="සටහනක් (note — විකල්ප)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn btn-primary" onClick={saveStock}>
            <Plus size={16} /> Save Live Stock
          </button>
        </div>

        {/* entries */}
        <div className="mt-6">
          <div className="text-[12px] font-bold text-slate-700 flex items-center gap-2">
            <ListOrdered size={14} /> Recent Live Stock Entries ({rows.length})
          </div>
          <div className="mt-3 space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {rows.length === 0 && <div className="text-slate-400 text-[12px] py-4 text-center">තාම entries නෑ — උඩින් ලීටර් ගණන් දාලා Save කරන්න</div>}
            {rows.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-2.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: FUEL_PRICES.find((f) => f.type === r.fuel_type)?.color ?? "#94a3b8" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-bold text-slate-900">
                    {TYPE_LABEL[r.fuel_type] ?? r.fuel_type} — <span className="tabular-nums">{Number(r.amount).toLocaleString()} L</span>
                  </div>
                  <div className="text-[10.5px] text-slate-400">
                    {new Date(r.updated_at || r.created_at || Date.now()).toLocaleString()} {r.note ? `· ${r.note}` : ""}
                  </div>
                </div>
                {editId === r.id ? (
                  <div className="flex items-center gap-1.5">
                    <input className="field !w-24 !py-1 text-[12px]" value={editAmt} onChange={(e) => setEditAmt(e.target.value)} />
                    <button className="btn btn-primary !py-1 !px-2.5 !text-[11px]" onClick={() => saveEdit(r.id)}><Check size={12} /></button>
                    <button className="btn btn-outline !py-1 !px-2.5 !text-[11px]" onClick={() => setEditId(null)}><X size={12} /></button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button className="btn btn-outline !py-1 !px-2.5 !text-[11px]" onClick={() => { setEditId(r.id); setEditAmt(String(r.amount)); }}>
                      <Pencil size={12} /> Edit
                    </button>
                    <button className="btn btn-outline !py-1 !px-2.5 !text-[11px] !text-rose-600" onClick={() => remove(r.id)}>
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
