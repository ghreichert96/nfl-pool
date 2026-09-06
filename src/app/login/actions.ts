"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAppOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().email().max(254);

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

  if (error) redirect("/login?error=unavailable");
  redirect("/login?sent=1");
}
