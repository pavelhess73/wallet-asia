/**
 * Správa kategorií služeb v Firestore (kolekce service_categories).
 * Zajišťuje:
 * - Jednorázovou inicializaci výchozími kategoriemi (nikdy znovu neseeduje smazané kategorie).
 * - Plnou podporu mazání i úprav pro VŠECHNY kategorie (jak výchozí, tak uživatelské).
 * - Reaktivní onSnapshot synchronizaci s lokální keší v localStorage.
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

export const CATEGORIES_COLLECTION = "service_categories";
const LS_SEEDED_KEY = "service_categories_seeded_v1";
const LS_CACHE_KEY = "service_categories_cache";

/** Smazaná ID v aktuální relaci pro okamžitou ochranu proti návratu z cache */
const pendingDeletedCategoryIds = new Set<string>();

/**
 * Získá kešované kategorie z localStorage pro okamžitý render před připojením DB.
 */
export function getCachedServiceCategories(): ServiceCategory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_CACHE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Uloží aktuální kategorie do localStorage keše.
 */
function updateLocalCategoriesCache(cats: ServiceCategory[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_CACHE_KEY, JSON.stringify(cats));
  } catch (err) {
    console.warn("Chyba při ukládání kategorií do localStorage:", err);
  }
}

/**
 * Inicializuje výchozí kategorie POUZE JEDNOU, pokud je kolekce zcela prázdná
 * a nebyla v minulosti již inicializována.
 * NIKDY znovu neseeduje kategorie, které uživatel smazal.
 */
export async function initDefaultCategoriesIfNeeded(): Promise<void> {
  if (typeof window !== "undefined" && localStorage.getItem(LS_SEEDED_KEY) === "true") {
    return;
  }

  try {
    const snap = await getDocs(collection(db, CATEGORIES_COLLECTION));
    if (!snap.empty) {
      if (typeof window !== "undefined") {
        localStorage.setItem(LS_SEEDED_KEY, "true");
      }
      return;
    }

    // Kolekce je prázdná a nebyla ještě seedována - jednorázový seed
    for (const cat of DEFAULT_SERVICE_CATEGORIES) {
      const docId = `cat_${cat.order}_${cat.name.toLowerCase().replace(/\s+/g, "_")}`;
      await setDoc(doc(db, CATEGORIES_COLLECTION, docId), {
        name: cat.name,
        icon: cat.icon,
        isDefault: false, // Všechny položky jsou nyní plně editovatelné a smazatelné
        order: cat.order ?? 0,
      });
    }

    if (typeof window !== "undefined") {
      localStorage.setItem(LS_SEEDED_KEY, "true");
    }
  } catch (err) {
    console.warn("Chyba při inicializaci kategorií služeb:", err);
  }
}

/**
 * Reaktivní posluchač změn kategorií v Firestore (onSnapshot).
 * Synchronizuje změny do lokální keše i do UI stavu.
 */
export function subscribeToServiceCategories(
  callback: (categories: ServiceCategory[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(collection(db, CATEGORIES_COLLECTION), orderBy("order", "asc"));

  return onSnapshot(
    q,
    (snap) => {
      const seenNames = new Set<string>();
      const categories: ServiceCategory[] = [];

      for (const d of snap.docs) {
        if (pendingDeletedCategoryIds.has(d.id)) {
          continue;
        }

        const data = d.data();
        const rawName = (data.name ?? "").toString().trim();
        const normKey = rawName.toLowerCase();

        // Ochrana proti duplicitním položkám
        if (!rawName || seenNames.has(normKey)) {
          continue;
        }
        seenNames.add(normKey);

        categories.push({
          id: d.id,
          name: rawName,
          icon: (data.icon ?? "🏷️").toString().trim() || "🏷️",
          isDefault: false, // Povolit smazání všech položek
          order: typeof data.order === "number" ? data.order : categories.length,
        });
      }

      updateLocalCategoriesCache(categories);
      callback(categories);
    },
    (err) => {
      console.error("service_categories listener error:", err);
      onError?.(err);
    }
  );
}

/**
 * Trvalé smazání kategorie z Firestore i lokální mezipaměti.
 * Povoleno pro jakoukoliv kategorii (jak výchozí, tak uživatelskou).
 */
export async function deleteServiceCategoryFromDb(
  id: string,
  categoryName?: string
): Promise<void> {
  // Označíme jako inicializované, aby se smazané položky nikdy znovu neseedovaly
  if (typeof window !== "undefined") {
    localStorage.setItem(LS_SEEDED_KEY, "true");
  }

  pendingDeletedCategoryIds.add(id);

  // Aktualizace localStorage keše
  if (typeof window !== "undefined") {
    try {
      const cached = getCachedServiceCategories().filter((c) => c.id !== id);
      updateLocalCategoriesCache(cached);
    } catch (err) {
      console.warn("Chyba při aktualizaci lokální keše kategorií:", err);
    }
  }

  try {
    await deleteDoc(doc(db, CATEGORIES_COLLECTION, id));
  } catch (err) {
    pendingDeletedCategoryIds.delete(id);
    throw err;
  }
}

/**
 * Přidá novou kategorii do Firestore a nastaví pořadí.
 */
export async function addServiceCategoryToDb(
  name: string,
  icon: string,
  currentCount: number
): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Název kategorie nesmí být prázdný");

  if (typeof window !== "undefined") {
    localStorage.setItem(LS_SEEDED_KEY, "true");
  }

  const docRef = await addDoc(collection(db, CATEGORIES_COLLECTION), {
    name: trimmed,
    icon: icon.trim() || "🏷️",
    isDefault: false,
    order: currentCount,
  });

  return docRef.id;
}

/**
 * Upraví název a/nebo emoji kategorie v Firestore.
 * Při přejmenování kaskádově aktualizuje i všechny přiřazené záznamy služeb.
 */
export async function updateServiceCategoryInDb(
  id: string,
  updates: { name?: string; icon?: string },
  oldName?: string
): Promise<void> {
  const newName = updates.name !== undefined ? updates.name.trim() : undefined;
  const newIcon = updates.icon !== undefined ? updates.icon.trim() || "🏷️" : undefined;

  const updatePayload: Record<string, unknown> = {};
  if (newName !== undefined) updatePayload.name = newName;
  if (newIcon !== undefined) updatePayload.icon = newIcon;

  await updateDoc(doc(db, CATEGORIES_COLLECTION, id), updatePayload);

  // Kaskádová aktualizace existujících služeb při přejmenování
  if (oldName && newName && oldName !== newName) {
    try {
      const q = query(collection(db, "services"), where("category", "==", oldName));
      const snap = await getDocs(q);
      const batchPromises = snap.docs.map((d) =>
        updateDoc(d.ref, { category: newName })
      );
      await Promise.all(batchPromises);
    } catch (err) {
      console.warn("Chyba při kaskádové aktualizaci služeb:", err);
    }
  }
}
