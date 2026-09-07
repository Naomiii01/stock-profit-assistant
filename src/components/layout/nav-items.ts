import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Receipt,
  Briefcase,
  Landmark,
  Coins,
  LineChart,
  ScanLine,
  Sparkles,
  Settings,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trades", label: "交易紀錄", icon: Receipt },
  { href: "/holdings", label: "持股管理", icon: Briefcase },
  { href: "/brokers", label: "券商管理", icon: Landmark },
  { href: "/dividends", label: "股利管理", icon: Coins },
  { href: "/analytics", label: "績效分析", icon: LineChart },
  { href: "/ai-ocr", label: "AI截圖辨識", icon: ScanLine },
  { href: "/ai-coach", label: "AI投資教練", icon: Sparkles },
  { href: "/settings", label: "設定", icon: Settings },
];
