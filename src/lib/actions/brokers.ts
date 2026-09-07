"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const brokerSchema = z.object({
  broker_name: z.string().min(1, "請輸入券商名稱"),
  account_name: z.string().optional().nullable(),
  fee_discount: z.coerce.number().min(0.01).max(1).default(1),
  note: z.string().optional().nullable(),
});

export type BrokerFormState = {
  error?: string;
  fieldErrors?: Record<string, string[]>;
};

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("尚未登入");
  return { supabase, user };
}

export async function createBroker(_prev: BrokerFormState, formData: FormData): Promise<BrokerFormState> {
  const parsed = brokerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    const { supabase, user } = await requireUser();
    const { error } = await supabase.from("brokers").insert({ ...parsed.data, user_id: user.id });
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "發生錯誤" };
  }
  revalidatePath("/brokers");
  return {};
}

export async function updateBroker(
  id: string,
  _prev: BrokerFormState,
  formData: FormData
): Promise<BrokerFormState> {
  const parsed = brokerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    const { supabase, user } = await requireUser();
    const { error } = await supabase
      .from("brokers")
      .update(parsed.data)
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "發生錯誤" };
  }
  revalidatePath("/brokers");
  return {};
}

export async function deleteBroker(id: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("brokers").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/brokers");
}

export async function archiveBroker(id: string, isArchived: boolean) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("brokers")
    .update({ is_archived: isArchived })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/brokers");
}
