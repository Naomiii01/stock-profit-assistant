import { createClient } from "@/lib/supabase/server";
import { OcrUploader } from "@/components/ai/ocr-uploader";
import type { Broker } from "@/types/database";

export default async function AiOcrPage() {
  const supabase = await createClient();
  const { data: brokers } = await supabase.from("brokers").select("*").eq("is_archived", false);

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">AI 截圖辨識</h1>
        <p className="text-sm text-muted-foreground">
          上傳券商 App 的成交回報截圖，AI 會自動辨識股票代號、價格、股數等欄位，確認無誤後即可一鍵匯入。
        </p>
      </div>
      <OcrUploader brokers={(brokers as Broker[]) ?? []} />
    </div>
  );
}
