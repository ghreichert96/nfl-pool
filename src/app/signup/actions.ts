"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { passwordSchema } from "@/features/auth/password";
import { phoneSchema } from "@/features/auth/phone";
import { getAppOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

const signupSchema = passwordSchema.and(
  z.object({
    email: z.string().trim().email().max(254),
    phone: phoneSchema,
    entryCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3,4}$/),
  }),
);

export async function signUp(formData: FormData) {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    phone: formData.get("phone"),
    entryCode: formData.get("entry_code"),
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) redirect("/signup?error=invalid");

  const origin = getAppOrigin((await headers()).get("origin"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=/`,
      data: {
        hppp_public_signup: true,
        entry_code: parsed.data.entryCode,
        phone_e164: parsed.data.phone,
      },
    },
  });

  if (error) {
    console.error("Public signup failed", {
      code: error.code,
      status: error.status,
    });
    redirect("/signup?error=unavailable");
  }
  if (data.session) redirect("/");
  redirect("/signup?sent=1");
}
