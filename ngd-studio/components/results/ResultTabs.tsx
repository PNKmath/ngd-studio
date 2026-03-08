"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useJobStore } from "@/lib/store";

export function ResultTabs() {
  const intermediateFiles = useJobStore((s) => s.intermediateFiles);
  const result = useJobStore((s) => s.result);

  const jsonFiles = intermediateFiles.filter((f) => f.type === "json");
  const imageFiles = intermediateFiles.filter((f) => f.type === "image");

  return (
    <Tabs defaultValue="json" className="w-full">
      <TabsList className="bg-secondary">
        <TabsTrigger value="json">
          JSON {jsonFiles.length > 0 && `(${jsonFiles.length})`}
        </TabsTrigger>
        <TabsTrigger value="images">
          이미지 {imageFiles.length > 0 && `(${imageFiles.length})`}
        </TabsTrigger>
        <TabsTrigger value="summary">요약</TabsTrigger>
      </TabsList>

      <TabsContent value="json" className="mt-3">
        {jsonFiles.length === 0 ? (
          <EmptyState message="JSON 파일이 아직 생성되지 않았습니다." />
        ) : (
          <ul className="space-y-2">
            {jsonFiles.map((f, i) => (
              <li
                key={i}
                className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-md text-sm"
              >
                <svg className="w-4 h-4 text-muted-foreground shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="truncate">{f.name}</span>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="images" className="mt-3">
        {imageFiles.length === 0 ? (
          <EmptyState message="이미지가 아직 생성되지 않았습니다." />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {imageFiles.map((f, i) => (
              <div
                key={i}
                className="flex flex-col items-center gap-1.5 p-3 bg-secondary rounded-md"
              >
                <div className="w-full aspect-square bg-muted rounded flex items-center justify-center">
                  <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.2}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
                <span className="text-xs text-muted-foreground truncate w-full text-center">
                  {f.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="summary" className="mt-3">
        {result ? (
          <div className="p-4 bg-secondary rounded-md space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  result.status === "success"
                    ? "bg-[var(--color-status-success)]"
                    : "bg-[var(--color-status-error)]"
                }`}
              />
              <span className="text-sm font-medium">
                {result.status === "success" ? "작업 완료" : "작업 실패"}
              </span>
            </div>
            {result.summary && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {result.summary}
              </p>
            )}
          </div>
        ) : (
          <EmptyState message="작업이 완료되면 요약이 표시됩니다." />
        )}
      </TabsContent>
    </Tabs>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
      {message}
    </div>
  );
}
