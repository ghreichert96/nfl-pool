import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getPublicSupabaseEnv } from "@/lib/env";

const serviceRoleSchema = z.string().min(1);

export function createAdminClient() {
  const env = getPublicSupabaseEnv();
  const serviceRoleKey = serviceRoleSchema.parse(
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}
