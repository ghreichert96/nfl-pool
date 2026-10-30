import type { SupabaseClient } from "@supabase/supabase-js";
export type SdEligibility = {
  contestId: number | null;
  label: string;
  unavailable: boolean;
  strikes: number;
  strikeLimit: number;
  usedTeams: string[];
};
export async function loadSdEligibility(
  client: SupabaseClient,
  entryId: number,
  weekId: number,
): Promise<SdEligibility> {
  const { data, error } = await client.rpc("sd_eligibility", {
    target_entry_id: entryId,
    target_week_id: weekId,
  });
  if (error) throw error;
  return data as SdEligibility;
}
