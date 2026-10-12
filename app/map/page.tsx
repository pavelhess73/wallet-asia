'use client';

import { MapPin, ListFilter, BarChart3, Search, Route } from 'lucide-react';
import Link from 'next/link';

const ROUTE = [
  { flag: '🇹🇭', name: 'Thajsko', color: 'bg-orange-100 text-orange-600' },
  { flag: '🇱🇦', name: 'Laos',    color: 'bg-red-100 text-red-600' },
  { flag: '🇻🇳', name: 'Vietnam', color: 'bg-rose-100 text-rose-600' },
];

export default function MapPage() {
  return (
    <div className="min-h-screen bg-[#F8F6F4]">
      <main className="max-w-md mx-auto px-4 pt-6 pb-32 sm:max-w-lg">
        {/* Záhlaví */}
        <header className="flex flex-col gap-1 pt-2 mb-5">
          <span className="text-xs font-bold tracking-wider uppercase text-rose-500 flex items-center gap-1.5">
            <span>🌏</span>
            <span>Cestovní Mapa</span>
          </span>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Lokace Výdajů
          </h1>
          <p className="text-xs text-slate-500">
            Interaktivní přehled míst zaznamenání výdajů
          </p>
        </header>

        {/* Karta: Cestovní trasa & Lokace */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-7 w-7 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
              <Route className="h-3.5 w-3.5 text-rose-500" />
            </div>
            <p className="text-sm font-bold text-slate-800">Cestovní trasa & Lokace</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {ROUTE.map((stop, i) => (
              <div key={stop.name} className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${stop.color}`}
                >
                  <span>{stop.flag}</span>
                  <span>{stop.name}</span>
                </span>
                {i < ROUTE.length - 1 && (
                  <span className="text-slate-300 text-sm font-bold">→</span>
                )}
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2.5 flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            Výdaje s GPS souřadnicemi se zobrazí jako body na mapě
          </p>
        </div>

        {/* Mapa Jihovýchodní Asie */}
        <div className="w-full h-[450px] rounded-2xl overflow-hidden shadow-sm border border-slate-200/80 my-4">
          <iframe
            title="Cestovní Mapa Asie"
            width="100%"
            height="100%"
            frameBorder="0"
            scrolling="no"
            src="https://www.openstreetmap.org/export/embed.html?bbox=97.0%2C5.0%2C109.0%2C22.0&amp;layer=mapnik"
          />
        </div>

        {/* Info karta – GPS */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-start gap-3">
          <div className="h-9 w-9 rounded-full bg-rose-50 flex items-center justify-center shrink-0 mt-0.5">
            <MapPin className="h-4 w-4 text-rose-500" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">GPS trasování výdajů</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Výdaje se automaticky ukládají s GPS polohou při zadání. Povolte přístup k poloze v prohlížeči pro aktivaci funkce.
            </p>
          </div>
        </div>
      </main>

      {/* Spodní navigace */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200/60 py-2.5 px-6 flex justify-around items-center z-50">
        <Link href="/" className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600 transition-colors">
          <ListFilter className="w-5 h-5" />
          <span className="text-[10px] font-medium">Entries</span>
        </Link>
        <Link href="/stats" className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600 transition-colors">
          <BarChart3 className="w-5 h-5" />
          <span className="text-[10px] font-medium">Stats</span>
        </Link>
        <Link href="/map" className="flex flex-col items-center gap-0.5 text-[#E11D48] font-bold" aria-current="page">
          <MapPin className="w-5 h-5" />
          <span className="text-[10px]">Map</span>
        </Link>
        <Link href="/search" className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600 transition-colors">
          <Search className="w-5 h-5" />
          <span className="text-[10px] font-medium">Search</span>
        </Link>
      </nav>
    </div>
  );
}
