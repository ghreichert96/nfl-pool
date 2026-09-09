import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function getPoolContext() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) redirect("/login");

  const [{ data: entry }, { data: membership }, { data: profile }] =
    await Promise.all([
      supabase
        .from("pool_entries")
        .select("id, entry_code, season_id")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("pool_memberships")
        .select("pool_id, role")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("display_name")
        .eq("id", userId)
        .maybeSingle(),
    ]);

  return {
    supabase,
    userId,
    email: typeof claims?.claims?.email === "string" ? claims.claims.email : "",
    entry,
    profile,
    membership,
    isCommissioner: membership?.role === "commissioner",
  };
}
