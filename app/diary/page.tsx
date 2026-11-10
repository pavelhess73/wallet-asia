"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  DiaryEntry,
  DiaryCategory,
  DIARY_CATEGORY_CONFIGS,
  Expense,
} from "@/lib/types";
import {
  subscribeToDiaryEntries,
  addDiaryEntry,
  updateDiaryEntry,
  deleteDiaryEntry,
} from "@/lib/diaryService";
import { formatCZK, formatCurrency } from "@/lib/formatters";
import { compressImage } from "@/lib/imageUtils";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Clock,
  MapPin,
  Star,
  ReceiptText,
  BookOpen,
  BarChart3,
  Search,
  BookText,
  Coins,
  CheckCircle2,
  AlertCircle,
  Calendar,
  X,
  Loader2,
  ArrowUpDown,
  Camera,
  Maximize2,
} from "lucide-react";

// ─── Pomocná funkce pro bezpečné formátování data (bez posunu časových pásem) ─
function formatDiaryDateCzech(dateStr: string): string {
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return new Intl.DateTimeFormat("cs-CZ", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
      })
        .format(d)
        .replace(/[\u00A0\u202F]/g, " ");
    }
  } catch {
    // fallback níže
  }
  return dateStr;
}

// ─── Extrakce YYYY-MM-DD z libovolného createdAt řetězce výdaje ─────────────
function extractDateKey(createdAt: string): string {
  if (!createdAt) return "";
  if (createdAt.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(createdAt)) {
    return createdAt.slice(0, 10);
  }
  try {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch {
    // fallback
  }
  return createdAt.slice(0, 10);
}

// ─── Komponenta hvězdičkového hodnocení ──────────────────────────────────────
function StarRating({
  value,
  onChange,
  readonly = false,
  size = "md",
}: {
  value?: number;
  onChange?: (v: number) => void;
  readonly?: boolean;
  size?: "sm" | "md";
}) {
  const [hovered, setHovered] = useState(0);
  const sz = size === "sm" ? "h-3.5 w-3.5" : "h-5 w-5";
  const current = hovered || value || 0;

  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = current >= star;
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => onChange?.(star === value ? 0 : star)}
            onMouseEnter={() => !readonly && setHovered(star)}
            onMouseLeave={() => !readonly && setHovered(0)}
            className={`${
              readonly ? "cursor-default" : "cursor-pointer transition-transform hover:scale-110"
            } p-0.5`}
            title={readonly ? `${value || 0} / 5` : `Hodnotit ${star} / 5`}
          >
            <Star
              className={`${sz} ${
                filled
                  ? "fill-amber-400 text-amber-400"
                  : "fill-transparent text-slate-300"
              }`}
            />
          </button>
        );
      })}
      {value !== undefined && value > 0 && (
        <span className="text-[11px] font-semibold text-amber-600 ml-1">
          {value}/5
        </span>
      )}
    </div>
  );
}

// ─── Modální formulář pro přidání a úpravu záznamu ───────────────────────────
interface DiaryModalProps {
  initial?: DiaryEntry | null;
  onClose: () => void;
  onSubmit: (data: Omit<DiaryEntry, "id">) => Promise<void>;
  isSubmitting: boolean;
}

