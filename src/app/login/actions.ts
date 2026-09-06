"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().email().max(254);

export async function requestMagicLink(formData: FormData) {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) redirect("/login?error=invalid-email");

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") ?? "http://127.0.0.1:3008";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/`,
      shouldCreateUser: false,
    },
  });

  if (error) redirect("/login?error=unavailable");
  redirect("/login?sent=1");
}
