"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const dividendSchema = z.object({
  stock_id: z.string().min(1, "請輸入股票代號"),
  stock_name: z.string().min(1, "請輸入股票名稱"),
  cash_dividend: z.coerce.number().min(0).default(0),
  stock_dividend: z.coerce.number().min(0).default(0),
  payment_date: z.string().min(1, "請選擇發放日期"),
  note: z.string().optional().nullable(),
});

export type DividendFormState = {
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

export async function createDividend(
  _prev: DividendFormState,
  formData: FormData
): Promise<DividendFormState> {
  const parsed = dividendSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    const { supabase, user } = await requireUser();
    const { error } = await supabase.from("dividends").insert({ ...parsed.data, user_id: user.id });
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "發生錯誤" };
  }
  revalidatePath("/dividends");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteDividend(id: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("dividends").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/dividends");
  revalidatePath("/dashboard");
}
