"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const editSchema = z.union([
  z.object({ locked: z.boolean() }),
  z.object({
    spread: z.number().min(-99).max(99).multipleOf(0.5),
    total: z.number().min(0.5).max(999).multipleOf(0.5),
    updatedAt: z.iso.datetime({ offset: true }),
  }),
]);

export async function editPregameLine(
  gameId: number,
  edit: z.input<typeof editSchema>,
) {
  const parsed = editSchema.safeParse(edit);
  if (!Number.isSafeInteger(gameId) || gameId < 1 || !parsed.success) {
    return { ok: false, message: "Invalid line change." };
  }

  const value = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("edit_pregame_line", {
    target_game_id: gameId,
    ...("locked" in value
      ? { should_lock: value.locked }
      : {
          new_spread: value.spread,
          new_total: value.total,
          expected_updated_at: value.updatedAt,
        }),
  });
  if (error) {
    const messages = [
      "Commissioner access required",
      "Line edits close at kickoff",
      "Unlock the line before editing",
      "Line changed. Reload before saving.",
    ];
    return {
      ok: false,
      message: messages.includes(error.message)
        ? error.message
        : "Line change could not be saved.",
    };
  }

  revalidatePath("/");
  revalidatePath("/admin/lines");
  return { ok: true, message: "" };
}
