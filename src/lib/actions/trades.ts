"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const tradeSchema = z.object({
  trade_date: z.string().min(1, "請選擇交易日期"),
  broker_id: z.string().optional().nullable(),
  stock_id: z.string().min(1, "請輸入股票代號"),
  stock_name: z.string().min(1, "請輸入股票名稱"),
  market: z
    .enum(["TW_LISTED", "TW_OTC", "TW_ETF", "TW_ACTIVE_ETF", "OVERSEAS"])
    .default("TW_LISTED"),
  trade_type: z.enum(["buy", "sell"]),
  lot_type: z.enum(["whole", "odd"]).default("whole"),
  price: z.coerce.number().min(0),
  quantity: z.coerce.number().positive("股數必須大於 0"),
  amount: z.coerce.number(),
  fee: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),
  note: z.string().optional().nullable(),
  source: z.enum(["manual", "ai_ocr", "import"]).default("manual"),
  ocr_confidence: z.coerce.number().min(0).max(100).optional().nullable(),
});

export type TradeFormState = {
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

function normalize(data: z.infer<typeof tradeSchema>) {
  return {
    ...data,
    broker_id: data.broker_id || null,
    amount: data.amount || data.price * data.quantity,
  };
}

export async function createTrade(_prev: TradeFormState, formData: FormData): Promise<TradeFormState> {
  const parsed = tradeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    const { supabase, user } = await requireUser();
    const { error } = await supabase
      .from("trades")
      .insert({ ...normalize(parsed.data), user_id: user.id });
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "發生錯誤" };
  }
  revalidatePath("/trades");
  revalidatePath("/holdings");
  revalidatePath("/dashboard");
  return {};
}

export async function updateTrade(
  id: string,
  _prev: TradeFormState,
  formData: FormData
): Promise<TradeFormState> {
  const parsed = tradeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }
  try {
    const { supabase, user } = await requireUser();
    const { error } = await supabase
      .from("trades")
      .update(normalize(parsed.data))
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "發生錯誤" };
  }
  revalidatePath("/trades");
  revalidatePath("/holdings");
  revalidatePath("/dashboard");
  return {};
}

export async function deleteTrade(id: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("trades").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/trades");
  revalidatePath("/holdings");
  revalidatePath("/dashboard");
}
