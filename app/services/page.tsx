"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ServiceEntry,
  SERVICE_CATEGORIES,
  SERVICE_CATEGORY_DEFS,
  CURRENCIES,
} from "@/lib/types";
import {
  fetchExchangeRates,
  convertAmount,
  DEFAULT_EXCHANGE_RATES,
  ExchangeRates,
} from "@/lib/rates";
import {
  Plus,
  X,
  Loader2,
  ReceiptText,
  BarChart3,
  BookOpen,
  Search,
  Pencil,
  Trash2,
  MapPin,
  Star,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Coins,
  Calendar,
} from "lucide-react";

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("cs-CZ", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function getCatDef(category: string) {
  return (
    SERVICE_CATEGORY_DEFS[category as keyof typeof SERVICE_CATEGORY_DEFS] ??
    SERVICE_CATEGORY_DEFS["Jiné"]
  );
}

// ─── Star rating component ───────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
  readonly = false,
  size = "md",
}: {
  value: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: "sm" | "md";
}) {
  const [hovered, setHovered] = useState(0);
  const sz = size === "sm" ? "h-4 w-4" : "h-6 w-6";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = (hovered || value) >= star;
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(0)}
            onClick={() => onChange?.(star)}
            className={`transition-transform ${readonly ? "cursor-default" : "cursor-pointer hover:scale-110 active:scale-95"}`}
            aria-label={`${star} hvezdicky`}
          >
            <Star
              className={`${sz} transition-colors ${filled ? "fill-amber-400 text-amber-400" : "fill-none text-slate-300"}`}
            />
          </button>
        );
      })}
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-5 py-12 px-6">
      <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-rose-100 to-pink-100 flex items-center justify-center shadow-inner text-4xl select-none">
        💆
      </div>
      <div>
        <h2 className="text-lg font-black text-slate-900">Zatim zadne zaznamy</h2>
        <p className="text-xs text-slate-500 mt-1.5 max-w-xs leading-relaxed">
          Pridej svou prvni využitou službu — masaz, pradelnu, pujcovnu skutru nebo vylet.
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="px-6 py-2.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white font-bold text-sm shadow-lg shadow-rose-400/30 hover:shadow-rose-400/50 transition-all active:scale-95"
      >
        + Pridat prvni zaznam
      </button>
    </div>
  );
}

// ─── Service Card ─────────────────────────────────────────────────────────────

function ServiceCard({
  entry,
  onEdit,
  onDelete,
  isClient,
}: {
  entry: ServiceEntry;
  onEdit: (e: ServiceEntry) => void;
  onDelete: (id: string) => void;
  isClient: boolean;
}) {
  const cat = getCatDef(entry.category);
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <article className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className={`h-1 w-full ${cat.bgColor}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <span className={`shrink-0 h-10 w-10 rounded-xl flex items-center justify-center text-xl ${cat.bgColor} border ${cat.borderColor}`}>
              {cat.emoji}
            </span>
            <div className="min-w-0">
              <h3 className="font-black text-slate-900 text-sm leading-tight truncate">{entry.name}</h3>
              <div className="flex items-center gap-1 mt-0.5 text-slate-400 text-[11px]">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{entry.location}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => onEdit(entry)} className="h-7 w-7 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition-colors" aria-label="Upravit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => onDelete(entry.id)} className="h-7 px-2 rounded-full bg-red-500 text-white text-[10px] font-bold">Smazat</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="h-7 w-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center"><X className="h-3.5 w-3.5" /></button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="h-7 w-7 rounded-full bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors" aria-label="Smazat">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${cat.bgColor} ${cat.color} ${cat.borderColor}`}>
            {cat.emoji} {entry.category}
          </span>
          <StarRating value={entry.rating} readonly size="sm" />
        </div>

        {entry.items.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {entry.items.map((item, i) => (
              <li key={i} className="px-2 py-0.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 font-medium">{item}</li>
            ))}
          </ul>
        )}

        {entry.note && (
          <p className="mt-2.5 text-[11px] text-slate-500 italic leading-relaxed border-l-2 border-slate-200 pl-2.5">{entry.note}</p>
        )}

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
          <span className="text-sm font-black text-slate-900">{entry.price.toLocaleString("cs-CZ")} {entry.currency}</span>
          {isClient && <span className="text-[11px] text-slate-400">{formatDate(entry.createdAt)}</span>}
        </div>
      </div>
    </article>
  );
}

