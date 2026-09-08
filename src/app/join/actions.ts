"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { passwordSchema } from "@/features/auth/password";
import { createClient } from "@/lib/supabase/server";

const joinSchema = passwordSchema.and(
  z.object({
    invitationId: z.string().uuid(),
    entryCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3,4}$/),
  }),
);

export async function acceptInvitation(formData: FormData) {
  const parsed = joinSchema.safeParse({
    invitationId: formData.get("invitation_id"),
    entryCode: formData.get("entry_code"),
    password: formData.get("password"),
    confirmation: formData.get("confirmation"),
  });
  if (!parsed.success)
    redirect(`/join?id=${formData.get("invitation_id") ?? ""}&error=invalid`);

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect("/login");

  const { error: passwordError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (passwordError)
    redirect(`/join?id=${parsed.data.invitationId}&error=password`);

  const { error } = await supabase.rpc("accept_pool_invitation", {
    invitation_id: parsed.data.invitationId,
    requested_entry_code: parsed.data.entryCode,
  });
  if (error) redirect(`/join?id=${parsed.data.invitationId}&error=claim`);
  redirect("/?joined=1");
}
