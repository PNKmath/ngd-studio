import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DemoPreview } from "@/components/shared/DemoPreview";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4">
        <Link href="/create">
          <Card className="hover:border-primary/40 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">시험지 제작</CardTitle>
              <CardDescription>
                PDF + 양식 HWPX를 업로드하여 시험지를 제작합니다.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/review">
          <Card className="hover:border-primary/40 transition-colors cursor-pointer">
            <CardHeader>
              <CardTitle className="text-lg">오검 (오류검수)</CardTitle>
              <CardDescription>
                원본 PDF와 작업 HWPX를 비교하여 오류를 검수합니다.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>

      <DemoPreview />
    </div>
  );
}
