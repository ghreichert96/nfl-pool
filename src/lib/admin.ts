import "server-only";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function requireCommissioner() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const { data: membership } = await supabase
    .from("pool_memberships")
    .select("pool_id")
    .eq("user_id", userId)
    .eq("role", "commissioner")
    .maybeSingle();
  if (!membership) redirect("/");

  return { supabase, poolId: membership.pool_id, userId };
}
