"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z.object({
  display_name: z.string().min(1).max(60),
  base_currency: z.string().min(1).max(10).default("TWD"),
  cost_method: z.enum(["FIFO", "WEIGHTED_AVERAGE"]),
});

export type SettingsFormState = { error?: string; success?: boolean };

export async function updateProfile(
  _prev: SettingsFormState,
  formData: FormData
): Promise<SettingsFormState> {
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "資料格式錯誤" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "尚未登入" };

  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/holdings");
  return { success: true };
}
