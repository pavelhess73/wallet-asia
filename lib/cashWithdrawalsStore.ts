/**
 * Firestore store pro evidenci výběrů z ATM a směn (kolekce cash_withdrawals).
 * Poskytuje reaktivní odběr (onSnapshot) a standardní CRUD operace.
 */
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { CashWithdrawal } from "@/lib/types";

export const CASH_WITHDRAWALS_COL = "cash_withdrawals";

/**
 * Množina ID záznamů smazaných v této relaci pro eliminaci probliknutí z cache.
 */
const pendingDeletedWithdrawalIds = new Set<string>();

/**
 * Pomocná funkce pro sanitizaci objektu proti undefined hodnotám před zápisem do Firestore.
 */
function sanitizeData<T extends Record<string, unknown>>(data: T): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      clean[key] = val;
    }
  }
  return clean;
}

/**
 * Normalizuje dokument z Firestore na typ CashWithdrawal.
 */
export function normalizeCashWithdrawal(id: string, data: Record<string, any>): CashWithdrawal {
  return {
    id,
    date: (data.date || new Date().toISOString().split("T")[0]).toString(),
    type: data.type === "exchange" ? "exchange" : "atm",
    targetAmount: Number(data.targetAmount) || 0,
    targetCurrency: (data.targetCurrency || "THB").toString().toUpperCase().trim(),
    sourceAmount: data.sourceAmount !== undefined && data.sourceAmount !== null && data.sourceAmount !== ""
      ? Number(data.sourceAmount)
      : undefined,
    sourceCurrency: data.sourceCurrency ? String(data.sourceCurrency).toUpperCase().trim() : undefined,
    atmFee: data.atmFee !== undefined && data.atmFee !== null && data.atmFee !== ""
      ? Number(data.atmFee)
      : undefined,
    note: data.note ? String(data.note).trim() : undefined,
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}

/**
 * Přihlásí se k odběru všech záznamů výběrů/směn v reálném čase seřazených podle data.
 */
export function subscribeToCashWithdrawals(
  callback: (withdrawals: CashWithdrawal[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(collection(db, CASH_WITHDRAWALS_COL), orderBy("date", "desc"));

  return onSnapshot(
    q,
    (snap) => {
      const withdrawals: CashWithdrawal[] = [];
      for (const d of snap.docs) {
        if (pendingDeletedWithdrawalIds.has(d.id)) {
          continue;
        }
        withdrawals.push(normalizeCashWithdrawal(d.id, d.data()));
      }
      callback(withdrawals);
    },
    (err) => {
      console.error("cash_withdrawals listener error:", err);
      onError?.(err);
    }
  );
}

/**
 * Načte jednorázově všechny záznamy výběrů/směn seřazené podle data sestupně.
 */
export async function getCashWithdrawals(): Promise<CashWithdrawal[]> {
  const q = query(collection(db, CASH_WITHDRAWALS_COL), orderBy("date", "desc"));
  const snap = await getDocs(q);
  const result: CashWithdrawal[] = [];
  for (const d of snap.docs) {
    if (pendingDeletedWithdrawalIds.has(d.id)) continue;
    result.push(normalizeCashWithdrawal(d.id, d.data()));
  }
  return result;
}

/**
 * Přidá nový záznam o výběru z ATM nebo směně.
 */
export async function addCashWithdrawal(
  withdrawal: Omit<CashWithdrawal, "id">
): Promise<string> {
  const payload = {
    date: withdrawal.date || new Date().toISOString().split("T")[0],
    type: withdrawal.type,
    targetAmount: Number(withdrawal.targetAmount) || 0,
    targetCurrency: (withdrawal.targetCurrency || "THB").toUpperCase().trim(),
    sourceAmount: withdrawal.sourceAmount !== undefined && !isNaN(Number(withdrawal.sourceAmount))
      ? Number(withdrawal.sourceAmount)
      : undefined,
    sourceCurrency: withdrawal.sourceCurrency ? withdrawal.sourceCurrency.toUpperCase().trim() : undefined,
    atmFee: withdrawal.atmFee !== undefined && !isNaN(Number(withdrawal.atmFee))
      ? Number(withdrawal.atmFee)
      : undefined,
    note: withdrawal.note ? withdrawal.note.trim() : "",
    createdAt: withdrawal.createdAt || new Date().toISOString(),
  };

  const cleanPayload = sanitizeData(payload);
  const docRef = await addDoc(collection(db, CASH_WITHDRAWALS_COL), cleanPayload);
  return docRef.id;
}

/**
 * Aktualizuje existující záznam o výběru / směně.
 */
export async function updateCashWithdrawal(
  id: string,
  updates: Partial<Omit<CashWithdrawal, "id">>
): Promise<void> {
  const cleanUpdates: Record<string, unknown> = { ...updates };
  if ("note" in updates) {
    cleanUpdates.note = updates.note ? updates.note.trim() : "";
  }
  if ("targetCurrency" in updates && updates.targetCurrency) {
    cleanUpdates.targetCurrency = updates.targetCurrency.toUpperCase().trim();
  }
  if ("sourceCurrency" in updates && updates.sourceCurrency) {
    cleanUpdates.sourceCurrency = updates.sourceCurrency.toUpperCase().trim();
  }
  const sanitized = sanitizeData(cleanUpdates);
  await updateDoc(doc(db, CASH_WITHDRAWALS_COL, id), sanitized);
}

/**
 * Trvale smaže záznam výběru z Firestore.
 */
export async function deleteCashWithdrawal(id: string): Promise<void> {
  pendingDeletedWithdrawalIds.add(id);
  try {
    await deleteDoc(doc(db, CASH_WITHDRAWALS_COL, id));
  } catch (err) {
    pendingDeletedWithdrawalIds.delete(id);
    throw err;
  }
}
