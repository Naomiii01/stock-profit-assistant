import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TW_STOCK_MAP } from "@/lib/data/tw-stocks";

/**
 * 同步台股代號資料庫
 * ------------------------------------------------------------------
 * 串接證交所（TWSE）與櫃買中心（TPEx）的 OpenAPI，抓取「公司代號 / 簡稱」
 * 存進 price_cache 表（stock_id / stock_name），交易紀錄表單日後就能查到
 * 全市場的股票代號，不再受限於內建的精選清單。
 *
 * 兩個公開資料來源都不需要金鑰：
 *   - TWSE 上市公司基本資料：https://openapi.twse.com.tw/v1/opendata/t187ap03_L
 *   - TPEx 上櫃公司基本資料：https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O
 *
 * 這兩個資料來源偶爾會調整回傳的欄位名稱，所以下面用「候選欄位名稱」的方式
 * 盡量兼容，抓不到就跳過該筆，不會讓整個同步失敗。內建的精選清單
 * （含熱門 ETF，OpenAPI 較少涵蓋）也會一併寫入，確保至少有基本涵蓋範圍。
 */

const CODE_KEYS = ["公司代號", "SecuritiesCompanyCode", "Code", "code"];
const NAME_KEYS = ["公司簡稱", "簡稱", "CompanyAbbreviation", "Name", "name"];

type RawRow = Record<string, unknown>;

function pickField(row: RawRow, keys: string[]): string | undefined {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

async function fetchSource(url: string): Promise<{ id: string; name: string }[]> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      // OpenAPI 資料每天才會變動一次，快取一天即可，避免每次都整批重抓
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) return [];
    const out: { id: string; name: string }[] = [];
    for (const row of data as RawRow[]) {
      const id = pickField(row, CODE_KEYS);
      const name = pickField(row, NAME_KEYS);
      // 只留 4 碼數字或英數混合的一般股票/ETF代號，避免夾雜非股票列
      if (id && name && /^[0-9A-Z]{4,6}$/.test(id)) {
        out.push({ id, name });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "尚未登入" }, { status: 401 });
  }

  const [twse, tpex] = await Promise.all([
    fetchSource("https://openapi.twse.com.tw/v1/opendata/t187ap03_L"),
    fetchSource("https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap03_O"),
  ]);

  const merged = new Map<string, { stock_id: string; stock_name: string; source: string }>();
  for (const { id, name } of twse) merged.set(id, { stock_id: id, stock_name: name, source: "TWSE" });
  for (const { id, name } of tpex) merged.set(id, { stock_id: id, stock_name: name, source: "TPEx" });
  // 內建精選清單（含熱門 ETF）一併寫入，OpenAPI 沒抓到的代號不會被覆蓋掉
  for (const [id, name] of Object.entries(TW_STOCK_MAP)) {
    if (!merged.has(id)) merged.set(id, { stock_id: id, stock_name: name, source: "curated" });
  }

  const rows = Array.from(merged.values()).map((r) => ({
    stock_id: r.stock_id,
    stock_name: r.stock_name,
    source: r.source,
    fetched_at: new Date().toISOString(),
  }));

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "沒有抓到任何資料，可能是證交所/櫃買中心 API 暫時無回應，請稍後再試一次。" },
      { status: 502 }
    );
  }

  // 分批 upsert，避免單次請求過大
  const chunkSize = 500;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("price_cache").upsert(chunk, { onConflict: "stock_id" });
    if (error) {
      return NextResponse.json(
        { error: `寫入資料庫時發生錯誤：${error.message}`, upserted },
        { status: 500 }
      );
    }
    upserted += chunk.length;
  }

  return NextResponse.json({
    success: true,
    upserted,
    twse_count: twse.length,
    tpex_count: tpex.length,
    curated_count: Object.keys(TW_STOCK_MAP).length,
  });
}
