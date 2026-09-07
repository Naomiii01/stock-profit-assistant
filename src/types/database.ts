// 對應 supabase/schema.sql 的型別定義
// 之後若跑 `supabase gen types typescript` 可以用產生的檔案取代這份手寫版本。

export type CostMethod = "FIFO" | "WEIGHTED_AVERAGE";
export type TradeType = "buy" | "sell";
export type LotType = "whole" | "odd";
export type Market = "TW_LISTED" | "TW_OTC" | "TW_ETF" | "TW_ACTIVE_ETF" | "OVERSEAS";
export type TradeSource = "manual" | "ai_ocr" | "import";

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  base_currency: string;
  cost_method: CostMethod;
  theme: "light" | "dark" | "system";
  locale: string;
  created_at: string;
  updated_at: string;
}

export interface Broker {
  id: string;
  user_id: string;
  broker_name: string;
  account_name: string | null;
  fee_discount: number;
  note: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Trade {
  id: string;
  user_id: string;
  broker_id: string | null;
  trade_date: string;
  stock_id: string;
  stock_name: string;
  market: Market;
  trade_type: TradeType;
  lot_type: LotType;
  price: number;
  quantity: number;
  amount: number;
  fee: number;
  tax: number;
  note: string | null;
  source: TradeSource;
  ocr_confidence: number | null;
  screenshot_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface Dividend {
  id: string;
  user_id: string;
  stock_id: string;
  stock_name: string;
  cash_dividend: number;
  stock_dividend: number;
  payment_date: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface HoldingRow {
  user_id: string;
  stock_id: string;
  stock_name: string;
  net_quantity: number;
  total_buy_cost: number;
  total_buy_quantity: number;
  total_sell_proceeds: number;
  total_sell_quantity: number;
  first_trade_date: string;
  last_trade_date: string;
}

export const BROKER_PRESETS = [
  "富邦證券",
  "元大證券",
  "永豐金證券",
  "國泰證券",
  "凱基證券",
  "群益證券",
  "統一證券",
] as const;
