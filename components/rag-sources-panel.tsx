import type { RagSource } from "@/lib/ai/rag-context-builder";

export function RagSourcesPanel({ ragSources }: { ragSources: RagSource[] }) {
  return (
    <div className="mx-auto w-full max-w-4xl px-2 pb-2 md:px-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/40 bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
        <span className="font-medium">📄 Sources:</span>
        {ragSources.map((source) => (
          <span key={source.id}>
            {source.filePath}
            {source.lineRange ? ` ${source.lineRange}` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
