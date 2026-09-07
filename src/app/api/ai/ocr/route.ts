import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * AI 截圖辨識 API
 * ------------------------------------------------------------------
 * TODO（正式上線前）：
 *   1. 在 .env.local 設定 OPENAI_API_KEY（使用 GPT-4o / GPT Vision）。
 *   2. 將下方 mock 區塊換成真正呼叫 OpenAI Vision API 的程式碼，範例：
 *
 *      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 *      const response = await openai.chat.completions.create({
 *        model: "gpt-4o",
 *        messages: [{
 *          role: "user",
 *          content: [
 *            { type: "text", text: OCR_PROMPT },
 *            { type: "image_url", image_url: { url: dataUrl } },
 *          ],
 *        }],
 *        response_format: { type: "json_object" },
 *      });
 *
 *   3. 將截圖上傳到 Supabase Storage（bucket: trade-screenshots，
 *      路徑：{user_id}/{yyyy-mm}/{filename}），並把 path 存進 trades.screenshot_path。
 *   4. 辨識信心分數（ocr_confidence）低於 95 時，前端會顯示黃色警告要求使用者再次確認。
 */

// TODO: 呼叫 GPT Vision 時，把這段 prompt 放進 messages 的 text 內容中。
// const OCR_PROMPT = `你是專業的證券交易單截圖辨識助手。請從圖片中擷取：股票代號、股票名稱、交易日期(YYYY-MM-DD)、
// 買進或賣出、成交價格、成交股數、手續費、交易稅、券商名稱。輸出 JSON，並針對每個欄位給一個 0-100 的信心分數。`;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "尚未登入" }, { status: 401 });
  }

  const hasApiKey = !!process.env.OPENAI_API_KEY;

  if (!hasApiKey) {
    // ---- Mock 回應（尚未設定 API 金鑰）----
    await new Promise((r) => setTimeout(r, 800)); // 模擬辨識延遲
    return NextResponse.json({
      mock: true,
      message: "尚未設定 OPENAI_API_KEY，以下為示範資料，請手動確認或修改後再送出。",
      result: {
        stock_id: "2330",
        stock_name: "台積電",
        trade_date: new Date().toISOString().slice(0, 10),
        trade_type: "buy",
        price: 985,
        quantity: 1000,
        fee: 140,
        tax: 0,
        confidence: 62,
      },
    });
  }

  // ---- 正式流程（已設定 API 金鑰）----
  // const formData = await request.formData();
  // const file = formData.get("file") as File;
  // ...（呼叫 OpenAI Vision，解析並回傳結構化資料，見上方 TODO）
  return NextResponse.json(
    { error: "尚未實作正式 OCR 流程，請依 route.ts 中的 TODO 補上 OpenAI Vision 呼叫。" },
    { status: 501 }
  );
}
