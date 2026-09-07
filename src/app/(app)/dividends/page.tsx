import { createClient } from "@/lib/supabase/server";
import { DividendManager } from "@/components/dividends/dividend-manager";
import type { Dividend } from "@/types/database";

export default async function DividendsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("dividends")
    .select("*")
    .order("payment_date", { ascending: false });

  return <DividendManager dividends={(data as Dividend[]) ?? []} />;
}
