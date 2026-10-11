'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { List, BarChart3, Map, Search } from 'lucide-react';

// Leaflet potřebuje browser API → ssr: false je povinné
const MapView = dynamic(() => import('@/app/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[60vh] rounded-2xl bg-slate-100 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E11D48]" />
    </div>
  ),
});

const LEGEND = [
  { label: "Doprava",     color: "#f97316" },
  { label: "Restaurace",  color: "#f43f5e" },
  { label: "Bar & Drinks",color: "#a855f7" },
  { label: "Káva",        color: "#92400e" },
  { label: "Nákupy",      color: "#10b981" },
  { label: "Ubytování",   color: "#3b82f6" },
  { label: "Lety",        color: "#0ea5e9" },
  { label: "Ostatní",     color: "#64748b" },
];

export default function MapPage() {
  return (
    <div className="flex flex-col min-h-screen bg-[#F8F6F4]">
      {/* Záhlaví */}
      <header className="max-w-md mx-auto w-full px-4 pt-6 pb-3 sm:max-w-lg">
        <p className="text-xs font-bold tracking-wider uppercase text-rose-500 flex items-center gap-1.5">
          <span>🌏</span>
          <span>Cestovní Peněženka</span>
        </p>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 mt-0.5">
          Mapa výdajů
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          GPS polohy zaznamenané při ukládání výdaje
        </p>
      </header>

      {/* Mapa */}
      <div className="max-w-md mx-auto w-full px-4 sm:max-w-lg">
        <MapView />
      </div>

      {/* Legenda */}
      <div className="max-w-md mx-auto w-full px-4 mt-4 sm:max-w-lg">
        <div className="bg-white rounded-2xl px-4 py-3 shadow-sm border border-slate-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Legenda
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {LEGEND.map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ background: color }}
                />
                <span className="text-[11px] text-slate-600">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spodní navigace */}
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
