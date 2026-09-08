"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const settingsSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
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
    displayName: formData.get("display_name"),
    entryCode: formData.get("entry_code"),
    email: formData.get("email"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) redirect("/settings?error=invalid");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  const [{ error: profileError }, { error: entryError }, { error: authError }] =
    await Promise.all([
      supabase.from("profiles").upsert({
        id: userId,
        display_name: parsed.data.displayName,
        phone_e164: parsed.data.phone,
      }),
      supabase
        .from("pool_entries")
        .update({ entry_code: parsed.data.entryCode })
        .eq("user_id", userId),
      supabase.auth.updateUser({ email: parsed.data.email }),
    ]);
  if (profileError || entryError || authError) redirect("/settings?error=save");
  redirect("/settings?saved=1");
}

export async function updateProfile(formData: FormData) {
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!displayName || displayName.length > 80)
    redirect("/account?error=profile");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, display_name: displayName });
  if (error) redirect("/account?error=profile");
  redirect("/account?saved=1");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