function DiaryEntryModal({
  initial,
  onClose,
  onSubmit,
  isSubmitting,
}: DiaryModalProps) {
  const isEditing = Boolean(initial?.id);

  const [date, setDate] = useState<string>(
    initial?.date || new Date().toISOString().split("T")[0]
  );
  const [time, setTime] = useState<string>(
    initial?.time ||
      new Intl.DateTimeFormat("cs-CZ", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date())
  );
  const [dayNumber, setDayNumber] = useState<string>(
    initial?.dayNumber !== undefined ? String(initial.dayNumber) : ""
  );
  const [location, setLocation] = useState<string>(initial?.location || "");
  const [category, setCategory] = useState<DiaryCategory>(
    initial?.category || "note"
  );
  const [title, setTitle] = useState<string>(initial?.title || "");
  const [text, setText] = useState<string>(initial?.text || "");
  const [rating, setRating] = useState<number>(initial?.rating || 0);
  const [photoBase64, setPhotoBase64] = useState<string | undefined>(
    initial?.photoBase64
  );
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressing(true);
    setFormError(null);
    try {
      const compressed = await compressImage(file, 800, 0.65);
      setPhotoBase64(compressed);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err: any) {
      console.error("Chyba při kompresi fotografie:", err);
      setFormError("Nepodařilo se zpracovat fotografii: " + (err.message || "neznámá chyba"));
    } finally {
      setIsCompressing(false);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoBase64(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError("Zadejte prosím název / titulek záznamu.");
      return;
    }
    if (!date) {
      setFormError("Vyberte prosím datum.");
      return;
    }
    if (!location.trim()) {
      setFormError("Zadejte prosím město nebo lokaci.");
      return;
    }

    setFormError(null);

    const payload: Omit<DiaryEntry, "id"> = {
      date,
      time: time.trim() || undefined,
      dayNumber: dayNumber ? parseInt(dayNumber, 10) : undefined,
      location: location.trim(),
      category,
      title: title.trim(),
      text: text.trim() || undefined,
      rating: rating > 0 ? rating : undefined,
      photoBase64: photoBase64 || undefined,
      expenseId: initial?.expenseId,
      cost: initial?.cost,
      createdAt: initial?.createdAt || new Date().toISOString(),
    };

    await onSubmit(payload);
  };

  const categoriesList: {
    id: DiaryCategory;
    label: string;
    emoji: string;
    desc: string;
  }[] = [
    { id: "transport", label: "Doprava", emoji: "🛵", desc: "Skútr, vlak, taxi, let" },
    { id: "stay", label: "Ubytování", emoji: "🏨", desc: "Hotel, hostel, vila, resort" },
    { id: "food_highlight", label: "Jídlo & Highlight", emoji: "🍜", desc: "Bistro, khao soi, trh, chrám" },
    { id: "note", label: "Zápisek dne", emoji: "📝", desc: "Postřeh, tip, zážitek dne" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Hlavička modálu */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 id="modal-title" className="text-lg font-bold text-slate-900">
              {isEditing ? "Upravit záznam deníku" : "Nový záznam do deníku"}
            </h2>
            <p className="text-xs text-slate-500">
              Zaznamenejte zážitek, ubytování, dopravu nebo gastro tip
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-slate-200/70 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Zavřít formulář"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tělo formuláře */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Výběr kategorie */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Kategorie záznamu
            </label>
            <div className="grid grid-cols-2 gap-2">
              {categoriesList.map((cat) => {
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`flex items-start gap-2.5 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "bg-rose-50/70 border-rose-400 ring-2 ring-rose-300/40 text-rose-950 shadow-sm"
                        : "bg-white border-slate-200 hover:border-slate-300 text-slate-700"
                    }`}
                  >
                    <span className="text-2xl shrink-0">{cat.emoji}</span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-tight">
                        {cat.label}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate mt-0.5">
                        {cat.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Datum, čas a číslo dne */}
          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Datum *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-xs sm:text-sm text-slate-900 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Čas
              </label>
              <input
                type="text"
                placeholder="např. 09:00"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-xs sm:text-sm text-slate-900 outline-none transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div className="col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Lokace / Město *
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="např. Chiang Mai, Luang Prabang, Hanoi..."
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full h-11 pl-9 pr-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-xs sm:text-sm text-slate-900 outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                Číslo dne
              </label>
              <input
                type="number"
                min="1"
                placeholder="např. 1"
                value={dayNumber}
                onChange={(e) => setDayNumber(e.target.value)}
                className="w-full h-11 px-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-xs sm:text-sm text-slate-900 outline-none transition-all"
              />
            </div>
          </div>

          {/* Název / Titulek */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Název / Titulek *
            </label>
            <input
              type="text"
              required
              placeholder="např. Půjčení skútru Honda Click, Green Tiger House, Khao Soi Mae Sai..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-xs sm:text-sm text-slate-900 font-medium outline-none transition-all"
            />
          </div>

          {/* Text / Popis / Recenze */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
              Detail / Popis / Poznámka / Tip
            </label>
            <textarea
              rows={3}
              placeholder="Napište krátký popis, recenzi, tip na jídlo, cenu nebo varování..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-xs sm:text-sm text-slate-900 outline-none transition-all resize-y"
            />
          </div>

          {/* Fotografie (max 1 fotka s lokální kompresí na ~60-90 kB) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Fotografie <span className="text-slate-400 lowercase">(max 1 fotka, automatická komprese)</span>
            </label>

            {/* Skrytý input pro fotoaparát / galerii */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoSelect}
              className="hidden"
            />

            {photoBase64 ? (
              <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="relative h-20 w-20 rounded-xl overflow-hidden border border-slate-200 shrink-0 bg-slate-100 shadow-xs">
                  <img
                    src={photoBase64}
                    alt="Náhled fotografie"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-md transition-transform hover:scale-110 cursor-pointer"
                    title="Odstranit fotografii"
                    aria-label="Odstranit fotografii"
                  >
                    <X className="h-3 w-3 stroke-[2.5]" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                    <span>Fotografie připravena</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                    Automaticky zmenšena na max 800 px (~60-90 kB) pro bleskové načtení
                  </p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-1.5 text-xs text-rose-600 hover:text-rose-700 font-semibold underline cursor-pointer"
                  >
                    Změnit fotku
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isCompressing}
                className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-rose-400 bg-slate-50/50 hover:bg-rose-50/20 text-slate-600 hover:text-rose-700 font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isCompressing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin text-rose-500" />
                    <span>Zpracovávám a komprimuji fotku...</span>
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 text-slate-400" />
                    <span>📷 Vyfotit / Přidat fotku</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Hodnocení hvězdičkami */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                Hodnocení (volitelné)
              </label>
              <p className="text-[11px] text-slate-400">
                {rating > 0 ? "Klikněte znovu pro zrušení" : "Klikněte na hvězdičku"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StarRating value={rating} onChange={(v) => setRating(v)} size="md" />
              {rating > 0 && (
                <button
                  type="button"
                  onClick={() => setRating(0)}
                  className="text-[11px] text-slate-400 hover:text-rose-500 ml-1 underline cursor-pointer"
                >
                  zrušit
                </button>
              )}
            </div>
          </div>

          {/* Tlačítka */}
          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-rose-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>{isEditing ? "Uložit změny" : "Přidat do deníku"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Položka na časové ose ──────────────────────────────────────────────────
function TimelineCard({
  entry,
  onEdit,
  onDelete,
  onPhotoClick,
}: {
  entry: DiaryEntry;
  onEdit: () => void;
  onDelete: () => void;
  onPhotoClick: (base64: string) => void;
}) {
  const catConfig = DIARY_CATEGORY_CONFIGS[entry.category] || DIARY_CATEGORY_CONFIGS.note;

  return (
    <div className="relative group">
      {/* Puntík na svislé ose */}
      <div className="absolute -left-6 sm:-left-8 top-3.5 flex items-center justify-center">
        <div
          className={`h-5 w-5 rounded-full border-2 border-white shadow-md flex items-center justify-center text-[10px] ${catConfig.dotBg} text-white font-bold ring-2 ring-slate-100`}
          title={catConfig.label}
        >
          <span>{catConfig.emoji}</span>
        </div>
      </div>

      {/* Tělo karty */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 hover:border-slate-200 transition-all flex flex-col gap-2">
        {/* Horní řádek karty: štítek kategorie, čas, lokace a akční tlačítka */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Kategorie */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${catConfig.badgeBg}`}
            >
              <span>{catConfig.emoji}</span>
              <span>{catConfig.label}</span>
            </span>

            {/* Čas */}
            {entry.time && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
                <Clock className="h-3 w-3 text-slate-400" />
                <span>{entry.time}</span>
              </span>
            )}

            {/* Lokace */}
            {entry.location && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 text-[11px] border border-slate-200/60">
                <MapPin className="h-3 w-3 text-slate-400" />
                <span className="truncate max-w-[140px]">{entry.location}</span>
              </span>
            )}
          </div>

          {/* Tlačítka pro úpravu a smazání */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onEdit}
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
              title="Upravit záznam"
              aria-label="Upravit záznam"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Smazat záznam"
              aria-label="Smazat záznam"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Titulek */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
            {entry.title}
          </h3>
        </div>

        {/* Hvězdičkové hodnocení, pokud je zadáno */}
        {entry.rating !== undefined && entry.rating > 0 && (
          <div className="pt-0.5">
            <StarRating value={entry.rating} readonly size="sm" />
          </div>
        )}

        {/* Částka / Výdaj spojený se záznamem */}
        {entry.cost && (
          <div className="flex items-center gap-2 pt-0.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-700 border border-rose-200/70 text-xs font-bold shadow-2xs">
              <Coins className="h-3.5 w-3.5 text-rose-500" />
              <span>{formatCurrency(entry.cost.amount, entry.cost.currency)}</span>
              {entry.cost.currency !== "CZK" && entry.cost.czkAmount > 0 && (
                <span className="text-[11px] font-normal text-rose-500/80">
                  (≈ {formatCZK(entry.cost.czkAmount)})
                </span>
              )}
            </span>
            {entry.expenseId && (
              <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                <span>•</span>
                <span>Z peněženky</span>
              </span>
            )}
          </div>
        )}

        {/* Text / Popis / Tip */}
        {entry.text && (
          <p className="text-xs sm:text-sm text-slate-600 whitespace-pre-wrap leading-relaxed mt-0.5 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
            {entry.text}
          </p>
        )}

        {/* Fotografie záznamu (miniatura s možností rozkliknutí do Lightboxu) */}
        {entry.photoBase64 && (
          <div className="mt-1">
            <button
              type="button"
              onClick={() => onPhotoClick(entry.photoBase64!)}
              className="group/img relative rounded-2xl overflow-hidden border border-slate-200/80 shadow-xs cursor-pointer block hover:opacity-95 transition-all text-left max-w-sm"
              title="Klikněte pro celoobrazovkový náhled"
            >
              <img
                src={entry.photoBase64}
                alt={entry.title}
                className="w-full max-h-56 object-cover object-center rounded-2xl"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                <span className="px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-xs text-white text-[11px] font-semibold shadow-md flex items-center gap-1.5">
                  <Maximize2 className="h-3.5 w-3.5" />
                  <span>Zvětšit fotku</span>
                </span>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── HLAVNÍ STRÁNKA CESTOVNÍHO DENÍKU ──────────────────────────────────────
export default function DiaryPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortAsc, setSortAsc] = useState(true); // Chronologicky (nejstarší první) vs nejnovější

  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<DiaryEntry | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Odběr záznamů deníku z Firestore
  useEffect(() => {
    setIsLoading(true);
    const unsubDiary = subscribeToDiaryEntries(
      (data) => {
        setEntries(data);
        setIsLoading(false);
      },
      (err) => {
        console.error("Chyba při načítání deníku:", err);
        setIsLoading(false);
      }
    );

    return () => unsubDiary();
  }, []);

  // 2. Odběr výdajů z kolekce expenses pro automatický souhrn
  useEffect(() => {
    const qExpenses = query(collection(db, "expenses"), orderBy("createdAt", "desc"));
    const unsubExpenses = onSnapshot(
      qExpenses,
      (snapshot) => {
        const list: Expense[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            amountOriginal: Number(data.amountOriginal) || 0,
            currency: data.currency || "CZK",
            amountCZK: Number(data.amountCZK) || 0,
            category: data.category || "Různé",
            note: data.note || "",
            merchant: data.merchant,
            createdAt: data.createdAt || new Date().toISOString(),
            paymentMethod: data.paymentMethod,
            addToDiary: Boolean(data.addToDiary),
            diaryEntryId: data.diaryEntryId ? String(data.diaryEntryId) : undefined,
          };
        });
        setExpenses(list);
      },
      (err) => {
        console.error("Chyba při načítání výdajů:", err);
      }
    );

    return () => unsubExpenses();
  }, []);

  // Mapování denních výdajů podle data (YYYY-MM-DD)
  const expensesByDate = useMemo(() => {
    const map = new Map<string, { totalCZK: number; count: number }>();
    for (const exp of expenses) {
      const dateKey = extractDateKey(exp.createdAt);
      if (!dateKey) continue;
      const prev = map.get(dateKey) || { totalCZK: 0, count: 0 };
      map.set(dateKey, {
        totalCZK: prev.totalCZK + (exp.amountCZK || 0),
        count: prev.count + 1,
      });
    }
    return map;
  }, [expenses]);

  // Seskupení záznamů deníku podle dnů a výpočet hlavičky "Den X: {location} — {datum}"
  const groupedDays = useMemo(() => {
    // 1. Najdeme unikátní seřazená data
    const dateMap = new Map<string, DiaryEntry[]>();
    for (const entry of entries) {
      const list = dateMap.get(entry.date) || [];
      list.push(entry);
      dateMap.set(entry.date, list);
    }

    // Seřadíme data vzestupně pro správné očíslování Den 1, Den 2...
    const sortedDatesAsc = Array.from(dateMap.keys()).sort((a, b) => a.localeCompare(b));

    const dayGroups = sortedDatesAsc.map((date, index) => {
      const dayEntries = dateMap.get(date) || [];

      // Seřazení záznamů v rámci dne podle času
      dayEntries.sort((a, b) => {
        const timeA = a.time || "";
        const timeB = b.time || "";
        if (timeA && timeB) return timeA.localeCompare(timeB);
        if (timeA && !timeB) return -1;
        if (!timeA && timeB) return 1;
        return 0;
      });

      // Určení čísla dne: pokud má alespoň jeden záznam explicitní dayNumber, použijeme ho
      const explicitDay = dayEntries.find(
        (e) => e.dayNumber !== undefined && e.dayNumber > 0
      )?.dayNumber;
      const dayNumber = explicitDay ?? index + 1;

      // Získání unikátních lokací pro tento den
      const uniqueLocations = Array.from(
        new Set(dayEntries.map((e) => e.location.trim()).filter(Boolean))
      );
      const locationStr =
        uniqueLocations.length > 0 ? uniqueLocations.join(" → ") : "";

      // Načtení denního souhrnu výdajů
      const expenseInfo = expensesByDate.get(date) || { totalCZK: 0, count: 0 };

      return {
        date,
        dayNumber,
        location: locationStr,
        entries: dayEntries,
        expensesSumCZK: expenseInfo.totalCZK,
        expensesCount: expenseInfo.count,
      };
    });

    if (!sortAsc) {
      return [...dayGroups].reverse();
    }
    return dayGroups;
  }, [entries, expensesByDate, sortAsc]);

  // Celkový součet výdajů za všechny dny v deníku
  const totalDiaryExpensesCZK = useMemo(() => {
    return groupedDays.reduce((acc, g) => acc + g.expensesSumCZK, 0);
  }, [groupedDays]);

  // CRUD akce
  const openCreate = () => {
    setEditingEntry(null);
    setModalOpen(true);
  };

  const openEdit = (entry: DiaryEntry) => {
    setEditingEntry(entry);
    setModalOpen(true);
  };

  const handleDelete = async (id?: string) => {
    if (!id) return;
    const ok = window.confirm("Opravdu chcete tento záznam z deníku smazat?");
    if (!ok) return;

    try {
      await deleteDiaryEntry(id);
      showToast("Záznam byl úspěšně smazán");
    } catch (err) {
      console.error("Chyba při mazání záznamu:", err);
      alert("Nepodařilo se smazat záznam z databáze.");
    }
  };

  const handleSubmitModal = async (data: Omit<DiaryEntry, "id">) => {
    setIsSubmitting(true);
    try {
      if (editingEntry?.id) {
        await updateDiaryEntry(editingEntry.id, data);
        showToast("Záznam byl upraven");
      } else {
        await addDiaryEntry(data);
        showToast("Nový záznam byl přidán do deníku");
      }
      setModalOpen(false);
      setEditingEntry(null);
    } catch (err) {
      console.error("Chyba při ukládání záznamu:", err);
      alert("Nepodařilo se uložit záznam. Zkontrolujte připojení k internetu.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F6F4] text-slate-800 antialiased selection:bg-rose-500/20 pb-44">
      {/* Toast notifikace */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full bg-slate-900 text-white px-4 py-2.5 shadow-xl text-xs sm:text-sm font-medium animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      <main className="max-w-md mx-auto px-4 pt-6 flex flex-col gap-5 sm:max-w-lg">
        {/* 1. HORNÍ LIŠTA S TLAČÍTKEM ZPĚT, NADPISEM A TLAČÍTKEM NOVÝ ZÁZNAM */}
        <header className="flex flex-col gap-3 pt-2">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-slate-600 hover:text-rose-600 shadow-sm border border-slate-200/80 text-xs font-semibold transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Zpět</span>
            </Link>

            <button
              type="button"
              onClick={openCreate}
              className="h-8 sm:h-9 px-3.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-md shadow-rose-500/25 flex items-center gap-1.5 text-xs font-bold tracking-wide transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Nový záznam</span>
            </button>
          </div>

          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">📖</span>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
                  Deník cesty
                </h1>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Časová osa ubytování, dopravy, gastro zážitků a postřehů
              </p>
            </div>

            {entries.length > 1 && (
              <button
                type="button"
                onClick={() => setSortAsc(!sortAsc)}
                className="mt-1 px-2.5 py-1 rounded-xl bg-white border border-slate-200/80 text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                title="Změnit řazení dnů"
              >
                <ArrowUpDown className="h-3 w-3 text-slate-400" />
                <span>{sortAsc ? "Od začátku" : "Nejnovější"}</span>
              </button>
            )}
          </div>

          {/* Rychlé souhrnné karty */}
          {entries.length > 0 && (
            <div className="grid grid-cols-3 gap-2 pt-1">
              <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-2xs">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Dny na cestě
                </span>
                <div className="text-lg font-black text-slate-900 mt-0.5">
                  {groupedDays.length}{" "}
                  <span className="text-[11px] font-medium text-slate-400">
                    {groupedDays.length === 1 ? "den" : groupedDays.length < 5 ? "dny" : "dní"}
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-2xs">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
                  Záznamy
                </span>
                <div className="text-lg font-black text-slate-900 mt-0.5">
                  {entries.length}{" "}
                  <span className="text-[11px] font-medium text-slate-400">
                    {entries.length === 1 ? "zápis" : entries.length < 5 ? "zápisy" : "zápisů"}
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-2xs">
                <span className="text-[10px] uppercase font-bold tracking-wider text-rose-500 block">
                  Výdaje dnů
                </span>
                <div className="text-lg font-black text-slate-900 mt-0.5 truncate">
                  {formatCZK(totalDiaryExpensesCZK)}
                </div>
              </div>
            </div>
          )}
        </header>

        {/* 2. OBSAH DENÍKU: NAČÍTÁNÍ / PRÁZDNÝ STAV / ČASOVÁ OSA PODLE DNŮ */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
            <span className="text-xs text-slate-400 font-medium">
              Načítám váš cestovní deník...
            </span>
          </div>
        ) : entries.length === 0 ? (
          /* Prázdný stav */
          <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm text-center flex flex-col items-center gap-4 my-4">
            <div className="h-16 w-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center text-3xl shadow-inner">
              📖
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Váš cestovní deník je zatím prázdný
              </h2>
              <p className="text-xs text-slate-500 max-w-xs mt-1 leading-relaxed">
                Zaznamenejte si půjčení skútru, ubytování, oblíbená jídla nebo tipy z cesty na přehlednou časovou osu.
              </p>
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="mt-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-bold text-xs shadow-md shadow-rose-500/25 flex items-center gap-2 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Přidat první záznam</span>
            </button>
          </div>
        ) : (
          /* Časová osa seskupená podle dnů */
          <div className="flex flex-col gap-6">
            {groupedDays.map((dayGroup) => (
              <section key={dayGroup.date} className="flex flex-col gap-3">
                {/* Hlavička dne: "Den X: {location} — {datum}" */}
                <div className="bg-slate-900 text-white rounded-2xl px-4 py-3 shadow-sm flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2 w-2 rounded-full bg-rose-400 shrink-0" />
                    <h2 className="text-xs sm:text-sm font-bold tracking-tight truncate">
                      Den {dayGroup.dayNumber}
                      {dayGroup.location ? `: ${dayGroup.location}` : ""} —{" "}
                      {formatDiaryDateCzech(dayGroup.date)}
                    </h2>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium shrink-0">
                    {dayGroup.entries.length}{" "}
                    {dayGroup.entries.length === 1
                      ? "položka"
                      : dayGroup.entries.length < 5
                      ? "položky"
                      : "položek"}
                  </span>
                </div>

                {/* Kompaktní karta: "Denní souhrn výdajů: X Kč" */}
                <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs text-xs">
                  <div className="flex items-center gap-2 text-slate-600 font-medium">
                    <span className="p-1 rounded-md bg-rose-50 text-rose-600">
                      <Coins className="h-3.5 w-3.5" />
                    </span>
                    <span>Denní souhrn výdajů:</span>
                  </div>
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{formatCZK(dayGroup.expensesSumCZK)}</span>
                    {dayGroup.expensesCount > 0 && (
                      <span className="text-[10px] font-normal text-slate-400">
                        ({dayGroup.expensesCount}{" "}
                        {dayGroup.expensesCount === 1
                          ? "výdaj"
                          : dayGroup.expensesCount < 5
                          ? "výdaje"
                          : "výdajů"}
                        )
                      </span>
                    )}
                  </div>
                </div>

                {/* Svislá časová osa položek pro tento den */}
                <div className="relative pl-6 sm:pl-8 before:absolute before:left-[9px] sm:before:left-[9px] before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200 flex flex-col gap-3 pt-1">
                  {dayGroup.entries.map((entry) => (
                    <TimelineCard
                      key={entry.id || `${entry.date}-${entry.title}`}
                      entry={entry}
                      onEdit={() => openEdit(entry)}
                      onDelete={() => handleDelete(entry.id)}
                      onPhotoClick={(img) => setLightboxImage(img)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      {/* Plovoucí tlačítko "Nový záznam" při scrollování */}
      {entries.length > 0 && (
        <div className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-40">
          <button
            type="button"
            onClick={openCreate}
            className="h-12 px-4 rounded-full bg-gradient-to-r from-rose-500 via-rose-600 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-xl shadow-rose-500/35 flex items-center gap-2 font-bold text-xs tracking-wide transition-all duration-200 active:scale-95 border border-white/20 cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Nový záznam</span>
          </button>
        </div>
      )}

      {/* 3. HLAVNÍ NAVIGAČNÍ LIŠTA DOLE S AKTIVNÍM DENÍKEM */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-lg pointer-events-auto">
        <div className="max-w-md mx-auto sm:max-w-lg px-4 sm:px-6 py-2 flex items-center justify-between">
          <Link
            href="/"
            className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ReceiptText className="h-5 w-5" />
            <span className="text-[10px]">Entries</span>
          </Link>

          <Link
            href="/diary"
            className="flex flex-col items-center gap-0.5 text-rose-600 font-bold transition-colors"
            aria-current="page"
          >
            <BookText className="h-5 w-5 stroke-[2.3]" />
            <span className="text-[10px]">Deník</span>
          </Link>

          <Link
            href="/services"
            className="flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-600 transition-colors"
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

      {/* Modální okno pro přidání / úpravu záznamu */}
      {modalOpen && (
        <DiaryEntryModal
          key={editingEntry?.id ?? "new-diary-entry"}
          initial={editingEntry}
          onClose={() => {
            setModalOpen(false);
            setEditingEntry(null);
          }}
          onSubmit={handleSubmitModal}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Celoobrazovkový náhled fotografie (Lightbox) */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200 cursor-zoom-out"
          onClick={() => setLightboxImage(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative max-w-3xl max-h-[90vh] flex flex-col items-center justify-center cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-12 right-0 sm:top-2 sm:right-2 z-10 h-10 w-10 rounded-full bg-white/20 hover:bg-white/40 text-white flex items-center justify-center shadow-lg transition-transform hover:scale-110 cursor-pointer backdrop-blur-md"
              title="Zavřít náhled"
              aria-label="Zavřít náhled"
            >
              <X className="h-6 w-6 stroke-[2.5]" />
            </button>
            <img
              src={lightboxImage}
              alt="Celoobrazovkový náhled fotografie"
              className="max-h-[85vh] max-w-full rounded-2xl shadow-2xl object-contain border border-white/10"
            />
          </div>
        </div>
      )}
    </div>
  );
}

