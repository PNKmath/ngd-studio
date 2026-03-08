"use client";

import { Badge } from "@/components/ui/badge";
import {
  type ReviewItem,
  type ReviewCategory,
  getCategoryLabel,
  groupByCategory,
  summarizeReport,
} from "@/lib/reviewParser";
import { cn } from "@/lib/utils";

interface ReviewReportProps {
  items: ReviewItem[];
}

const statusConfig: Record<
  ReviewItem["status"],
  { label: string; variant: "default" | "secondary" | "destructive"; className: string; icon: string }
> = {
  fixed: {
    label: "수정됨",
    variant: "default",
    className: "bg-[var(--color-status-info-bg)] text-[var(--color-status-info)] border-0",
    icon: "✎",
  },
  warning: {
    label: "경고",
    variant: "destructive",
    className: "bg-[var(--color-status-warning-bg)] text-[var(--color-status-warning)] border-0",
    icon: "⚠",
  },
  passed: {
    label: "통과",
    variant: "secondary",
    className: "bg-[var(--color-status-success-bg)] text-[var(--color-status-success)] border-0",
    icon: "✓",
  },
};

const categoryIcons: Record<ReviewCategory, string> = {
  equation: "∑",
  text: "Aa",
  style: "◎",
  figure: "▣",
  structure: "≡",
  other: "•",
};

export function ReviewReport({ items }: ReviewReportProps) {
  if (items.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        오검이 완료되면 리포트가 표시됩니다.
      </div>
    );
  }

  const groups = groupByCategory(items);
  const summary = summarizeReport(items);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-4 text-sm">
        <span className="font-medium">총 {items.length}건</span>
        <div className="flex gap-2">
          {summary.fixed > 0 && (
            <Badge className={statusConfig.fixed.className}>
              수정 {summary.fixed}건
            </Badge>
          )}
          {summary.warnings > 0 && (
            <Badge className={statusConfig.warning.className}>
              경고 {summary.warnings}건
            </Badge>
          )}
          {summary.passed > 0 && (
            <Badge className={statusConfig.passed.className}>
              통과 {summary.passed}건
            </Badge>
          )}
        </div>
      </div>

      {/* Grouped items */}
      {(Object.entries(groups) as [ReviewCategory, ReviewItem[]][]).map(
        ([category, categoryItems]) => (
          <div key={category} className="space-y-2">
            <h4 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="w-5 text-center font-mono text-xs">
                {categoryIcons[category]}
              </span>
              {getCategoryLabel(category)}
              <span className="text-xs">({categoryItems.length})</span>
            </h4>
            <ul className="space-y-1.5 ml-7">
              {categoryItems.map((item) => {
                const config = statusConfig[item.status];
                return (
                  <li
                    key={item.id}
                    className={cn(
                      "flex items-center justify-between px-3 py-2 rounded-md text-sm",
                      "bg-card border border-border"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="shrink-0 text-xs">{config.icon}</span>
                      <span className="truncate">{item.description}</span>
                    </div>
                    <Badge className={cn("shrink-0 ml-2 text-xs", config.className)}>
                      {config.label}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </div>
        )
      )}
    </div>
  );
}
