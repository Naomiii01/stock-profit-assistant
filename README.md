# 股票收益小幫手 Stock Profit Assistant

幫助股票投資新手看懂自己「真正」的獲利：多券商交易紀錄、真實已實現/未實現損益計算（FIFO / 加權平均成本可切換）、股利追蹤、AI 截圖辨識匯入交易、AI 投資教練問答。

> 本次交付為 **MVP 核心版本**（依需求討論後的階段一），已完整可用：使用者系統、券商管理、交易紀錄、持股管理、股利管理、Dashboard、績效分析中心、AI 模組的介面與串接架構（金鑰待補）。尚未包含：即時股價自動更新、月報/年報 PDF 產出、通知系統、每日自動備份、E2E 測試、CI/CD、Docker——這些列在下方「路線圖」，架構已預留擴充空間。

## 技術棧

- **前端**：Next.js 15（App Router）、TypeScript、Tailwind CSS v4、shadcn/ui 風格元件、React Query、Zustand（已安裝，目前頁面以 Server Components + Server Actions 為主，Zustand 保留給之後的複雜前端狀態如 AI 聊天多分頁）、Recharts
- **後端**：Supabase（PostgreSQL、Row Level Security、Auth、Storage）
- **AI**：架構已預留 OpenAI GPT-4o / GPT Vision、Claude API（見下方「AI 功能」）

## 快速開始

### 1. 安裝套件

```bash
npm install
```

### 2. 建立 Supabase 專案

