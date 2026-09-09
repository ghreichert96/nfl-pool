"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const settingsSchema = z.object({
  entryCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3,4}$/),
  email: z.string().trim().email().max(254),
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9][0-9]{7,14}$/),
});

export async function updateSettings(formData: FormData) {
  const parsed = settingsSchema.safeParse({
    entryCode: formData.get("entry_code"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) redirect("/settings?error=invalid");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  const { error: settingsError } = await supabase.rpc(
    "update_own_entry_settings",
    {
      requested_entry_code: parsed.data.entryCode,
      requested_phone: parsed.data.phone,
    },
  );
  if (settingsError) redirect("/settings?error=save");
  const currentEmail =
    typeof data?.claims?.email === "string" ? data.claims.email : "";
  if (parsed.data.email.toLowerCase() !== currentEmail.toLowerCase()) {
    const { error: authError } = await supabase.auth.updateUser({
      email: parsed.data.email,
    });
    if (authError) redirect("/settings?error=email");
  }
  redirect("/settings?saved=1");
}

export async function updateProfile(formData: FormData) {
  const entryCode = String(formData.get("entry_code") ?? "")
    .trim()
    .toUpperCase();
  if (!/^[A-Z]{3,4}$/.test(entryCode)) redirect("/account?error=profile");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  const { error } = await supabase.rpc("update_own_entry_settings", {
    requested_entry_code: entryCode,
  });
  if (error) redirect("/account?error=profile");
  redirect("/account?saved=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