// ─── Modal Form ───────────────────────────────────────────────────────────────

const DEFAULT_FORM = {
  name: "",
  location: "",
  category: SERVICE_CATEGORIES[0] as string,
  itemsRaw: "",
  price: "",
  currency: "THB",
  rating: 5,
  note: "",
};

type FormState = typeof DEFAULT_FORM;

function ServiceModal({
  initial,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  initial: Partial<FormState> & { id?: string };
  onClose: () => void;
  onSubmit: (data: FormState, id?: string) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM, ...initial, itemsRaw: initial.itemsRaw ?? "" });
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => nameRef.current?.focus(), 80); }, []);
  const set = (field: keyof FormState, value: string | number) => setForm((f) => ({ ...f, [field]: value }));
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); await onSubmit(form, initial.id); };
  const isEdit = Boolean(initial.id);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/40 backdrop-blur-[2px] p-0 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 flex flex-col animate-in slide-in-from-bottom-5 max-h-[92vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-black text-slate-900">{isEdit ? "Upravit zaznam" : "Novy zaznam služby"}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{isEdit ? "Upravte udaje zaznamu" : "Zaznamenej využitou službu na ceste"}</p>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Typ služby</label>
            <div className="grid grid-cols-4 gap-1.5">
              {SERVICE_CATEGORIES.map((cat) => {
                const def = SERVICE_CATEGORY_DEFS[cat];
                const active = form.category === cat;
                return (
                  <button key={cat} type="button" onClick={() => set("category", cat)}
                    className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all text-[11px] font-semibold ${active ? `${def.bgColor} ${def.borderColor} ${def.color}` : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"}`}>
                    <span className="text-lg">{def.emoji}</span>
                    <span className="truncate w-full text-center">{cat}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Nazev *</label>
            <input ref={nameRef} type="text" required placeholder="Napr. Massage World, Laundry Queen…" value={form.name} onChange={(e) => set("name", e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-400 focus:bg-white transition-colors" />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Misto *</label>
            <div className="relative">
              <MapPin className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" required placeholder="Napr. Chiang Mai – Old City" value={form.location} onChange={(e) => set("location", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-400 focus:bg-white transition-colors" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Konkretni polozky <span className="text-slate-400 lowercase font-medium">(kazda na novy radek)</span></label>
            <textarea rows={3} placeholder={"Thajska masaz 1h\nOlejova masaz 90min\nSpropitne"} value={form.itemsRaw} onChange={(e) => set("itemsRaw", e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-400 focus:bg-white transition-colors resize-none leading-relaxed" />
          </div>

          <div className="grid grid-cols-5 gap-2">
            <div className="col-span-3">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Cena *</label>
              <input type="number" required min="0" step="any" placeholder="Napr. 350" value={form.price} onChange={(e) => set("price", e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-base font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-400 focus:bg-white transition-colors" />
            </div>
            <div className="col-span-2">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Mena</label>
              <div className="relative">
                <select value={form.currency} onChange={(e) => set("currency", e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:border-rose-400 focus:bg-white transition-colors pr-7">
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="h-3.5 w-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Spokojenost</label>
            <div className="flex items-center gap-3">
              <StarRating value={form.rating} onChange={(v) => set("rating", v)} />
              <span className="text-sm font-bold text-slate-600">{form.rating}/5</span>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">Poznamka / Heslo / Kontakt <span className="text-slate-400 lowercase font-medium">(volitelne)</span></label>
            <input type="text" placeholder="Napr. heslo k wifi, telefonni cislo, doporuceni…" value={form.note} onChange={(e) => set("note", e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-400 focus:bg-white transition-colors" />
          </div>

          <button type="submit" disabled={isSubmitting}
            className="mt-1 w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 active:scale-[0.99] text-white font-bold text-sm shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50">
            {isSubmitting ? (<><Loader2 className="h-4 w-4 animate-spin" /><span>Ukladam…</span></>) :
              isEdit ? (<><Pencil className="h-4 w-4" /><span>Ulozit zmeny</span></>) :
              (<><Plus className="h-4 w-4 stroke-[2.5]" /><span>Ulozit zaznam</span></>)}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const [entries, setEntries] = useState<ServiceEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<ServiceEntry | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("Vse");
  const [rates, setRates] = useState<ExchangeRates>(DEFAULT_EXCHANGE_RATES);

  useEffect(() => { setIsClient(true); }, []);

  // Nacti aktualni kurzy (s fallbackem na offline keš / default)
  useEffect(() => {
    fetchExchangeRates()
      .then((r) => { if (r) setRates(r); })
      .catch((err) => console.warn("Chyba pri nacitani kurzu:", err));
  }, []);

  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, "services"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q,
      (snap) => {
        const fetched: ServiceEntry[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name ?? "",
            location: data.location ?? "",
            category: data.category ?? "Jine",
            items: Array.isArray(data.items) ? data.items : [],
            price: Number(data.price) || 0,
            currency: data.currency ?? "THB",
            rating: Number(data.rating) || 5,
            note: data.note ?? undefined,
            createdAt: data.createdAt ?? new Date().toISOString(),
          };
        });
        setEntries(fetched);
        setIsLoading(false);
      },
      (err) => { console.error("services listener:", err); setIsLoading(false); }
    );
    return () => unsub();
  }, []);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSubmit = async (form: typeof DEFAULT_FORM, id?: string) => {
    setIsSubmitting(true);
    try {
      const items = form.itemsRaw.split("\n").map((s) => s.trim()).filter(Boolean);
      const payload = {
        name: form.name.trim(),
        location: form.location.trim(),
        category: form.category,
        items,
        price: parseFloat(String(form.price)) || 0,
        currency: form.currency,
        rating: form.rating,
        note: form.note.trim() || null,
        createdAt: id
          ? (entries.find((e) => e.id === id)?.createdAt ?? new Date().toISOString())
          : new Date().toISOString(),
      };
      if (id) { await updateDoc(doc(db, "services", id), payload); showToast("Zaznam upraven"); }
      else { await addDoc(collection(db, "services"), payload); showToast("Zaznam pridan"); }
      setModalOpen(false);
      setEditingEntry(null);
    } catch (err) { console.error(err); showToast("Chyba pri ukladani", "err"); }
    finally { setIsSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    try { await deleteDoc(doc(db, "services", id)); showToast("Smazano"); }
    catch { showToast("Chyba pri mazani", "err"); }
  };

  const openCreate = () => { setEditingEntry(null); setModalOpen(true); };
  const openEdit = (entry: ServiceEntry) => { setEditingEntry(entry); setModalOpen(true); };

  const modalInitial = useMemo<Partial<typeof DEFAULT_FORM> & { id?: string }>(() => {
    if (!editingEntry) return {};
    return {
      id: editingEntry.id,
      name: editingEntry.name,
      location: editingEntry.location,
      category: editingEntry.category,
      itemsRaw: editingEntry.items.join("\n"),
      price: String(editingEntry.price),
      currency: editingEntry.currency,
      rating: editingEntry.rating,
      note: editingEntry.note ?? "",
    };
  }, [editingEntry]);

  const filtered = useMemo(
    () => activeFilter === "Vse" ? entries : entries.filter((e) => e.category === activeFilter),
    [entries, activeFilter]
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = { Vse: entries.length };
    for (const e of entries) { map[e.category] = (map[e.category] ?? 0) + 1; }
    return map;
  }, [entries]);

  // Celkova utrata za všechny zaznamy (prevedena do CZK)
  const totalCZK = useMemo(() =>
    entries.reduce((sum, e) => sum + convertAmount(e.price, e.currency, "CZK", rates), 0),
    [entries, rates]
  );

  // Dnesni utrata – pocita se az po mountu (isClient) kvuli Hydration Error #441
  const todayCZK = useMemo(() => {
    if (!isClient) return 0;
    const now = new Date();
    return entries
      .filter((e) => {
        try {
          const d = new Date(e.createdAt);
          return d.getDate() === now.getDate() &&
            d.getMonth() === now.getMonth() &&
            d.getFullYear() === now.getFullYear();
        } catch { return false; }
      })
      .reduce((sum, e) => sum + convertAmount(e.price, e.currency, "CZK", rates), 0);
  }, [entries, rates, isClient]);

  const formatCZK = (val: number) =>
    new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 }).format(val);

  const pluralZaznamu = (n: number) => n === 1 ? "zaznam" : n < 5 ? "zaznamy" : "zaznamu";

  return (
    <div className="min-h-screen bg-[#F8F6F4] text-slate-800 pb-32">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-full shadow-xl text-sm font-bold text-white animate-in fade-in slide-in-from-top-2 ${toast.type === "ok" ? "bg-emerald-500 shadow-emerald-500/30" : "bg-red-500 shadow-red-500/30"}`}>
            {toast.type === "ok" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            {toast.msg}
          </div>
        </div>
      )}

      <main className="max-w-md mx-auto px-4 pt-6 pb-4 flex flex-col gap-5 sm:max-w-lg">
        <header className="flex items-end justify-between pt-2">
          <div>
            <span className="text-xs font-bold tracking-wider uppercase text-rose-500 flex items-center gap-1.5 mb-1">
              <span>🌏</span><span>Asia Travel Wallet</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">Denik služeb</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isClient ? `${entries.length} ${pluralZaznamu(entries.length)}` : "Nacitam…"}
            </p>
          </div>
          <button type="button" onClick={openCreate}
            className="h-10 w-10 rounded-full bg-gradient-to-br from-rose-500 to-pink-500 text-white shadow-lg shadow-rose-400/30 flex items-center justify-center transition-all hover:shadow-rose-400/50 active:scale-95"
            aria-label="Pridat zaznam">
            <Plus className="h-5 w-5 stroke-[2.5]" />
          </button>
        </header>

        {/* SUMMARY KARTY – Total a Dnes v CZK */}
        <div className="grid grid-cols-2 gap-3">
          {/* Karta: Celkem za služby */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Celkem</span>
              <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                <Coins className="h-3.5 w-3.5" />
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                {formatCZK(totalCZK)}{" "}
                <span className="text-xs font-semibold text-slate-400">Kč</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                {entries.length} {pluralZaznamu(entries.length)}
              </p>
            </div>
          </div>

          {/* Karta: Dnes za služby */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500">Dnes</span>
              <div className="h-7 w-7 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">
                <Calendar className="h-3.5 w-3.5" />
              </div>
            </div>
            <div>
              <div className="text-xl sm:text-2xl font-black text-rose-600 tracking-tight">
                {isClient ? formatCZK(todayCZK) : "–"}{" "}
                <span className="text-xs font-semibold text-rose-400">Kč</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 font-medium">dnesni služby</p>
            </div>
          </div>
        </div>

        {entries.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 py-1">
            {["Vse", ...SERVICE_CATEGORIES].map((cat) => {
              const isAll = cat === "Vse";
              const def = isAll ? null : getCatDef(cat);
              const active = activeFilter === cat;
              const count = counts[cat] ?? 0;
              if (!isAll && count === 0) return null;
              return (
                <button key={cat} type="button" onClick={() => setActiveFilter(cat)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${active ? "bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-400/30" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}>
                  {def && <span>{def.emoji}</span>}
                  {cat}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${active ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"}`}>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-rose-400" />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState onAdd={openCreate} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">
            V kategorii <strong>{activeFilter}</strong> nejsou zadne zaznamy.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((entry) => (
              <ServiceCard key={entry.id} entry={entry} onEdit={openEdit} onDelete={handleDelete} isClient={isClient} />
            ))}
          </div>
        )}
      </main>

      {entries.length > 0 && (
        <div className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-40">
          <button type="button" onClick={openCreate}
            className="h-13 px-5 rounded-full bg-gradient-to-r from-rose-500 via-rose-600 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-xl shadow-rose-500/35 flex items-center gap-2 font-bold text-sm tracking-wide transition-all duration-200 active:scale-95 border border-white/20">
            <Plus className="h-5 w-5 stroke-[2.5]" />
            <span>Novy zaznam</span>
          </button>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg">
        <div className="max-w-md mx-auto sm:max-w-lg px-6 py-2 flex items-center justify-between">
          <Link href="/" className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600 transition-colors">
            <ReceiptText className="h-5 w-5" /><span className="text-[10px]">Entries</span>
          </Link>
          <Link href="/services" className="flex flex-col items-center gap-0.5 text-rose-600 font-bold" aria-current="page">
            <BookOpen className="h-5 w-5" /><span className="text-[10px]">Služby</span>
          </Link>
          <Link href="/stats" className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-rose-600 transition-colors">
            <BarChart3 className="h-5 w-5" /><span className="text-[10px]">Stats</span>
          </Link>
          <Link href="/search" className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-rose-600 transition-colors">
            <Search className="h-5 w-5" /><span className="text-[10px]">Search</span>
          </Link>
        </div>
      </nav>

      {modalOpen && (
        <ServiceModal
          initial={modalInitial}
          onClose={() => { setModalOpen(false); setEditingEntry(null); }}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
