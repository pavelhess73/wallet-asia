"use server";

import { cookies } from "next/headers";

export async function verifyPassword(
  password: string
): Promise<{ success: boolean; error?: string }> {
  const correctPassword = process.env.APP_PASSWORD;

  if (!correctPassword) {
    console.error("APP_PASSWORD není nastaveno v proměnných prostředí.");
    return { success: false, error: "Chyba konfigurace serveru." };
  }

  if (password.trim() === correctPassword.trim()) {
    const cookieStore = await cookies();
    cookieStore.set("app_auth", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 dní v sekundách (2 592 000 s)
      path: "/",
    });

    return { success: true };
  }

  return { success: false, error: "Nesprávné heslo. Zkuste to znovu." };
}
