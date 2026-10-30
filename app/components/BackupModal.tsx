"use client";

import { useState, useRef } from "react";
import { Expense, ServiceEntry } from "@/lib/types";
import { exportData, exportCSV, restoreFromJSON, RestoreResult } from "@/lib/backupService";
import {
  X,
  Download,
  FileSpreadsheet,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  FileJson,
} from "lucide-react";

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: Expense[];
  services: ServiceEntry[];
  onRestoreSuccess?: (result: RestoreResult) => void;
}

export default function BackupModal({
  isOpen,
  onClose,
  expenses,
  services,
  onRestoreSuccess,
}: BackupModalProps) {
  const [isRestoring, setIsRestoring] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleExportJSON = () => {
    try {
      setErrorMsg(null);
      exportData(expenses, services);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg("Nepodařilo se vytvořit JSON zálohu.");
    }
  };

  const handleExportCSV = () => {
    try {
      setErrorMsg(null);
      exportCSV(expenses, services);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg("Nepodařilo se vytvořit CSV tabulku.");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset hodnoty inputu, aby šel stejný soubor vybrat znovu
    e.target.value = "";
    if (!file) return;

    const confirmed = window.confirm(
      "Chcete opravdu obnovit data ze souboru? Existující záznamy budou aktualizovány."
    );
    if (!confirmed) return;

    setIsRestoring(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await restoreFromJSON(file);
      const msg = `Úspěšně obnoveno: ${result.expensesRestored} výdajů, ${result.servicesRestored} služeb`;
      setSuccessMsg(msg);
      onRestoreSuccess?.(result);
    } catch (err: unknown) {
      console.error("Chyba při obnově dat:", err);
      const msg = err instanceof Error ? err.message : "Chyba při zpracování záložního souboru.";
      setErrorMsg(msg);
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hlavička */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">Záloha a obnova dat</h3>
              <p className="text-[11px] text-slate-400">Export do souboru a obnova databáze</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tělo modálu */}
        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-5">
          {/* Notifikace o úspěchu */}
          {successMsg && (
            <div className="flex items-start gap-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 p-3.5 text-emerald-800 text-xs">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
              <div className="flex-1 font-medium">{successMsg}</div>
            </div>
          )}

          {/* Notifikace o chybě */}
          {errorMsg && (
            <div className="flex items-start gap-2.5 rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-rose-800 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 font-medium">{errorMsg}</div>
            </div>
          )}

          {/* SEKCE 1: Export (Stažení zálohy) */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                1. Export (Stažení zálohy)
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {expenses.length} výdajů · {services.length} služeb
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2.5">
              {/* Tlačítko: JSON záloha */}
              <button
                type="button"
                onClick={handleExportJSON}
                disabled={isRestoring}
                className="w-full p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 hover:bg-rose-50/50 hover:border-rose-300 text-left flex items-center gap-3 transition-all group disabled:opacity-50 cursor-pointer"
              >
                <div className="h-10 w-10 rounded-xl bg-white shadow-xs border border-slate-200/60 flex items-center justify-center text-rose-500 group-hover:scale-105 transition-transform shrink-0">
                  <FileJson className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-slate-800 group-hover:text-rose-600 transition-colors flex items-center gap-1.5">
                    <span>Stáhnout kompletní zálohu (.json)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Všechna data výdajů a služeb pro bezpečné uchování a zpětnou obnovu.
                  </p>
                </div>
                <Download className="h-4 w-4 text-slate-400 group-hover:text-rose-500 transition-colors shrink-0" />
              </button>

              {/* Tlačítko: CSV tabulka */}
              <button
                type="button"
                onClick={handleExportCSV}
                disabled={isRestoring}
                className="w-full p-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/60 hover:bg-emerald-50/50 hover:border-emerald-300 text-left flex items-center gap-3 transition-all group disabled:opacity-50 cursor-pointer"
              >
                <div className="h-10 w-10 rounded-xl bg-white shadow-xs border border-slate-200/60 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform shrink-0">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-black text-slate-800 group-hover:text-emerald-700 transition-colors flex items-center gap-1.5">
                    <span>Stáhnout tabulku pro Excel (.csv)</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Přehledná tabulka s UTF-8 pro Excel, Numbers či Google Tabulky.
                  </p>
                </div>
                <Download className="h-4 w-4 text-slate-400 group-hover:text-emerald-600 transition-colors shrink-0" />
              </button>
            </div>
          </div>

          {/* SEKCE 2: Obnova (Nahrání zálohy) */}
          <div className="flex flex-col gap-2.5 pt-2 border-t border-slate-100">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              2. Obnova (Nahrání zálohy)
            </span>

            <div className="rounded-2xl border border-dashed border-slate-200 p-4 bg-slate-50/40 flex flex-col gap-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                Při ztrátě dat nebo přechodu na jiný telefon vyber dříve stažený <span className="font-semibold text-slate-700">.json</span> soubor.
              </p>

              {/* Skrytý file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFileChange}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isRestoring}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 active:scale-[0.99] text-white font-bold text-xs shadow-md shadow-rose-500/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isRestoring ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Obnovuji data do databáze...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span>Vybrat soubor zálohy a obnovit data</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Patička modálu */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/60 transition-colors"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
}
