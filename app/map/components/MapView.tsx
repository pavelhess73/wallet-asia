"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Currency, Expense } from "@/lib/types";
import { BarChart3, List, Map, Search, Loader2, MapPin } from "lucide-react";

// ─── Oprava Leaflet default-icon bugu v Next.js ────────────────────────────────
// Webpack odstraní _getIconUrl z prototypu, musíme ho obnovit ručně.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl:        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:  "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── Barevná tečka místo výchozího markeru ────────────────────────────────────
function createDotIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:14px;height:14px;
      background:${color};
      border:2.5px solid #fff;
      border-radius:50%;
      box-shadow:0 2px 6px rgba(0,0,0,.4);
    "></div>`,
    iconSize:    [14, 14],
    iconAnchor:  [7, 7],
    popupAnchor: [0, -12],
  });
}

const CATEGORY_COLORS: Record<string, string> = {
  transportation: "#f97316",
  restaurants:    "#f43f5e",
  drinks:         "#a855f7",
  coffee:         "#92400e",
  groceries:      "#10b981",
  accommodation:  "#3b82f6",
  flights:        "#0ea5e9",
};

function getCategoryColor(cat: string): string {
  const n = (cat || "").toLowerCase();
  if (n.includes("transport") || n.includes("doprav") || n.includes("taxi") || n.includes("grab"))
    return CATEGORY_COLORS.transportation;
  if (n.includes("restaurant") || n.includes("gastro") || n.includes("jídlo") || n.includes("jidlo"))
    return CATEGORY_COLORS.restaurants;
  if (n.includes("drink") || n.includes("pivo") || n.includes("bar") || n.includes("alkohol"))
    return CATEGORY_COLORS.drinks;
  if (n.includes("coffee") || n.includes("káv") || n.includes("kav") || n.includes("cafe"))
    return CATEGORY_COLORS.coffee;
  if (n.includes("grocer") || n.includes("nákup") || n.includes("nakup") || n.includes("market"))
    return CATEGORY_COLORS.groceries;
  if (n.includes("accommodat") || n.includes("ubytov") || n.includes("hotel") || n.includes("hostel"))
    return CATEGORY_COLORS.accommodation;
  if (n.includes("flight") || n.includes("letenk"))
    return CATEGORY_COLORS.flights;
  return "#64748b";
}

const fmt = (v: number) =>
  new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(v);

// ─── Komponenta ───────────────────────────────────────────────────────────────
export default function MapView() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "expenses"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setExpenses(
          snap.docs.map((d) => {
            const r = d.data();
            return {
              id: d.id,
              amountOriginal: Number(r.amountOriginal) || 0,
              currency: (r.currency as Currency) || "CZK",
              amountCZK: Number(r.amountCZK) || 0,
              category: r.category || "Ostatní",
              note: r.note || "",
              merchant: r.merchant || undefined,
              createdAt: r.createdAt || new Date().toISOString(),
              location:
                r.location?.lat != null && r.location?.lng != null
                  ? { lat: Number(r.location.lat), lng: Number(r.location.lng) }
                  : undefined,
            };
          })
        );
        setIsLoading(false);
      },
      () => setIsLoading(false)
    );
    return () => unsub();
  }, []);

  const mapped = expenses.filter((e) => e.location);

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F6F4]">
      {/* Záhlaví */}
      <header className="max-w-md mx-auto w-full px-4 pt-6 pb-3 flex items-center justify-between sm:max-w-lg">
        <div>
          <p className="text-xs font-bold tracking-wider uppercase text-rose-500 flex items-center gap-1.5">
            <span>🌏</span>
            <span>Cestovní Peněženka</span>
          </p>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-0.5">
            Mapa výdajů
          </h1>
        </div>
        {!isLoading && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            {mapped.length} bodů
          </span>
        )}
      </header>

      {/* ── MAPA (fixní výška 450px) ── */}
      <div className="max-w-md mx-auto w-full px-4 sm:max-w-lg">
        <div className="w-full h-[450px] rounded-2xl overflow-hidden shadow-sm border border-slate-100">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center bg-slate-50">
              <Loader2 className="h-7 w-7 animate-spin text-rose-500" />
            </div>
          ) : mapped.length === 0 ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-slate-50 text-slate-400 p-6 text-center">
              <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center">
                <MapPin className="h-7 w-7" />
              </div>
              <p className="text-sm font-bold text-slate-700">Žádné polohy k zobrazení</p>
              <p className="text-xs max-w-xs">
                Výdaje uložené s GPS souřadnicemi se zobrazí zde. Ujisti se, že má
                aplikace povolení pro přístup k poloze.
              </p>
            </div>
          ) : (
            <MapContainer
              center={[13.75, 100.5]}
              zoom={5}
              scrollWheelZoom
              style={{ width: "100%", height: "100%" }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {mapped.map((exp) => (
                <Marker
                  key={exp.id}
                  position={[exp.location!.lat, exp.location!.lng]}
                  icon={createDotIcon(getCategoryColor(exp.category))}
                >
                  <Popup>
                    <div style={{ minWidth: 150 }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 13, lineHeight: 1.4 }}>
                        {exp.note}
                      </p>
                      {exp.merchant && (
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>
                          {exp.merchant}
                        </p>
                      )}
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: "#94a3b8" }}>
                        {exp.category}
                      </p>
                      <p style={{ margin: "8px 0 0", fontSize: 17, fontWeight: 900, color: "#e11d48" }}>
                        {fmt(exp.amountCZK)}{" "}
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#fb7185" }}>Kč</span>
                      </p>
                      {exp.currency !== "CZK" && (
                        <p style={{ margin: "2px 0 0", fontSize: 10, color: "#94a3b8" }}>
                          {fmt(exp.amountOriginal)} {exp.currency}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>
      </div>

      {/* Legenda */}
      {mapped.length > 0 && (
        <div className="max-w-md mx-auto w-full px-4 mt-4 sm:max-w-lg">
          <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
              Legenda
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
                <div key={cat} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ background: color }}
                  />
                  <span className="text-[11px] text-slate-600 capitalize">{cat}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-slate-400" />
                <span className="text-[11px] text-slate-600">Ostatní</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Spodní navigační lišta */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-t border-slate-200/80">
        <div className="max-w-md mx-auto flex items-center justify-around py-2 sm:max-w-lg">
          <Link
            href="/"
            className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
          >
            <List className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Entries</span>
          </Link>
          <Link
            href="/stats"
            className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
          >
            <BarChart3 className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Stats</span>
          </Link>
          <Link
            href="/map"
            className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-rose-500"
            aria-current="page"
          >
            <Map className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Map</span>
          </Link>
          <Link
            href="/?tab=search"
            className="flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-xl text-slate-400 hover:text-slate-700 transition-colors"
          >
            <Search className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Search</span>
          </Link>
        </div>
      </nav>

      <div className="h-20" />
    </div>
  );
}
