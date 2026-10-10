"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { verifyPassword } from "@/app/actions/auth";
import {
  Lock,
  KeyRound,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Wallet,
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await verifyPassword(password);

      if (result.success) {
        // Po úspěšném přihlášení přesměrovat na hlavní stránku
        router.push("/");
        router.refresh();
      } else {
        setErrorMessage(result.error || "Nesprávné heslo.");
      }
    } catch (err) {
      console.error("Chyba při přihlašování:", err);
      setErrorMessage("Došlo k neočekávané chybě. Zkuste to znovu.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden antialiased selection:bg-emerald-500/30">
      {/* Dekorativní ambientní záře */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[350px] bg-emerald-500/10 blur-[140px] rounded-full" />
        <div className="absolute -bottom-20 right-1/4 w-[350px] h-[300px] bg-cyan-500/10 blur-[130px] rounded-full" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-7 sm:p-9 backdrop-blur-2xl shadow-2xl shadow-black/80">
          {/* Hlavička s ikonou */}
          <div className="flex flex-col items-center text-center mb-8">
            <div className="relative mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 shadow-xl shadow-emerald-500/25">
                <Wallet className="h-8 w-8 stroke-[2.2]" />
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 border border-white/10 text-emerald-400 shadow">
                <Lock className="h-3 w-3 stroke-[2.5]" />
              </div>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-white">
              Asia Travel Wallet
            </h1>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-400 max-w-xs">
              Aplikace je chráněna heslem. Zadejte přístupový kód pro odemknutí.
            </p>
          </div>

          {/* Chybová zpráva */}
          {errorMessage && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-rose-300 text-xs sm:text-sm backdrop-blur-md animate-shake">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Formulář */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Přístupové heslo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <KeyRound className="h-4 w-4" />
                </div>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoFocus
                  disabled={isLoading}
                  placeholder="Zadejte heslo..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/[0.05] pl-10 pr-11 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-emerald-500/50 focus:bg-white/[0.08] focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition"
                  tabIndex={-1}
                  aria-label={showPassword ? "Skrýt heslo" : "Zobrazit heslo"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-400 px-6 py-3.5 text-sm sm:text-base font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition-all hover:opacity-95 hover:shadow-emerald-500/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Ověřuji heslo...</span>
                </>
              ) : (
                <span>Odemknout Peněženku</span>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
