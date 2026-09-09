"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAppOrigin } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().email().max(254);
const passwordLoginSchema = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(6).max(128),
});

export async function signInWithPassword(formData: FormData) {
  const parsed = passwordLoginSchema.safeParse({
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect("/login?error=invalid-credentials");

  let email = parsed.data.identifier.toLowerCase();
  if (!emailSchema.safeParse(email).success) {
    const entryCode = parsed.data.identifier.toUpperCase();
    if (!/^[A-Z]{3,4}$/.test(entryCode))
      redirect("/login?error=invalid-credentials");
    const admin = createAdminClient();
    const { data: entry } = await admin
      .from("pool_entries")
      .select("user_id, seasons!inner(year)")
      .eq("entry_code", entryCode)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!entry) redirect("/login?error=invalid-credentials");
    const { data } = await admin.auth.admin.getUserById(entry.user_id);
    if (!data.user?.email) redirect("/login?error=invalid-credentials");
    email = data.user.email;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  });

  if (error) redirect("/login?error=invalid-credentials");
  redirect("/");
}

export async function requestMagicLink(formData: FormData) {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) redirect("/login?error=invalid-email");

  const requestHeaders = await headers();
  const origin = getAppOrigin(requestHeaders.get("origin"));
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/`,
      shouldCreateUser: false,
    },
  });

  if (error) {
    console.error("Magic-link request failed", {
      code: error.code,
      message: error.message,
      status: error.status,
    });
    redirect("/login?error=unavailable");
  }
  redirect("/login?sent=1");
}

export async function requestPasswordReset(formData: FormData) {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) redirect("/login?error=invalid-email");

  const requestHeaders = await headers();
  const origin = getAppOrigin(requestHeaders.get("origin"));
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${origin}/auth/confirm?next=/account/password`,
  });

  if (error) {
    console.error("Password-recovery request failed", {
      code: error.code,
      message: error.message,
      status: error.status,
    });
    redirect("/login?error=recovery-unavailable");
  }
  redirect("/login?recovery_sent=1");
}
