import { CoachChat } from "@/components/ai/coach-chat";

export default function AiCoachPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">AI 投資教練</h1>
        <p className="text-sm text-muted-foreground">根據你的實際交易數據回答問題、提供改善建議與風險提醒</p>
      </div>
      <CoachChat />
    </div>
  );
}
