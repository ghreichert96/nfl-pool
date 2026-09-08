"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCommissioner } from "@/lib/admin";
import { getAppOrigin } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

const userIdSchema = z.string().uuid();
const entryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{3,4}$/);

export async function updateEntrantCode(formData: FormData) {
  const code = entryCodeSchema.safeParse(formData.get("entry_code"));
  const entryId = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(formData.get("entry_id"));
  if (!code.success || !entryId.success)
    redirect("/admin/entrants?error=entry");
  const { supabase, poolId, userId } = await requireCommissioner();
  const { data: entry } = await supabase
    .from("pool_entries")
    .select("id, entry_code, seasons!inner(pool_id)")
    .eq("id", entryId.data)
    .eq("seasons.pool_id", poolId)
    .maybeSingle();
  if (!entry) redirect("/admin/entrants?error=access");
  const { error } = await supabase
    .from("pool_entries")
    .update({ entry_code: code.data })
    .eq("id", entry.id);
  if (error) redirect("/admin/entrants?error=duplicate");
  await supabase.from("commissioner_audit_events").insert({
    pool_id: poolId,
    actor_id: userId,
    action: "entrant_code_changed",
    entity_type: "pool_entry",
    entity_id: String(entry.id),
    details: { from: entry.entry_code, to: code.data },
  });
  redirect("/admin/entrants?entry_saved=1");
}

export async function resendInvitation(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("invitation_id"));
  if (!id.success) redirect("/admin/entrants?error=invite");
  const { poolId } = await requireCommissioner();
  const admin = createAdminClient();
  const { data: invitation } = await admin
    .from("pool_invitations")
    .select("id, email")
    .eq("id", id.data)
    .eq("pool_id", poolId)
    .eq("status", "pending")
    .maybeSingle();
  if (!invitation) redirect("/admin/entrants?error=invite");
  const origin = getAppOrigin((await headers()).get("origin"));
  const { error } = await admin.auth.signInWithOtp({
    email: invitation.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(`/join?id=${invitation.id}`)}`,
    },
  });
  if (error) redirect("/admin/entrants?error=invite");
  await admin
    .from("pool_invitations")
    .update({ expires_at: new Date(Date.now() + 7 * 86400000).toISOString() })
    .eq("id", invitation.id);
  redirect("/admin/entrants?invite_resent=1");
}

async function permittedUser(formData: FormData) {
  const parsed = userIdSchema.safeParse(formData.get("user_id"));
  if (!parsed.success) redirect("/admin/entrants?error=user");
  const { poolId, userId: actorId } = await requireCommissioner();
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
  return {
    admin,
    email: data.user.email,
    poolId,
    targetUserId: parsed.data,
    actorId,
  };
}

async function redirectUrl(next: "/account" | "/account/password") {
  return `${getAppOrigin((await headers()).get("origin"))}/auth/confirm?next=${next}`;
}

export async function sendMagicLink(formData: FormData) {
  const { admin, email } = await permittedUser(formData);
  const { error } = await admin.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: await redirectUrl("/account"),
      shouldCreateUser: false,
    },
  });
  if (error) redirect("/admin/entrants?error=magic");
  redirect("/admin/entrants?magic_sent=1");
}

export async function sendPasswordReset(formData: FormData) {
  const { admin, email } = await permittedUser(formData);
  const { error } = await admin.auth.resetPasswordForEmail(email, {
    redirectTo: await redirectUrl("/account/password"),
  });
  if (error) redirect("/admin/entrants?error=reset");
  redirect("/admin/entrants?reset_sent=1");
}

export type RecoveryLinkState = {
  ok: boolean;
  link?: string;
  message?: string;
};

export async function createRecoveryLink(
  _previousState: RecoveryLinkState,
  formData: FormData,
): Promise<RecoveryLinkState> {
  const { admin, email, poolId, targetUserId, actorId } =
    await permittedUser(formData);
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: await redirectUrl("/account/password") },
  });
  if (error || !data.properties.action_link)
    return { ok: false, message: "Recovery link could not be created." };

  const { error: auditError } = await admin
    .from("commissioner_audit_events")
    .insert({
      pool_id: poolId,
      actor_id: actorId,
      action: "entrant_recovery_link_created",
      entity_type: "auth_user",
      entity_id: targetUserId,
      details: { delivery: "commissioner_copy" },
    });
  if (auditError)
    return { ok: false, message: "Recovery action could not be audited." };

  return {
    ok: true,
    link: data.properties.action_link,
    message: "Copy this link now. It is not stored by the pool.",
  };
}