1. 到 [supabase.com](https://supabase.com) 建立新專案。
2. 打開 **SQL Editor**，貼上 `supabase/schema.sql` 整份內容並執行（Run）。
   - 會建立：`profiles`、`brokers`、`trades`、`dividends`、`price_cache`、`ai_conversations`、`ai_messages` 資料表，以及對應的 Row Level Security 政策，還有 `trade-screenshots` 的 Storage bucket。
3. **Authentication → Providers**：開啟 Email 登入；若要用 Google 登入，設定 Google OAuth Client ID/Secret。
4. **Authentication → URL Configuration**：
   - Site URL：`http://localhost:3000`（本地開發）或你的正式網域
   - Redirect URLs：加入 `http://localhost:3000/auth/callback` 與正式網域的 `/auth/callback`
5. **Project Settings → API**：複製 `Project URL` 與 `anon public` key。

### 3. 設定環境變數

```bash
cp .env.example .env.local
```

填入 `.env.local`：

```
NEXT_PUBLIC_SUPABASE_URL=你的-Project-URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的-anon-key
```

AI 相關金鑰（`OPENAI_API_KEY` / `ANTHROPIC_API_KEY`）可先留空——AI截圖辨識與AI投資教練會回傳示範資料，讓你先體驗完整流程與畫面。

### 4. 啟動開發伺服器

```bash
npm run dev
```

打開 http://localhost:3000，會自動導向 `/login`。註冊帳號後即可使用。

## 專案結構

```
src/
  app/
    (auth)/login, (auth)/signup     — 登入註冊頁（Server Actions 處理登入邏輯）
    auth/callback                    — OAuth / Email 驗證 callback route
    (app)/dashboard                  — 首頁儀表板（關鍵指標卡片 + 圖表）
    (app)/trades                     — 交易紀錄 CRUD
    (app)/holdings                   — 持股管理（FIFO/加權平均即時計算）
    (app)/brokers                    — 券商管理 CRUD
    (app)/dividends                  — 股利管理 CRUD
    (app)/analytics                  — 績效分析中心（勝率、連勝連敗、最佳/最差交易）
    (app)/ai-ocr                     — AI 截圖辨識（上傳 → 辨識 → 確認 → 匯入交易）
    (app)/ai-coach                   — AI 投資教練聊天介面
    (app)/settings                   — 個人設定（成本計算法切換等）
    api/ai/ocr, api/ai/coach         — AI API routes（未設金鑰時回傳 mock 資料）
  components/
    ui/                              — shadcn 風格基礎元件（Button、Card、Dialog、Table…）
    layout/                          — App Shell、側邊選單、手機版抽屜選單、深色模式切換
    brokers/ trades/ dividends/ holdings/ dashboard/ ai/ settings/
                                      — 各模組的表單與展示元件
  lib/
    portfolio/engine.ts              — 核心計算引擎：FIFO / 加權平均成本、已實現/未實現損益、勝率、賺賠比
    actions/                         — Server Actions（brokers/trades/dividends/settings/auth 的 CRUD）
    supabase/                        — Supabase client（browser / server / middleware）
  types/database.ts                  — 資料表 TypeScript 型別
supabase/schema.sql                  — 完整資料庫 Schema + RLS + Storage 政策
public/manifest.json, public/icons/  — PWA 設定與圖示
```

## 核心計算邏輯：FIFO / 加權平均成本

在 `src/lib/portfolio/engine.ts`：

- `calculatePortfolio(trades, method, asOfDate)`：計算單一股票的已實現損益逐筆明細與剩餘庫存。
- `calculateAllHoldings(trades, method)`：依股票代號分組，回傳所有股票的計算結果。
- `summarizePortfolio(results, priceMap, totalDividend)`：彙總整個帳戶的績效指標（勝率、賺賠比、總報酬率…）。

已用需求文件中的範例驗證過（買 100股@100 → 買 100股@120 → 賣 100股@150）：

- FIFO 已實現損益 = 5000（符合需求範例）
- 剩餘庫存 100 股，成本 120（符合需求範例）

使用者可在「設定」頁切換 FIFO / 加權平均成本，Dashboard 與持股管理會立即套用新的計算方式。

## AI 功能：目前狀態與如何啟用

### AI 截圖辨識（`/ai-ocr`）

- 介面已完整：上傳截圖 → 呼叫 `/api/ai/ocr` → 顯示辨識結果（含信心分數，低於 95% 會有黃色警示）→ 可編輯 → 一鍵匯入成交易紀錄。
- **目前**：未設定 `OPENAI_API_KEY` 時，API 回傳示範資料（模擬延遲 0.8 秒），讓你完整體驗流程。
- **要接上真正的 GPT Vision**：
  1. 在 `.env.local` 設定 `OPENAI_API_KEY`。
  2. 打開 `src/app/api/ai/ocr/route.ts`，依檔案內的 TODO 註解，改成呼叫 OpenAI `chat.completions.create`（`model: "gpt-4o"`，傳入圖片 base64）。
  3. 建議把截圖上傳到 Supabase Storage（`trade-screenshots` bucket，schema 已建立好 RLS 政策），路徑格式：`{user_id}/{yyyy-mm}/{filename}`。

### AI 投資教練（`/ai-coach`）

- 介面已完整：聊天視窗 + 常見問題快速按鈕（我真的有賺錢嗎？哪支股票最會賺？…）。
- **目前**：未設定 `OPENAI_API_KEY` 或 `ANTHROPIC_API_KEY` 時，API 會先計算你真實的績效數據（已實現損益、勝率、股利等），再回傳一段示範文字說明「金鑰設定好後會依這些數據回答」。
- **要接上真正的 LLM**：打開 `src/app/api/ai/coach/route.ts`，依 TODO 註解換成呼叫 OpenAI 或 Claude API，並把 `context`（已經算好的績效數據）放進 system prompt，這樣 AI 才會依「具體數據」回答，而不是憑空生成。
- 資料庫已預留 `ai_conversations` / `ai_messages` 表，之後可以把對話紀錄持久化（目前為求簡潔，對話僅存在瀏覽器分頁記憶體）。

## 即時股價：目前狀態

尚未串接股價 API。持股管理頁面可以手動輸入「現價」來即時試算未實現損益（僅存在瀏覽器，重新整理會清空）。之後建議：

1. 串接台灣證交所 OpenAPI（免費，上市個股）或 FinMind / 其他資料商（上櫃、更完整資料）。
2. 寫入 `price_cache` 表（schema 已建立），設定排程（Vercel Cron 或 Supabase Edge Function）每日 / 盤中更新，避免 API 超量。
3. Dashboard 與持股管理改為讀取 `price_cache`，不用使用者手動輸入。

## 部署到 Vercel

1. 把這個專案推上 GitHub（`git init && git add . && git commit -m "init" && git remote add origin ... && git push`）。
2. 到 [vercel.com](https://vercel.com) → New Project → 選擇這個 repo。
3. 在 Vercel 的 Environment Variables 設定：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - （選填）`OPENAI_API_KEY`、`ANTHROPIC_API_KEY`
4. Deploy。完成後回到 Supabase **Authentication → URL Configuration**，把 Vercel 給的網域加入 Site URL 與 Redirect URLs（`https://your-app.vercel.app/auth/callback`）。
5. 若有用 Google 登入，記得到 Google Cloud Console 的 OAuth 設定加入正式網域的 Authorized redirect URI。

## 字型

目前使用系統內建中文字型（PingFang TC / Microsoft JhengHei / Noto Sans CJK）而非透過 `next/font` 下載 Google Fonts，原因是部分建置環境（例如本次開發時的沙盒容器）無法連線 Google Fonts 會導致 `next build` 失敗。Vercel 正式環境網路暢通，如果想換成更漂亮、跨平台一致的 Noto Sans TC，可以：

```tsx
// src/app/layout.tsx
import { Noto_Sans_TC } from "next/font/google";
const notoSansTC = Noto_Sans_TC({ variable: "--font-noto-sans-tc", subsets: ["latin"], weight: ["400","500","700","900"] });
// 並把 <body className="font-sans antialiased"> 改回 <body className={`${notoSansTC.variable} font-sans antialiased`}>
```

## 路線圖（依原始需求文件，尚未實作的部分）

- [ ] 即時股價自動更新（見上方「即時股價」章節）
- [ ] 月報表 / 年報表（PDF 產出），含最大回撤、Sharpe Ratio
- [ ] AI 換股分析（EPS、本益比、ROE、法人買賣、籌碼集中度、技術面 → 續抱/觀察/減碼/停損）
- [ ] 通知系統（成交提醒、股利提醒、月報/年報提醒、持股異常波動、手機推播、Email）
- [ ] 每日自動備份、資料匯出（Excel / CSV / PDF / JSON）
- [ ] 兩步驟驗證（2FA）
- [ ] Unit Testing / E2E Testing / CI/CD / Docker
- [ ] AI 對話紀錄持久化（`ai_conversations` / `ai_messages` 已建表，尚未串接前端）

## 授權與資料安全

所有交易/股利/券商資料都掛在 `user_id` 並開啟 Row Level Security，任何使用者都無法讀取或修改別人的資料（`supabase/schema.sql` 內每張表都有對應政策）。`SUPABASE_SERVICE_ROLE_KEY` 僅供未來後端排程使用，切勿放進前端程式碼或外流。
