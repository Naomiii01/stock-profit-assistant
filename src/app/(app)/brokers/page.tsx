import { createClient } from "@/lib/supabase/server";
import { BrokerManager } from "@/components/brokers/broker-manager";
import type { Broker } from "@/types/database";

export default async function BrokersPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("brokers")
    .select("*")
    .order("is_archived", { ascending: true })
    .order("created_at", { ascending: false });

  return <BrokerManager brokers={(data as Broker[]) ?? []} />;
}
