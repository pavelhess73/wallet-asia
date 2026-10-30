/**
 * Firestore store pro:
 * 1. Služby (services collection) - záznamy o využitých službách na cestách
 * 2. Kategorie služeb (re-export z @/lib/serviceCategories)
 * 
 * Využívá reaktivní onSnapshot posluchače s offline IndexedDB persistencí.
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
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ServiceEntry } from "@/lib/types";

const SERVICES_COL = "services";

// ─── SERVICES: Real-time listener & CRUD ─────────────────────────────────────

/**
 * Množina ID záznamů smazaných v této relaci.
 * Zabraňuje probliknutí/znovuzobrazení položky při opožděné odezvě IndexedDB / multi-tab cache.
 */
const pendingDeletedServiceIds = new Set<string>();

/**
 * Přihlásí se k odběru záznamů služeb v reálném čase (onSnapshot).
 * Při jakékoliv změně v databázi (přidání, úprava, smazání) automaticky
 * vrátí aktualizovaný seznam dokumentů.
 * Vrátí unsubscribe funkci pro cleanup v useEffect.
 */
export function subscribeToServices(
  callback: (services: ServiceEntry[]) => void,
  onError?: (err: Error) => void
): () => void {
  const q = query(collection(db, SERVICES_COL), orderBy("createdAt", "desc"));

  return onSnapshot(
    q,
    (snap) => {
      const services: ServiceEntry[] = [];

      for (const d of snap.docs) {
        // Pokud byla položka smazána lokálně, přeskočíme ji
        if (pendingDeletedServiceIds.has(d.id)) {
          continue;
        }

        const data = d.data();
        services.push({
          id: d.id,
          name: (data.name ?? "").toString(),
          location: (data.location ?? "").toString(),
          category: (data.category ?? "Jiné").toString(),
          items: Array.isArray(data.items) ? data.items : [],
          price: Number(data.price) || 0,
          currency: (data.currency ?? "THB").toString(),
          rating: Number(data.rating) || 5,
          note: data.note ? data.note.toString() : undefined,
          createdAt: data.createdAt ? data.createdAt.toString() : new Date().toISOString(),
          paymentMethod: data.paymentMethod === "card" ? "card" : "cash",
        });
      }

      callback(services);
    },
    (err) => {
      console.error("services listener error:", err);
      onError?.(err);
    }
  );
}

/**
 * Trvale smaže službu z Firestore a okamžitě ji zablokuje proti
 * opětnému načtení z lokální keše.
 */
export async function deleteService(id: string): Promise<void> {
  pendingDeletedServiceIds.add(id);
  try {
    await deleteDoc(doc(db, SERVICES_COL, id));
  } catch (err) {
    pendingDeletedServiceIds.delete(id);
    throw err;
  }
}

/**
 * Pomocná funkce pro sanitizaci objektu proti undefined hodnotám před odesláním do Firestore.
 */
function sanitizeData<T extends Record<string, any>>(data: T): Record<string, any> {
  return Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
  );
}

/**
 * Přidá nový záznam služby do Firestore.
 */
export async function addService(
  entry: Omit<ServiceEntry, "id">
): Promise<string> {
  const serviceData = {
    ...entry,
    paymentMethod: entry.paymentMethod || "cash",
    note: entry.note ? entry.note.trim() : "",
  };
  const sanitized = sanitizeData(serviceData);
  const docRef = await addDoc(collection(db, SERVICES_COL), sanitized);
  return docRef.id;
}

/**
 * Aktualizuje existující záznam služby ve Firestore.
 */
export async function updateService(
  id: string,
  updates: Partial<Omit<ServiceEntry, "id">>
): Promise<void> {
  const cleanUpdates: Record<string, any> = { ...updates };
  if ("note" in updates) {
    cleanUpdates.note = updates.note ? updates.note.trim() : "";
  }
  if ("paymentMethod" in updates) {
    cleanUpdates.paymentMethod = updates.paymentMethod || "cash";
  }
  const sanitized = sanitizeData(cleanUpdates);
  await updateDoc(doc(db, SERVICES_COL, id), sanitized);
}

// ─── CATEGORIES: Forwarded from @/lib/serviceCategories ──────────────────────

export {
  initDefaultCategoriesIfNeeded as seedDefaultCategoriesIfEmpty,
  subscribeToServiceCategories as subscribeToCategories,
  addServiceCategoryToDb as addCategory,
  updateServiceCategoryInDb as updateCategory,
  deleteServiceCategoryFromDb as deleteCategory,
  deleteServiceCategoryFromDb,
  addServiceCategoryToDb,
  updateServiceCategoryInDb,
  subscribeToServiceCategories,
  initDefaultCategoriesIfNeeded,
  getCachedServiceCategories,
} from "@/lib/serviceCategories";
