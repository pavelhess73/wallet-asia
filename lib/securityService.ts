/**
 * Modul pro zabezpečení sekce Služeb (WebAuthn biometrie + záložní PIN)
 * Umožňuje autentizaci pomocí Face ID / Touch ID / otisku prstu nebo 4místného PIN kódu.
 */

const UNLOCKED_KEY = "services_unlocked_until";
const WEBAUTHN_CRED_KEY = "services_webauthn_cred_id";
const DEFAULT_PIN = "1234";

/**
 * Převede ArrayBuffer na Base64 řetězec
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/**
 * Převede Base64 řetězec na ArrayBuffer
 */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Ověří, zda zařízení podporuje biometrické ověření (Face ID / otisk prstu / Windows Hello)
 */
export async function isBiometricsAvailable(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential) {
    return false;
  }

  try {
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return Boolean(available);
    }
  } catch (err) {
    console.warn("Chyba při ověřování biometrie zařízení:", err);
  }

  return false;
}

/**
 * Spustí biometrické ověření přes WebAuthn API.
 * Pokud je již klíč uložen, provede ověření (get).
 * Pokud ještě klíč neexistuje, vytvoří platformový biometrický klíč (create).
 * Vrací true při úspěchu, false při neúspěchu nebo zrušení uživatelem.
 */
export async function authenticateWithBiometrics(): Promise<boolean> {
  if (typeof window === "undefined" || !window.PublicKeyCredential || !navigator.credentials) {
    return false;
  }

  try {
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    const savedCredId = localStorage.getItem(WEBAUTHN_CRED_KEY);

    // 1. Pokud již máme uložený credential ID, zkusíme standardní ověření (navigator.credentials.get)
    if (savedCredId) {
      try {
        const credentialIdBuffer = base64ToBuffer(savedCredId);
        const assertion = await navigator.credentials.get({
          publicKey: {
            challenge,
            allowCredentials: [
              {
                type: "public-key",
                id: credentialIdBuffer,
              },
            ],
            userVerification: "required",
            timeout: 60000,
          },
        });

        if (assertion) {
          return true;
        }
      } catch (getErr) {
        console.warn("Výzva credentials.get selhala, pokus o novou registraci:", getErr);
        // Pokud byl uložený klíč neplatný, pokračujeme k nové registraci
      }
    }

    // 2. Pokud klíč ještě nemáme nebo předchozí get selhal, zaregistrujeme platformový klíč
    const rp: PublicKeyCredentialRpEntity = {
      name: "Asia Travel Wallet",
    };

    if (window.location.hostname && window.location.hostname !== "") {
      const isIp = /^(\d{1,3}\.){3}\d{1,3}$/.test(window.location.hostname);
      if (!isIp) {
        rp.id = window.location.hostname;
      }
    }

    const newCred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp,
        user: {
          id: Uint8Array.from([1, 8, 4, 3, 9, 2]),
          name: "traveler",
          displayName: "Traveler",
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required",
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null;

    if (newCred && newCred.rawId) {
      const rawIdBase64 = bufferToBase64(newCred.rawId);
      localStorage.setItem(WEBAUTHN_CRED_KEY, rawIdBase64);
      return true;
    }

    return false;
  } catch (error) {
    // Uživatel stiskl zrušit, vypršel limit nebo zařízení nepodporuje
    console.info("Biometrické ověření nebylo dokončeno:", error);
    return false;
  }
}

/**
 * Porovná zadaný PIN s nakonfigurovaným nebo výchozím PIN kódem
 */
export function verifyPIN(enteredPin: string): boolean {
  const configuredPin = process.env.NEXT_PUBLIC_SERVICES_PIN || DEFAULT_PIN;
  return enteredPin.trim() === configuredPin.trim();
}

/**
 * Uloží timestamp odemčení do sessionStorage (výchozí 30 minut)
 */
export function setServicesUnlocked(durationMinutes: number = 30): void {
  if (typeof window === "undefined") return;
  const expiry = Date.now() + durationMinutes * 60 * 1000;
  try {
    sessionStorage.setItem(UNLOCKED_KEY, expiry.toString());
  } catch (e) {
    console.warn("Chyba při ukládání odemčení do sessionStorage:", e);
  }
}

/**
 * Zkontroluje, zda je sekce služeb aktuálně odemčena
 */
export function isServicesUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const item = sessionStorage.getItem(UNLOCKED_KEY);
    if (!item) return false;
    const expiry = parseInt(item, 10);
    if (isNaN(expiry) || Date.now() > expiry) {
      sessionStorage.removeItem(UNLOCKED_KEY);
      return false;
    }
    return true;
  } catch (e) {
    console.warn("Chyba při čtení sessionStorage:", e);
    return false;
  }
}

/**
 * Okamžitě uzamkne sekci služeb
 */
export function lockServices(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(UNLOCKED_KEY);
  } catch (e) {
    console.warn("Chyba při zamykání sekce:", e);
  }
}
