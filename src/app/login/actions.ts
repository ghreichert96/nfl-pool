"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAppOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().email().max(254);
const passwordLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(6).max(128),
});

export async function signInWithPassword(formData: FormData) {
  const parsed = passwordLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirect("/login?error=invalid-credentials");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

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
      shouldCreateUser: true,
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
