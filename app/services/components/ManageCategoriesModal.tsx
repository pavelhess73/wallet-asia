"use client";

import { useState } from "react";
import { ServiceCategory, getServiceCatStyle } from "@/lib/types";
import {
  deleteServiceCategoryFromDb,
  addServiceCategoryToDb,
  updateServiceCategoryInDb,
} from "@/lib/serviceCategories";
import { X, Pencil, Trash2, Plus } from "lucide-react";

interface ManageCategoriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ServiceCategory[];
  setCategories: React.Dispatch<React.SetStateAction<ServiceCategory[]>>;
}

export default function ManageCategoriesModal({
  isOpen,
  onClose,
  categories,
  setCategories,
}: ManageCategoriesModalProps) {
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editOldName, setEditOldName] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1. Reaktivní & optimistické smazání kategorie
  const handleDeleteCategory = async (id: string) => {
    const previousCategories = categories;
    // Optimistické odstranění z UI
    setCategories((prev) => prev.filter((cat) => cat.id !== id));
    setConfirmDelete(null);
    setErrorMsg(null);

    // Skutečné smazání z Firestore / LocalStorage
    try {
      await deleteServiceCategoryFromDb(id);
    } catch (error) {
      console.error("Chyba při mazání kategorie:", error);
      // V případě chyby vrátíme původní stav
      setCategories(previousCategories);
    }
  };

  // 2. Přidání nové kategorie
  const handleAddCategory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const nameToSave = newName.trim();
    if (!nameToSave || busy) return;

    // Kontrola duplicity podle názvu (case-insensitive)
    const exists = categories.some(
      (c) => c.name.trim().toLowerCase() === nameToSave.toLowerCase()
    );
    if (exists) {
      setErrorMsg(`Kategorie "${nameToSave}" již existuje.`);
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    const iconToSave = newIcon.trim() || "🏷️";

    try {
      await addServiceCategoryToDb(nameToSave, iconToSave, categories.length);
      // Poznámka: Nepřidáváme ručně do setCategories – onSnapshot posluchač z Firestore dodá novou položku sám
      setNewName("");
      setNewIcon("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chyba při přidávání kategorie";
      console.error("Chyba při přidávání kategorie:", err);
      setErrorMsg(msg);
    } finally {
      setBusy(false);
    }
  };

  // 3. Zahájení editace
  const startEdit = (cat: ServiceCategory) => {
    setEditId(cat.id);
    setEditName(cat.name);
    setEditOldName(cat.name);
    setEditIcon(cat.icon);
    setConfirmDelete(null);
  };

  // 4. Uložení editace
  const handleSaveEdit = async () => {
    if (!editId || !editName.trim() || busy) return;
    const nameToSave = editName.trim();
    const iconToSave = editIcon.trim() || "🏷️";
    const currentEditId = editId;

    // Kontrola duplicity názvu při přejmenování s jinou existující kategorií
    const exists = categories.some(
      (c) => c.id !== currentEditId && c.name.trim().toLowerCase() === nameToSave.toLowerCase()
    );
    if (exists) {
      setErrorMsg(`Kategorie "${nameToSave}" již existuje.`);
      return;
    }

    setBusy(true);
    setErrorMsg(null);

    // Optimistická aktualizace v UI
    setCategories((prev) =>
      prev.map((c) =>
        c.id === currentEditId ? { ...c, name: nameToSave, icon: iconToSave } : c
      )
    );
    setEditId(null);

    try {
      await updateServiceCategoryInDb(
        currentEditId,
        { name: nameToSave, icon: iconToSave },
        editOldName
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Chyba při úpravě kategorie";
      console.error("Chyba při úpravě kategorie:", err);
      setErrorMsg(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hlavička dialogu */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-base font-black text-slate-900">Spravovat typy služeb</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Přidej, uprav nebo smaž kategorie služeb</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Seznam kategorií */}
        <div className="overflow-y-auto flex-1 px-5 py-3 flex flex-col gap-2">
          {categories.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">
              Žádné kategorie. Přidejte první kategorii níže.
            </p>
          ) : (
            categories.map((cat) => {
              const style = getServiceCatStyle(cat);
              const isEditing = editId === cat.id;
              const isConfirm = confirmDelete === cat.id;

              return (
                <div
                  key={cat.id}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  {isEditing ? (
                    <>
                      <input
                        value={editIcon}
                        onChange={(e) => setEditIcon(e.target.value)}
                        className="w-12 text-center text-xl rounded-xl border border-slate-200 bg-white py-1.5 focus:outline-none focus:border-rose-400"
                        maxLength={4}
                        placeholder="🏷️"
                      />
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveEdit();
                          }
                        }}
                        className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-rose-400 font-medium"
                        placeholder="Název kategorie"
                        autoFocus
                      />
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        disabled={busy || !editName.trim()}
                        className="h-8 px-3 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold disabled:opacity-50 transition-colors shadow-sm"
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(null)}
                        className="h-8 w-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span
                        className={`h-9 w-9 rounded-xl flex items-center justify-center text-lg shrink-0 border ${style.bgColor} ${style.borderColor}`}
                      >
                        {cat.icon}
                      </span>
                      <span className="flex-1 text-sm font-semibold text-slate-800 truncate">
                        {cat.name}
                      </span>
                      {cat.isDefault && (
                        <span className="text-[10px] text-slate-400 shrink-0 font-medium bg-slate-100 px-1.5 py-0.5 rounded-md">
                          výchozí
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => startEdit(cat)}
                        className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition-colors"
                        title="Upravit kategorii"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {isConfirm ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleDeleteCategory(cat.id)}
                            disabled={busy}
                            className="h-7 px-2 rounded-full bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold shadow-sm transition-colors"
                          >
                            Smazat
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(null)}
                            className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(cat.id)}
                          className="h-7 w-7 rounded-full bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors"
                          title="Smazat kategorii"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              );
            })
          )}

          {errorMsg && (
            <p className="text-xs text-rose-500 font-semibold px-2 py-1 bg-rose-50 rounded-lg text-center mt-2">
              {errorMsg}
            </p>
          )}

          {/* Přidání nové kategorie formulářem */}
          <form
            onSubmit={handleAddCategory}
            className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2"
          >
            <input
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              className="w-12 text-center text-xl rounded-xl border border-slate-200 bg-slate-50 py-1.5 focus:outline-none focus:border-rose-400 disabled:opacity-50"
              maxLength={4}
              placeholder="🏷️"
              disabled={busy}
            />
            <input
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-400 disabled:opacity-50"
              placeholder="Nová kategorie…"
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !newName.trim()}
              className="h-8 px-3 rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold disabled:opacity-40 shrink-0 shadow-sm flex items-center justify-center transition-all hover:shadow"
              title="Přidat kategorii"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
