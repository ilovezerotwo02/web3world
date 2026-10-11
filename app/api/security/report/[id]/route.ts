import { getDb } from "../../../../../db";
import { requireAuth } from "../../../../../lib/auth";
import { getSecurityReport } from "../../../../../lib/repositories";
import { reportToMarkdown, type AuditReport } from "../../../../../lib/security/report";
import { jsonError } from "../../../../../lib/security/api-helpers";

// GET /api/security/report/[id]?format=md — 只允许读取自己的报告
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const db = getDb();
  const auth = await requireAuth(request, db);
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const report = await getSecurityReport(db, id, auth.userId);
  if (!report) return jsonError("报告不存在或无权访问", 404);

  const format = new URL(request.url).searchParams.get("format");
  if (format === "md" || format === "markdown") {
    const parsed = JSON.parse(report.reportJson || "{}") as AuditReport;
    const markdown = report.reportMarkdown || reportToMarkdown(parsed);
    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="audit-report-${id.slice(0, 8)}.md"`,
      },
    });
  }

  return Response.json({
    id: report.id,
    score: report.score,
    passed: Boolean(report.passed),
    reportHash: report.reportHash,
    trackVersion: report.trackVersion,
    summary: JSON.parse(report.summaryJson || "{}") as unknown,
    report: JSON.parse(report.reportJson || "{}") as unknown,
    createdAt: report.createdAt,
  });
}
