/**
 * Firestore store pro dynamicke kategorie sluzeb (serviceCategories collection).
 * Pouziva offline persistence pres inicializaci v lib/firebase.ts.
 */
import {
  collection,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  onSnapshot,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ServiceCategory, DEFAULT_SERVICE_CATEGORIES } from "@/lib/types";

const COL = "serviceCategories";

// ─── Seeder ──────────────────────────────────────────────────────────────────

/**
 * Pokud chybi vychozi kategorie, provede idempotentni seed s pevnymi ID.
 * Zabranuje duplikatum pri vicenasobnem volani v React StrictMode.
 */
export async function seedDefaultCategoriesIfEmpty(): Promise<void> {
  const snap = await getDocs(collection(db, COL));
  const existingNames = new Set(
    snap.docs.map((d) => (d.data().name ?? "").toString().trim().toLowerCase())
  );

  // Pokud je kolekce zcela prazdna nebo chybi nektere defaulty
  for (const cat of DEFAULT_SERVICE_CATEGORIES) {
    const key = cat.name.trim().toLowerCase();
    if (!existingNames.has(key)) {
      const docId = `def_${cat.order}_${key}`;
      await setDoc(doc(db, COL, docId), cat, { merge: true });
      existingNames.add(key);
    }
  }
}

// ─── Real-time listener ───────────────────────────────────────────────────────

/**
 * Prihlas se k odberu kategorii (real-time).
 * Automaticky deduplikuje kategorie podle nazvu a radi je podle 'order'.
 * Vraci unsubscribe funkci.
 */
export function subscribeToCategories(
  callback: (cats: ServiceCategory[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(collection(db, COL), orderBy("order", "asc"));
  return onSnapshot(
    q,
    (snap) => {
      const seenNames = new Set<string>();
      const cats: ServiceCategory[] = [];

      for (const d of snap.docs) {
        const data = d.data();
        const rawName = (data.name ?? "").toString().trim();
        const normKey = rawName.toLowerCase();

        // Preskoc duplicity
        if (!rawName || seenNames.has(normKey)) {
          continue;
        }
        seenNames.add(normKey);

        cats.push({
          id: d.id,
          name: rawName,
          icon: (data.icon ?? "🏷️").toString().trim() || "🏷️",
          isDefault: data.isDefault ?? false,
          order: typeof data.order === "number" ? data.order : cats.length,
        });
      }

      callback(cats);
    },
    (err) => {
      console.error("serviceCategories listener error:", err);
      onError?.(err);
    }
  );
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

/** Prida novou kategorii. Automaticky nastavi order na konec. */
export async function addCategory(
  name: string,
  icon: string,
  currentCount: number
): Promise<void> {
  const trimmedName = name.trim();
  if (!trimmedName) return;

  await addDoc(collection(db, COL), {
    name: trimmedName,
    icon: icon.trim() || "🏷️",
    isDefault: false,
    order: currentCount,
  });
}

/**
 * Upravi nazev a/nebo emoji existujici kategorie.
 * Pokud byl zadan oldName a zmenil se nazev, kaskadove zaktualizuje i existujici sluzby.
 */
export async function updateCategory(
  id: string,
  updates: { name?: string; icon?: string },
  oldName?: string
): Promise<void> {
  const newName = updates.name !== undefined ? updates.name.trim() : undefined;
  const newIcon = updates.icon !== undefined ? updates.icon.trim() || "🏷️" : undefined;

  const updatePayload: Record<string, unknown> = {};
  if (newName !== undefined) updatePayload.name = newName;
  if (newIcon !== undefined) updatePayload.icon = newIcon;

  await updateDoc(doc(db, COL, id), updatePayload);

  // Kaskadova aktualizace existujicich sluzeb pri prejmenovani
  if (oldName && newName && oldName !== newName) {
    try {
      const q = query(collection(db, "services"), where("category", "==", oldName));
      const snap = await getDocs(q);
      const batchPromises = snap.docs.map((d) =>
        updateDoc(d.ref, { category: newName })
      );
      await Promise.all(batchPromises);
    } catch (err) {
      console.warn("Chyba pri kaskadove aktualizaci sluzeb:", err);
    }
  }
}

/** Smaze kategorii (vcetne defaultnich - uzivatel muze smazat cokoliv). */
export async function deleteCategory(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id));
}
