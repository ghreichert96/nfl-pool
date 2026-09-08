"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCommissioner } from "@/lib/admin";
import { getAppOrigin } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

const userIdSchema = z.string().uuid();

async function permittedUser(formData: FormData) {
  const parsed = userIdSchema.safeParse(formData.get("user_id"));
  if (!parsed.success) redirect("/admin/entrants?error=user");
  const { poolId } = await requireCommissioner();
  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("pool_memberships")
    .select("user_id")
    .eq("pool_id", poolId)
    .eq("user_id", parsed.data)
    .maybeSingle();
  if (!membership) redirect("/admin/entrants?error=access");
  const { data, error } = await admin.auth.admin.getUserById(parsed.data);
  if (error || !data.user?.email) redirect("/admin/entrants?error=account");
  return { admin, email: data.user.email };
}

async function redirectUrl() {
  return `${getAppOrigin((await headers()).get("origin"))}/auth/confirm?next=/account`;
}

export async function sendMagicLink(formData: FormData) {
  const { admin, email } = await permittedUser(formData);
  const { error } = await admin.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: await redirectUrl(), shouldCreateUser: false },
  });
  if (error) redirect("/admin/entrants?error=magic");
  redirect("/admin/entrants?magic_sent=1");
}

export async function sendPasswordReset(formData: FormData) {
  const { admin, email } = await permittedUser(formData);
  const { error } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo: await redirectUrl(),
  });
  if (error) redirect("/admin/entrants?error=reset");
  redirect("/admin/entrants?reset_sent=1");
}
