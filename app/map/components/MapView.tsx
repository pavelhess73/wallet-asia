"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import Link from "next/link";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Currency, Expense } from "@/lib/types";
import {
  BarChart3,
  List,
  Map,
  Search,
  Loader2,
  MapPin,
} from "lucide-react";

// ─── Oprava výchozích ikon Leafletu v Next.js (webpack tree-shaking) ──────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Barevná tečka jako custom ikona markeru
function createDotIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width:14px;height:14px;
      background:${color};
      border:2.5px solid #fff;
      border-radius:50%;
      box-shadow:0 1px 6px rgba(0,0,0,.35);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });
}

const CATEGORY_COLORS: Record<string, string> = {
  transportation: "#f97316",
  restaurants: "#f43f5e",
  drinks: "#a855f7",
  coffee: "#92400e",
  groceries: "#10b981",
  accommodation: "#3b82f6",
  flights: "#0ea5e9",
};

function getCategoryColor(cat: string): string {
  const norm = (cat || "").toLowerCase();
  if (norm.includes("transport") || norm.includes("doprav") || norm.includes("taxi"))
    return CATEGORY_COLORS.transportation;
  if (norm.includes("restaurant") || norm.includes("gastro") || norm.includes("jidlo") || norm.includes("jídlo"))
    return CATEGORY_COLORS.restaurants;
  if (norm.includes("drink") || norm.includes("pivo") || norm.includes("bar"))
    return CATEGORY_COLORS.drinks;
  if (norm.includes("coffee") || norm.includes("kav") || norm.includes("kav") || norm.includes("cafe"))
    return CATEGORY_COLORS.coffee;
  if (norm.includes("grocer") || norm.includes("nakup") || norm.includes("market"))
    return CATEGORY_COLORS.groceries;
  if (norm.includes("accommodat") || norm.includes("ubytov") || norm.includes("hotel"))
    return CATEGORY_COLORS.accommodation;
  if (norm.includes("flight") || norm.includes("letenk"))
    return CATEGORY_COLORS.flights;
  return "#64748b";
}

const formatCZK = (val: number) =>
  new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(val);

// ─── Hlavní komponenta ────────────────────────────────────────────────────────
export default function MapView() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "expenses"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const data: Expense[] = snap.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            amountOriginal: Number(raw.amountOriginal) || 0,
            currency: (raw.currency as Currency) || "CZK",
            amountCZK: Number(raw.amountCZK) || 0,
            category: raw.category || "Ostatní",
            note: raw.note || "",
            merchant: raw.merchant || undefined,
            createdAt: raw.createdAt || new Date().toISOString(),
            location:
              raw.location?.lat != null && raw.location?.lng != null
                ? { lat: Number(raw.location.lat), lng: Number(raw.location.lng) }
                : undefined,
          };
        });
        setExpenses(data);
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

      {/* Mapa */}
      <div
        className="flex-1 relative mx-4 mb-4 rounded-2xl overflow-hidden shadow-sm border border-slate-200"
        style={{ minHeight: "60vh" }}
      >
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
            <Loader2 className="h-7 w-7 animate-spin text-rose-500" />
          </div>
        ) : mapped.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-50 text-slate-400 p-6 text-center">
            <div className="h-14 w-14 rounded-full bg-slate-100 flex items-center justify-center">
              <MapPin className="h-7 w-7" />
            </div>
            <p className="text-sm font-bold text-slate-700">Žádné polohy k zobrazení</p>
            <p className="text-xs max-w-xs">
              Výdaje uložené s GPS souřadnicemi se zobrazí zde. Ujisti se, že má aplikace povolení pro přístup k poloze.
            </p>
          </div>
        ) : (
          <MapContainer
            center={[13.75, 100.5]}
            zoom={5}
            style={{ height: "100%", width: "100%", minHeight: "60vh" }}
            scrollWheelZoom
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
                  <div style={{ minWidth: 140 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, lineHeight: 1.3, margin: 0 }}>
                      {exp.note}
                    </p>
                    {exp.merchant && (
                      <p style={{ fontSize: 11, color: "#64748b", margin: "2px 0 0" }}>
                        {exp.merchant}
                      </p>
                    )}
                    <p style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0 0" }}>
                      {exp.category}
                    </p>
                    <p style={{ fontSize: 16, fontWeight: 900, color: "#e11d48", margin: "6px 0 0" }}>
                      {formatCZK(exp.amountCZK)}{" "}
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#fb7185" }}>Kč</span>
                    </p>
                    {exp.currency !== "CZK" && (
                      <p style={{ fontSize: 10, color: "#94a3b8", margin: "2px 0 0" }}>
                        {formatCZK(exp.amountOriginal)} {exp.currency}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>

      {/* Legenda kategorií */}
      {mapped.length > 0 && (
        <div className="max-w-md mx-auto w-full px-4 pb-3 sm:max-w-lg">
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
