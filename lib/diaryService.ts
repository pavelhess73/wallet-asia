/**
 * Firestore služba pro Cestovní deník (kolekce "diary").
 * Poskytuje CRUD operace a reaktivní onSnapshot odběr pro časovou osu.
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
import { DiaryEntry } from "@/lib/types";

export const DIARY_COL = "diary";

/**
 * Množina ID smazaných položek v této relaci pro zamezení probliknutí z IndexedDB cache.
 */
const pendingDeletedDiaryIds = new Set<string>();

/**
 * Pomocná funkce pro odstranění undefined hodnot před uložením do Firestore.
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
 * Normalizuje data z Firestore dokumentu na typ DiaryEntry.
 */
export function normalizeDiaryEntry(id: string, data: Record<string, any>): DiaryEntry {
  return {
    id,
    date: (data.date || new Date().toISOString().split("T")[0]).toString(),
    dayNumber:
      data.dayNumber !== undefined && data.dayNumber !== null && data.dayNumber !== ""
        ? Number(data.dayNumber)
        : undefined,
    location: (data.location ?? "").toString().trim(),
    category: (data.category as DiaryEntry["category"]) || "note",
    title: (data.title ?? "").toString().trim(),
    time: data.time ? data.time.toString().trim() : undefined,
    text: data.text ? data.text.toString().trim() : undefined,
    rating:
      data.rating !== undefined && data.rating !== null && data.rating !== ""
        ? Number(data.rating)
        : undefined,
    expenseId: data.expenseId ? String(data.expenseId).trim() : undefined,
    cost:
      data.cost && typeof data.cost === "object"
        ? {
            amount: Number(data.cost.amount) || 0,
            currency: (data.cost.currency || "CZK").toString(),
            czkAmount: Number(data.cost.czkAmount) || 0,
          }
        : undefined,
    photoBase64:
      data.photoBase64 && typeof data.photoBase64 === "string"
        ? data.photoBase64
        : undefined,
    createdAt: data.createdAt ?? new Date().toISOString(),
  };
}

/**
 * Seřadí záznamy chronologicky:
 * 1. podle data vzestupně (např. 2026-10-10 < 2026-10-11)
 * 2. podle času vzestupně (např. "09:00" < "13:30")
 * 3. podle createdAt
 */
export function sortDiaryEntriesChronologically(entries: DiaryEntry[]): DiaryEntry[] {
  return [...entries].sort((a, b) => {
    const dateCmp = (a.date || "").localeCompare(b.date || "");
    if (dateCmp !== 0) return dateCmp;

    const timeA = a.time || "";
    const timeB = b.time || "";
    if (timeA && timeB) {
      const timeCmp = timeA.localeCompare(timeB);
      if (timeCmp !== 0) return timeCmp;
    } else if (timeA && !timeB) {
      return -1; // Položky s časem dříve než položky bez času
    } else if (!timeA && timeB) {
      return 1;
    }

    const createdA = typeof a.createdAt === "string" ? a.createdAt : "";
    const createdB = typeof b.createdAt === "string" ? b.createdAt : "";
    return createdA.localeCompare(createdB);
  });
}

/**
 * Načte všechny záznamy deníku seřazené chronologicky.
 */
export async function getDiaryEntries(): Promise<DiaryEntry[]> {
  const q = query(collection(db, DIARY_COL), orderBy("date", "asc"));
  const snap = await getDocs(q);
  const result: DiaryEntry[] = [];
  for (const d of snap.docs) {
    if (pendingDeletedDiaryIds.has(d.id)) continue;
    result.push(normalizeDiaryEntry(d.id, d.data()));
  }
  return sortDiaryEntriesChronologically(result);
}

/**
 * Přidá nový záznam deníku do Firestore.
 */
export async function addDiaryEntry(entry: Omit<DiaryEntry, "id">): Promise<string> {
  const dataToSave = {
    ...entry,
    createdAt: entry.createdAt || new Date().toISOString(),
  };
  const sanitized = sanitizeData(dataToSave as Record<string, unknown>);
  const docRef = await addDoc(collection(db, DIARY_COL), sanitized);
  return docRef.id;
}

/**
 * Smaže záznam deníku podle ID.
 */
export async function deleteDiaryEntry(id: string): Promise<void> {
  pendingDeletedDiaryIds.add(id);
  try {
    await deleteDoc(doc(db, DIARY_COL, id));
  } catch (err) {
    pendingDeletedDiaryIds.delete(id);
    throw err;
  }
}

/**
 * Aktualizuje existující záznam deníku.
 */
export async function updateDiaryEntry(
  id: string,
  entry: Partial<DiaryEntry>
): Promise<void> {
  const { id: _ignored, ...updates } = entry;
  const sanitized = sanitizeData(updates as Record<string, unknown>);
  await updateDoc(doc(db, DIARY_COL, id), sanitized);
}

/**
 * Přihlásí se k odběru záznamů deníku v reálném čase.
 */
export function subscribeToDiaryEntries(
  callback: (entries: DiaryEntry[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(collection(db, DIARY_COL), orderBy("date", "asc"));

  return onSnapshot(
    q,
    (snap) => {
      const entries: DiaryEntry[] = [];
      for (const d of snap.docs) {
        if (pendingDeletedDiaryIds.has(d.id)) continue;
        entries.push(normalizeDiaryEntry(d.id, d.data()));
      }
      callback(sortDiaryEntriesChronologically(entries));
    },
    (err) => {
      console.error("diary listener error:", err);
      onError?.(err);
    }
  );
}

