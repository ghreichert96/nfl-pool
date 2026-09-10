"use server";

import { redirect } from "next/navigation";

import { passwordSchema } from "@/features/auth/password";
import { createClient } from "@/lib/supabase/server";

export async function setPassword(formData: FormData) {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) redirect("/account/password?error=invalid");

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    console.error("Password update failed", {
      code: error.code,
      message: error.message,
      status: error.status,
    });
    redirect("/account/password?error=update");
  }

  redirect("/settings?password_saved=1");
}
