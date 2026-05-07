type TimingData = {
  ragStartMs?: number;
  ragEndMs?: number;
  llmRequestMs?: number;
  ragSourceCount?: number;
};

function fmt(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

const RAG_SLOW_THRESHOLD_MS = 8_000;

export function RagTimingPanel({ timing }: { timing: TimingData }) {
  const ragDuration =
    timing.ragEndMs !== undefined && timing.ragStartMs !== undefined
      ? timing.ragEndMs - timing.ragStartMs
      : undefined;
  const isRagSlow = ragDuration !== undefined && ragDuration > RAG_SLOW_THRESHOLD_MS;
  const ragDisabled = timing.ragStartMs === undefined && timing.ragEndMs === undefined;

  return (
    <div className="mx-auto w-full max-w-4xl px-2 pb-2 md:px-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/40 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
        <span className="font-medium">⏱</span>
        <span>+0ms prompt received</span>

        {ragDisabled ? (
          <span>RAG disabled</span>
        ) : (
          <>
            {timing.ragStartMs !== undefined && (
              <span>+{fmt(timing.ragStartMs)} RAG start</span>
            )}
            {timing.ragEndMs !== undefined && (
              <span
                className={
                  isRagSlow
                    ? "font-medium text-amber-600 dark:text-amber-400"
                    : ""
                }
              >
                +{fmt(timing.ragEndMs)} RAG done ({timing.ragSourceCount ?? 0}{" "}
                {timing.ragSourceCount === 1 ? "source" : "sources"})
                {isRagSlow && " ⚠ slow"}
              </span>
            )}
          </>
        )}

        {timing.llmRequestMs !== undefined && (
          <span>+{fmt(timing.llmRequestMs)} LLM sent</span>
        )}
      </div>
    </div>
  );
}
