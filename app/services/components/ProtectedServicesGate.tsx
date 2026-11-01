'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Lock,
  Fingerprint,
  KeyRound,
  ArrowLeft,
  ShieldAlert,
  AlertCircle,
} from "lucide-react";
import {
  isBiometricsAvailable,
  authenticateWithBiometrics,
  verifyPIN,
  setServicesUnlocked,
  isServicesUnlocked,
  lockServices,
} from "@/lib/securityService";

interface ServicesSecurityContextType {
  isUnlocked: boolean;
  lock: () => void;
}

const ServicesSecurityContext = createContext<ServicesSecurityContextType>({
  isUnlocked: false,
  lock: () => {},
});

export const useServicesSecurity = () => useContext(ServicesSecurityContext);

interface ProtectedServicesGateProps {
  children: React.ReactNode;
}

export default function ProtectedServicesGate({ children }: ProtectedServicesGateProps) {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [isReady, setIsReady] = useState<boolean>(false);
  const [hasBiometrics, setHasBiometrics] = useState<boolean>(false);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [showPinInput, setShowPinInput] = useState<boolean>(false);
  const [pin, setPin] = useState<string>("");
  const [pinError, setPinError] = useState<string>("");
  const [isShaking, setIsShaking] = useState<boolean>(false);

  const pinInputRef = useRef<HTMLInputElement>(null);
  const autoAuthTriggered = useRef<boolean>(false);

  // Inicializace stavu odemčení a biometrie
  useEffect(() => {
    const checkState = async () => {
      const unlocked = isServicesUnlocked();
      if (unlocked) {
        setIsUnlocked(true);
        setIsReady(true);
        return;
      }

      const biometricsSupported = await isBiometricsAvailable();
      setHasBiometrics(biometricsSupported);
      setIsReady(true);

      // Pokud je biometrie dostupná, automaticky vyvolat ověření
      if (biometricsSupported && !autoAuthTriggered.current) {
        autoAuthTriggered.current = true;
        triggerBiometrics();
      } else if (!biometricsSupported) {
        setShowPinInput(true);
      }
    };

    checkState();
  }, []);

  // Fokus na PIN pole při přepnutí na PIN
  useEffect(() => {
    if (showPinInput && pinInputRef.current) {
      setTimeout(() => {
        pinInputRef.current?.focus();
      }, 100);
    }
  }, [showPinInput]);

  // Vyvolání biometrického ověření
  const triggerBiometrics = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setPinError("");

    try {
      const success = await authenticateWithBiometrics();
      if (success) {
        setServicesUnlocked(30);
        setIsUnlocked(true);
      }
    } catch (e) {
      console.warn("Chyba při biometrii:", e);
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Zpracování změny PIN kódu
  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 4);
    setPin(val);
    setPinError("");

    // Automatické ověření po zadání 4. číslice
    if (val.length === 4) {
      if (verifyPIN(val)) {
        setServicesUnlocked(30);
        setIsUnlocked(true);
      } else {
        setIsShaking(true);
        setPinError("Nesprávný PIN kód");
        setTimeout(() => {
          setIsShaking(false);
          setPin("");
        }, 600);
      }
    }
  };

  // Ruční uzamčení
  const handleLock = () => {
    lockServices();
    setIsUnlocked(false);
    setPin("");
    setPinError("");
    autoAuthTriggered.current = false;
  };

  // SSR a počáteční načítání
  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#F8F6F4] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-rose-500" />
      </div>
    );
  }

  // Pokud je odemčeno, vykreslíme obsah stránky
  if (isUnlocked) {
    return (
      <ServicesSecurityContext.Provider value={{ isUnlocked: true, lock: handleLock }}>
        {children}
      </ServicesSecurityContext.Provider>
    );
  }

  // Zamykací obrazovka (Lock screen)
  return (
    <ServicesSecurityContext.Provider value={{ isUnlocked: false, lock: handleLock }}>
      <div className="min-h-screen bg-[#F8F6F4] flex flex-col justify-between px-4 py-8 sm:py-12 select-none">
        {/* Horní prvek / Odkaz zpět */}
        <div className="max-w-md w-full mx-auto">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors py-2 px-3 rounded-full bg-white/80 border border-slate-200/80 shadow-xs"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Zpět do peněženky</span>
          </Link>
        </div>

        {/* Hlavní obsah zámku */}
        <div className="max-w-sm w-full mx-auto text-center flex flex-col items-center">
          {/* Ikona zámku / štítu */}
          <div className="relative mb-6">
            <div className="h-24 w-24 rounded-3xl bg-gradient-to-tr from-rose-500/20 to-pink-500/10 border border-rose-200/60 flex items-center justify-center shadow-lg shadow-rose-500/10">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center text-white shadow-md shadow-rose-500/30">
                {showPinInput ? (
                  <KeyRound className="h-8 w-8 stroke-[2.2]" />
                ) : (
                  <Fingerprint className="h-9 w-9 stroke-[2]" />
                )}
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-md">
              <Lock className="h-3.5 w-3.5 stroke-[2.5]" />
            </div>
          </div>

          {/* Nadpis a popis */}
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-2">
            Chráněná sekce Služeb
          </h1>
          <p className="text-xs text-slate-500 max-w-xs leading-relaxed mb-8">
            Pro zobrazení citlivých údajů ubytování a kontaktů potvrďte svou identitu.
          </p>

          {/* Ověřovací blok */}
          {!showPinInput ? (
            <div className="w-full flex flex-col gap-3">
              {hasBiometrics ? (
                <button
                  type="button"
                  onClick={triggerBiometrics}
                  disabled={isAuthenticating}
                  className="w-full h-13 rounded-2xl bg-gradient-to-r from-rose-500 via-rose-600 to-pink-600 text-white font-bold text-sm tracking-wide shadow-lg shadow-rose-500/25 hover:shadow-rose-500/40 active:scale-98 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
                >
                  <Fingerprint className="h-5 w-5" />
                  <span>
                    {isAuthenticating ? "Ověřuji…" : "Odemknout otiskem / Face ID"}
                  </span>
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setShowPinInput(true)}
                className="w-full h-12 rounded-2xl bg-white border border-slate-200/90 text-slate-700 font-bold text-xs hover:bg-slate-50 active:scale-98 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
              >
                <KeyRound className="h-4 w-4 text-slate-500" />
                <span>Zadat záložní PIN kód</span>
              </button>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center">
              {/* Skrytý formulářový input pro mobilní klávesnici */}
              <input
                ref={pinInputRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={pin}
                onChange={handlePinChange}
                className="opacity-0 absolute -z-10 pointer-events-none"
                autoComplete="off"
                aria-label="4místný PIN kód"
              />

              {/* Vizuální tečky pro PIN */}
              <div
                onClick={() => pinInputRef.current?.focus()}
                className={`flex items-center gap-4 py-4 px-6 rounded-2xl bg-white border cursor-pointer transition-all ${
                  pinError
                    ? "border-red-300 ring-2 ring-red-400/20"
                    : "border-slate-200/90 shadow-sm"
                } ${isShaking ? "animate-bounce" : ""}`}
              >
                {[0, 1, 2, 3].map((idx) => {
                  const isFilled = pin.length > idx;
                  return (
                    <div
                      key={idx}
                      className={`h-4 w-4 rounded-full transition-all duration-150 ${
                        isFilled
                          ? "bg-rose-500 scale-110 shadow-xs shadow-rose-500/40"
                          : "bg-slate-200"
                      }`}
                    />
                  );
                })}
              </div>

              {/* Chybová zpráva */}
              {pinError ? (
                <div className="flex items-center gap-1.5 text-xs text-red-500 font-bold mt-3 animate-in fade-in">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{pinError}</span>
                </div>
              ) : (
                <p
                  onClick={() => pinInputRef.current?.focus()}
                  className="text-[11px] text-slate-400 font-medium mt-3 cursor-pointer"
                >
                  Klepnutím zadejte 4místný PIN
                </p>
              )}

              {/* Tlačítka pod PINem */}
              <div className="w-full flex flex-col gap-2.5 mt-6">
                {hasBiometrics && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowPinInput(false);
                      setPin("");
                      setPinError("");
                    }}
                    className="w-full h-11 rounded-2xl bg-white border border-slate-200/90 text-slate-700 font-bold text-xs hover:bg-slate-50 active:scale-98 transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Fingerprint className="h-4 w-4 text-rose-500" />
                    <span>Použít biometrii</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Spodní bezpečnostní poznámka */}
        <div className="max-w-md w-full mx-auto text-center">
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldAlert className="h-3 w-3 text-slate-400" />
            <span>Odemčení zůstává aktivní po dobu 30 minut</span>
          </p>
        </div>
      </div>
    </ServicesSecurityContext.Provider>
  );
}
