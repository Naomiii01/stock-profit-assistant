import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/components/settings/settings-form";
import type { Profile } from "@/types/database";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user!.id)
    .maybeSingle();

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">設定</h1>
        <p className="text-sm text-muted-foreground">管理個人資料與計算方式</p>
      </div>
      <SettingsForm profile={profile as Profile} email={user!.email ?? ""} />
    </div>
  );
}
