"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCommissioner } from "@/lib/admin";

export async function saveSidePots(formData: FormData) {
  const parsed = z
    .object({
      season_id: z.coerce.number().int().positive(),
      sd_pot: z.coerce.number().min(0).max(100000).multipleOf(0.01),
      ud_pot: z.coerce.number().min(0).max(100000).multipleOf(0.01),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/manage?error=invalid");
  const { supabase } = await requireCommissioner();
  const { error } = await supabase.rpc("save_side_pots", {
    target_season_id: parsed.data.season_id,
    sd_amount: parsed.data.sd_pot,
    ud_amount: parsed.data.ud_pot,
  });
  if (error) redirect("/admin/manage?error=save");
  redirect("/admin/manage?saved=1");
}

export async function saveSdContest(formData: FormData) {
  const parsed = z
    .object({
      contest_id: z.coerce.number().int().positive(),
      strike_limit: z.coerce.number().int().min(1).max(2),
      pot: z.coerce.number().min(0).max(100000).multipleOf(0.01),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/manage?error=invalid");
  const { supabase } = await requireCommissioner();
  const { error } = await supabase.rpc("configure_sd_contest", {
    target_contest_id: parsed.data.contest_id,
    new_strike_limit: parsed.data.strike_limit,
    new_pot: parsed.data.pot,
  });
  if (error) redirect("/admin/manage?error=locked");
  redirect("/admin/manage?saved=1");
}
