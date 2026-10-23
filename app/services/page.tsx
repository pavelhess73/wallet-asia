"use client";

import Link from "next/link";
import {
  ReceiptText,
  BarChart3,
  Search,
  BookOpen,
  Sparkles,
  Clock,
} from "lucide-react";

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-[#F8F6F4] text-slate-800 pb-32">
      <main className="max-w-md mx-auto px-4 pt-6 flex flex-col gap-5 sm:max-w-lg">
        {/* HLAVIČKA */}
        <header className="flex flex-col gap-1 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider uppercase text-rose-500 flex items-center gap-1.5">
              <span>🌏</span>
              <span>Cestovní Deník</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[11px] font-semibold border border-rose-200/60">
              <Sparkles className="h-3 w-3 text-rose-500" />
              Připravujeme
            </span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            Služby & Deník
          </h1>
          <p className="text-xs text-slate-500">
            Záznamy zážitků, rezervací a plánovaných služeb na cestách
          </p>
        </header>

        {/* KARTA S INFORMACÍ O PŘIPRAVOVANÉ FUNKCI */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col items-center text-center gap-4 my-4">
          <div className="h-16 w-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-inner">
            <BookOpen className="h-8 w-8 stroke-[2]" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">
              Deníček služeb na cestě
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 max-w-xs leading-relaxed">
              Zde brzy najdete přehled rezervací hotelů, jízdenek, výletů, sim karet a dalších cestovních služeb spojených s výdaji.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100 text-[11px] text-slate-500 font-medium">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <span>Již brzy k dispozici</span>
          </div>
        </div>
      </main>

      {/* SPODNÍ NAVIGACE */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg">
        <div className="max-w-md mx-auto sm:max-w-lg px-6 py-2 flex items-center justify-between">
          <Link
            href="/"
            className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ReceiptText className="h-5 w-5" />
            <span className="text-[10px]">Entries</span>
          </Link>

          <Link
            href="/services"
            className="flex flex-col items-center gap-0.5 text-rose-600 font-bold"
            aria-current="page"
          >
            <BookOpen className="h-5 w-5" />
            <span className="text-[10px]">Služby</span>
          </Link>

          <Link
            href="/stats"
            className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-rose-600 transition-colors"
          >
            <BarChart3 className="h-5 w-5" />
            <span className="text-[10px]">Stats</span>
          </Link>

          <Link
            href="/search"
            className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-rose-600 transition-colors"
          >
            <Search className="h-5 w-5" />
            <span className="text-[10px]">Search</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
