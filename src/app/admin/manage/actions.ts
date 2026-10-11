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
