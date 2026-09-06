"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAppOrigin } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const inviteSchema = z.object({
  email: z.string().trim().email().max(254),
  entryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{3,4}$/),
});

export async function inviteEntry(formData: FormData) {
  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    entryCode: formData.get("entry_code"),
  });

  if (!parsed.success) redirect("/admin?error=invalid");

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");

  const { data: commissioner } = await supabase
    .from("pool_memberships")
    .select("pool_id")
    .eq("user_id", claims.claims.sub)
    .eq("role", "commissioner")
    .maybeSingle();

  if (!commissioner) redirect("/");

  const admin = createAdminClient();
  const { data: pool } = await admin
    .from("pools")
    .select("id")
    .eq("id", commissioner.pool_id)
    .maybeSingle();
  const { data: season } = await admin
    .from("seasons")
    .select("id, status")
    .eq("pool_id", commissioner.pool_id)
    .eq("year", 2026)
    .maybeSingle();

  if (!pool || !season || !["setup", "open"].includes(season.status)) {
    redirect("/admin?error=closed");
  }

  const { data: existingCode } = await admin
    .from("pool_entries")
    .select("id")
    .eq("season_id", season.id)
    .eq("entry_code", parsed.data.entryCode)
    .maybeSingle();
  if (existingCode) redirect("/admin?error=duplicate");

  const requestOrigin = (await headers()).get("origin");
  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      redirectTo: `${getAppOrigin(requestOrigin)}/auth/confirm?next=/account`,
      data: { entry_code: parsed.data.entryCode },
    });

  if (inviteError || !invited.user) redirect("/admin?error=invite");

  const { error: provisionError } = await admin.rpc(
    "provision_invited_entry",
    {
      target_user_id: invited.user.id,
      target_pool_id: commissioner.pool_id,
      target_season_id: season.id,
      target_entry_code: parsed.data.entryCode,
    },
  );

  if (provisionError) redirect("/admin?error=provision");
  redirect("/admin?sent=1");
}
