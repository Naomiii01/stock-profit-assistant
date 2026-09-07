import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * 同步「今日收盤價」
 * ------------------------------------------------------------------
 * 串接證交所（TWSE）與櫃買中心（TPEx）的「盤後收盤行情」公開資料，
 * 把每檔股票的收盤價寫進 price_cache.last_price，
 * 持股管理頁面就能自動帶出現價計算未實現損益，不用每天手動輸入。
 *
 * 資料來源（都不需要金鑰）：
 *   - TWSE 全部上市個股當日收盤行情：
 *     https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL
 *   - TPEx 上櫃股票當日收盤行情：
 *     https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes
 *
 * 兩種觸發方式：
 *   1. 手動：登入使用者在「設定」頁按按鈕 → POST，用當前登入身份的權限寫入。
 *   2. 自動／每日：Vercel Cron（見專案根目錄 vercel.json）→ GET，
 *      用 Authorization: Bearer <CRON_SECRET> 驗證（Vercel 會自動附上，
 *      只要在環境變數設定 CRON_SECRET 即可，不需要額外程式碼串接）。
 *      Cron 情境下用 service role key 寫入（如果有設定的話，繞過 RLS，
 *      避免每天要有一個「登入中」的使用者才能執行）；沒有設定
 *      SUPABASE_SERVICE_ROLE_KEY 的話，GET 會回應提示訊息。
 */

const CODE_KEYS = ["Code", "code", "公司代號", "SecuritiesCompanyCode"];
const NAME_KEYS = ["Name", "name", "公司簡稱", "CompanyName", "簡稱"];
const CLOSE_KEYS = ["ClosingPrice", "Close", "收盤價", "close"];

type RawRow = Record<string, unknown>;

function pickField(row: RawRow, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

function parsePrice(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "--" || cleaned === "-") return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

async function fetchSource(url: string): Promise<{ id: string; name?: string; close: number }[]> {
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];
    const out: { id: string; name?: string; close: number }[] = [];
    for (const row of data as RawRow[]) {
      const id = pickField(row, CODE_KEYS);
      const name = pickField(row, NAME_KEYS);
      const close = parsePrice(pickField(row, CLOSE_KEYS));
      if (id && /^[0-9A-Z]{4,6}$/.test(id) && close != null) {
        out.push({ id, name, close });
      }
    }
    return out;
  } catch {
    return [];
  }
}

// 這裡刻意用 any：server createClient()（走使用者 session）跟
// createServiceClient()（走 service role key）回傳的型別在 overload 上兜不起來，
// 但兩者實際用到的 .from().upsert() 介面是相容的。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runSync(supabase: any) {
  const [twse, tpex] = await Promise.all([
    fetchSource("https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL"),
    fetchSource("https://www.tpex.org.tw/openapi/v1/tpex_mainboard_daily_close_quotes"),
  ]);

  const merged = new Map<string, { stock_id: string; stock_name?: string; last_price: number; source: string }>();
  for (const r of twse) merged.set(r.id, { stock_id: r.id, stock_name: r.name, last_price: r.close, source: "TWSE" });
  for (const r of tpex) merged.set(r.id, { stock_id: r.id, stock_name: r.name, last_price: r.close, source: "TPEx" });

  if (merged.size === 0) {
    return { ok: false as const, error: "沒有抓到任何收盤價資料，證交所/櫃買中心 API 可能暫時無回應或今日休市。" };
  }

  const rows = Array.from(merged.values()).map((r) => ({
    stock_id: r.stock_id,
    ...(r.stock_name ? { stock_name: r.stock_name } : {}),
    last_price: r.last_price,
    source: r.source,
    fetched_at: new Date().toISOString(),
  }));

  const chunkSize = 500;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("price_cache").upsert(chunk, { onConflict: "stock_id" });
    if (error) return { ok: false as const, error: `寫入資料庫時發生錯誤：${error.message}`, upserted };
    upserted += chunk.length;
  }

  return { ok: true as const, upserted, twse_count: twse.length, tpex_count: tpex.length };
}

// 手動觸發（設定頁按鈕）：用登入者的身份寫入，RLS 已開放 authenticated 可寫入 price_cache
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "尚未登入" }, { status: 401 });
  }

  const result = await runSync(supabase);
  if (!result.ok) return NextResponse.json(result, { status: 502 });
  return NextResponse.json({ success: true, ...result });
}

// 自動觸發（Vercel Cron 每日排程）：用 CRON_SECRET 驗證，不需要使用者登入
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "未授權" }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json(
      {
        error:
          "尚未設定 SUPABASE_SERVICE_ROLE_KEY，Cron 自動同步無法寫入資料庫。請到 Supabase Project Settings → API 複製 service_role key，貼到 Vercel 環境變數 SUPABASE_SERVICE_ROLE_KEY 後重新部署。",
      },
      { status: 500 }
    );
  }

  const supabase = createServiceClient(supabaseUrl, serviceRoleKey);
  const result = await runSync(supabase);
  if (!result.ok) return NextResponse.json(result, { status: 502 });
  return NextResponse.json({ success: true, ...result });
}
