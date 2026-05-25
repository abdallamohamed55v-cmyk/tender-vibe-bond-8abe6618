import { memo } from "react";
import { ThinkingBar } from "@/components/prompt-kit/thinking-bar";

interface ThinkingLoaderProps {
  searchStatus?: string;
}

const ThinkingLoader = ({ searchStatus }: ThinkingLoaderProps) => {
  const displayText = searchStatus || "Thinking...";

  return (
    <div className="py-2">
      <ThinkingBar text={displayText} />
    </div>
  );
};

export default memo(ThinkingLoader);
