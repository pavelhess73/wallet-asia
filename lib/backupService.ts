import { Firestore, doc, setDoc, addDoc, collection } from "firebase/firestore";
import { db as defaultDb } from "@/lib/firebase";
import { Expense, ServiceEntry } from "@/lib/types";

/**
 * Pomocná funkce pro formátování data do řetězce YYYY-MM-DD
 */
function formatDateYMD(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Bezpečné stažení souboru v prohlížeči pomocí virtuálního <a> elementu
 */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Ošetření CSV hodnoty: uvozovky a oddělovače středníku
 */
function escapeCSVValue(val: string | number | undefined | null): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(";") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Sanitizace objektu pro Firestore proti hodnotám undefined
 */
function sanitizeFirestoreData<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "id") continue; // ID dokumentu je v docRef, ne v samotném těle
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean;
}

export interface BackupPayload {
  version: number;
  exportedAt: string;
  expenses: Expense[];
  services: ServiceEntry[];
}

export interface RestoreResult {
  expensesRestored: number;
  servicesRestored: number;
}

/**
 * Exportuje kompletní zálohu výdajů i služeb do souboru .json
 */
export function exportData(expenses: Expense[], services: ServiceEntry[]): void {
  const backup: BackupPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    expenses,
    services,
  };

  const filename = `wallet-asia-backup-${formatDateYMD()}.json`;
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json;charset=utf-8;",
  });

  downloadBlob(blob, filename);
}

/**
 * Exportuje sjednocenou tabulku výdajů a služeb do CSV souboru (s UTF-8 BOM pro Excel)
 */
export function exportCSV(expenses: Expense[], services: ServiceEntry[]): void {
  const header = ["Typ", "Datum", "Název/Popis", "Kategorie", "Částka", "Měna", "Způsob platby", "Poznámka"];
  const rows: string[][] = [];

  // 1. Výdaje
  for (const exp of expenses) {
    const formattedDate = exp.createdAt ? exp.createdAt.split("T")[0] : "";
    const title = exp.merchant ? `${exp.note} (${exp.merchant})` : exp.note;
    const payment = exp.paymentMethod === "card" ? "Karta" : "Hotovost";
    rows.push([
      "Výdaj",
      formattedDate,
      title,
      exp.category || "Různé",
      String(exp.amountOriginal ?? 0),
      exp.currency || "CZK",
      payment,
      exp.note || "",
    ]);
  }

  // 2. Služby
  for (const svc of services) {
    const formattedDate = svc.createdAt ? svc.createdAt.split("T")[0] : "";
    const title = svc.location ? `${svc.name} – ${svc.location}` : svc.name;
    const payment = svc.paymentMethod === "card" ? "Karta" : "Hotovost";
    const noteAndItems = [
      svc.note || "",
      svc.items && svc.items.length > 0 ? `Položky: ${svc.items.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join(" | ");

    rows.push([
      "Služba",
      formattedDate,
      title,
      svc.category || "Jiné",
      String(svc.price ?? 0),
      svc.currency || "THB",
      payment,
      noteAndItems,
    ]);
  }

  // Seřadit sestupně podle data
  rows.sort((a, b) => b[1].localeCompare(a[1]));

  // Sestavení CSV řádků se středníkem jako oddělovačem
  const csvLines = [
    header.map(escapeCSVValue).join(";"),
    ...rows.map((row) => row.map(escapeCSVValue).join(";")),
  ];

  // UTF-8 BOM (\uFEFF) zajišťuje správné zobrazení diakritiky v MS Excel
  const csvContent = "\uFEFF" + csvLines.join("\r\n");
  const filename = `wallet-asia-export-${formatDateYMD()}.csv`;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

  downloadBlob(blob, filename);
}

/**
 * Načte a obnoví data z vybraného JSON souboru do Firestore.
 * Existující záznamy (se stejným ID) aktualizuje ({ merge: true }), nové vytvoří.
 */
export async function restoreFromJSON(
  file: File,
  dbInstance?: Firestore
): Promise<RestoreResult> {
  const targetDb = dbInstance || defaultDb;
  const text = await file.text();

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Soubor není platný JSON soubor.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Neplatný obsah souboru zálohy.");
  }

  const rawExpenses: any[] = Array.isArray(parsed.expenses) ? parsed.expenses : [];
  const rawServices: any[] = Array.isArray(parsed.services) ? parsed.services : [];

  if (rawExpenses.length === 0 && rawServices.length === 0) {
    throw new Error("Soubor neobsahuje žádná data výdajů ani služeb k obnovení.");
  }

  let expensesRestored = 0;
  let servicesRestored = 0;

  // 1. Obnova výdajů
  for (const exp of rawExpenses) {
    if (!exp || typeof exp !== "object") continue;

    const cleanExpense = sanitizeFirestoreData({
      amountOriginal: Number(exp.amountOriginal) || 0,
      currency: exp.currency || "CZK",
      amountCZK: Number(exp.amountCZK) || 0,
      category: exp.category || "Různé",
      note: (exp.note || "").toString().trim(),
      merchant: exp.merchant ? exp.merchant.toString().trim() : "",
      createdAt: exp.createdAt || new Date().toISOString(),
      paymentMethod: exp.paymentMethod === "card" ? "card" : "cash",
      ...(exp.location && typeof exp.location === "object" ? { location: exp.location } : {}),
    });

    if (exp.id && typeof exp.id === "string") {
      await setDoc(doc(targetDb, "expenses", exp.id), cleanExpense, { merge: true });
    } else {
      await addDoc(collection(targetDb, "expenses"), cleanExpense);
    }
    expensesRestored++;
  }

  // 2. Obnova služeb
  for (const svc of rawServices) {
    if (!svc || typeof svc !== "object") continue;

    const cleanService = sanitizeFirestoreData({
      name: (svc.name || "").toString().trim(),
      location: (svc.location || "").toString().trim(),
      category: (svc.category || "Jiné").toString().trim(),
      items: Array.isArray(svc.items) ? svc.items : [],
      price: Number(svc.price) || 0,
      currency: svc.currency || "THB",
      rating: Number(svc.rating) || 5,
      note: svc.note ? svc.note.toString().trim() : "",
      createdAt: svc.createdAt || new Date().toISOString(),
      paymentMethod: svc.paymentMethod === "card" ? "card" : "cash",
    });

    if (svc.id && typeof svc.id === "string") {
      await setDoc(doc(targetDb, "services", svc.id), cleanService, { merge: true });
    } else {
      await addDoc(collection(targetDb, "services"), cleanService);
    }
    servicesRestored++;
  }

  return {
    expensesRestored,
    servicesRestored,
  };
}
