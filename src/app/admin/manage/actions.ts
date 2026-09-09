"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCommissioner } from "@/lib/admin";

const ruleSchema = z.object({
  id: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(600),
  detail: z.string().trim().max(600),
});

export async function saveRuleSection(formData: FormData) {
  const parsed = ruleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/admin/manage?error=invalid");
  const { supabase, poolId, userId } = await requireCommissioner();
  const { data: current } = await supabase
    .from("rule_sections")
    .select("id, revision")
    .eq("id", parsed.data.id)
    .eq("pool_id", poolId)
    .maybeSingle();
  if (!current) redirect("/admin/manage?error=access");
  const { error } = await supabase
    .from("rule_sections")
    .update({
      title: parsed.data.title,
      summary: parsed.data.summary,
      detail: parsed.data.detail,
      revision: current.revision + 1,
      updated_by: userId,
    })
    .eq("id", current.id);
  if (error) redirect("/admin/manage?error=save");
  await supabase.from("commissioner_audit_events").insert({
    pool_id: poolId,
    actor_id: userId,
    action: "rule_section_published",
    entity_type: "rule_section",
    entity_id: String(current.id),
    details: { revision: current.revision + 1 },
  });
  redirect("/admin/manage?saved=1");
}
