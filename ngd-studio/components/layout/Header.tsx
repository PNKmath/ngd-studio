"use client";

import { usePathname } from "next/navigation";

const pageTitles: Record<string, { title: string; breadcrumb?: string[] }> = {
  "/": { title: "대시보드" },
  "/create": { title: "시험지 제작", breadcrumb: ["대시보드", "시험지 제작"] },
  "/create-v2": { title: "시험지 제작 v2", breadcrumb: ["대시보드", "시험지 제작 v2"] },
  "/review": { title: "오검 (오류검수)", breadcrumb: ["대시보드", "오검"] },
  "/history": { title: "작업 히스토리", breadcrumb: ["대시보드", "히스토리"] },
};

export function Header() {
  const pathname = usePathname();
  const page = pageTitles[pathname] ?? { title: "NGD Studio" };

  return (
    <header className="mb-6">
      {page.breadcrumb && (
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
          {page.breadcrumb.map((item, i) => (
            <span key={item} className="flex items-center gap-1.5">
              {i > 0 && <span>/</span>}
              <span className={i === page.breadcrumb!.length - 1 ? "text-foreground" : ""}>
                {item}
              </span>
            </span>
          ))}
        </nav>
      )}
      <h1 className="text-2xl font-semibold">{page.title}</h1>
    </header>
  );
}
