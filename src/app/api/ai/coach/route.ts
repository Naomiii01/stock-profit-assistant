import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calculateAllHoldings, summarizePortfolio } from "@/lib/portfolio/engine";
import type { CostMethod, Trade } from "@/types/database";

/**
 * AI 投資教練 API
 * ------------------------------------------------------------------
 * TODO（正式上線前）：
 *   1. 在 .env.local 設定 OPENAI_API_KEY 或 ANTHROPIC_API_KEY 其中之一。
 *   2. 將下方 mock 回覆換成真正呼叫 LLM 的程式碼，並把 `context` 物件
 *      （使用者目前的績效數據）放進 system prompt，讓 AI 依據「具體數據」回答，
 *      而不是憑空生成，範例（Claude）：
 *
 *      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
 *      const msg = await anthropic.messages.create({
 *        model: "claude-sonnet-4-5",
 *        system: buildSystemPrompt(context),
 *        messages: [{ role: "user", content: question }],
 *      });
 *
 *   3. 可將對話紀錄寫入 ai_conversations / ai_messages 表（schema 已備妥）。
 */

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "尚未登入" }, { status: 401 });

  const { question } = (await request.json()) as { question: string };

  const [{ data: trades }, { data: profile }] = await Promise.all([
    supabase.from("trades").select("*").order("trade_date"),
    supabase.from("profiles").select("cost_method").eq("id", user.id).maybeSingle(),
  ]);

  const method: CostMethod = (profile?.cost_method as CostMethod) ?? "FIFO";
  const holdings = calculateAllHoldings((trades as Trade[]) ?? [], method);
  const summary = summarizePortfolio(holdings, {}, 0);

  const hasApiKey = !!process.env.OPENAI_API_KEY || !!process.env.ANTHROPIC_API_KEY;

  if (!hasApiKey) {
    return NextResponse.json({
      mock: true,
      answer: buildMockAnswer(question, summary, holdings.length),
    });
  }

  // ---- 正式流程（已設定 API 金鑰）----
  return NextResponse.json(
    { error: "尚未實作正式 AI 教練流程，請依 route.ts 中的 TODO 補上 LLM 呼叫。" },
    { status: 501 }
  );
}

function buildMockAnswer(
  question: string,
  summary: ReturnType<typeof summarizePortfolio>,
  stockCount: number
) {
  return [
    `（示範回覆，尚未設定 OPENAI_API_KEY / ANTHROPIC_API_KEY）`,
    ``,
    `你的問題：「${question}」`,
    ``,
    `根據目前資料：已實現損益 ${Math.round(summary.totalRealizedPnl).toLocaleString()} 元、` +
      `股利收入 ${Math.round(summary.totalDividend).toLocaleString()} 元、` +
      `勝率 ${summary.winRate.toFixed(1)}%、共持有 ${stockCount} 檔股票（含已出清）。`,
    `設定好正式的 API 金鑰後，AI 投資教練會依這些具體數據，給你更完整的分析、改善建議與風險提醒。`,
  ].join("\n");
}
