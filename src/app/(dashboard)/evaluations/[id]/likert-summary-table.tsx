"use client";

// ตารางสรุปสถิติคำถามแบบ Likert ต่อหมวดหมู่ — ค่าเฉลี่ย/S.D./CV%/แปลผล รายข้อ พร้อมแถว "ภาพรวม"
// รวมทุกคำตอบในหมวดหมู่นั้นที่ท้ายตาราง ตรงกับดีไซน์อ้างอิงที่ผู้ใช้ส่งภาพมา

import { computeStats } from "../stats";
import { interpretScore, type Criterion } from "../interpret";

type Question = { id: string; question_text: string };
type Answer = { question_id: string; answer_value: string };

export function LikertSummaryTable({
  questions,
  answers,
  criteria,
}: {
  questions: Question[];
  answers: Answer[];
  criteria: Criterion[];
}) {
  const rows = questions.map((q, i) => {
    const values = answers.filter((a) => a.question_id === q.id).map((a) => Number(a.answer_value));
    const stats = computeStats(values);
    return { no: i + 1, text: q.question_text, count: values.length, ...stats };
  });

  const overallValues = questions.flatMap((q) =>
    answers.filter((a) => a.question_id === q.id).map((a) => Number(a.answer_value)),
  );
  const overall = computeStats(overallValues);

  return (
    <div className="table-shell">
      <table className="table-base">
        <thead>
          <tr>
            <th className="w-10 text-right">ข้อ</th>
            <th>รายการ</th>
            <th className="text-right">ค่าเฉลี่ย</th>
            <th className="text-right">S.D.</th>
            <th className="text-right">CV%</th>
            <th>แปลผล</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const label = r.count > 0 ? interpretScore(r.avg, criteria) : null;
            return (
              <tr key={r.no}>
                <td className="text-right">{r.no}</td>
                <td>{r.text}</td>
                <td className="text-right">{r.count > 0 ? r.avg.toFixed(2) : "-"}</td>
                <td className="text-right">{r.count > 0 ? r.sd.toFixed(2) : "-"}</td>
                <td className="text-right">{r.cv !== null ? r.cv.toFixed(1) : "-"}</td>
                <td>{label ? <span className="badge-emerald">{label}</span> : "-"}</td>
              </tr>
            );
          })}
          <tr className="font-semibold">
            <td></td>
            <td>ภาพรวม</td>
            <td className="text-right">{overallValues.length > 0 ? overall.avg.toFixed(2) : "-"}</td>
            <td className="text-right">{overallValues.length > 0 ? overall.sd.toFixed(2) : "-"}</td>
            <td className="text-right">{overall.cv !== null ? overall.cv.toFixed(1) : "-"}</td>
            <td>
              {overallValues.length > 0 && interpretScore(overall.avg, criteria) ? (
                <span className="badge-emerald">{interpretScore(overall.avg, criteria)}</span>
              ) : (
                "-"
              )}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
