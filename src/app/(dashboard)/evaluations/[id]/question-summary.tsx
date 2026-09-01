"use client";

// สรุปผลรายคำถาม — ตารางข้อมูล + กราฟแท่ง + กราฟวงกลม (CSS conic-gradient ธรรมดา ไม่พึ่ง chart
// library ใหม่ ให้เข้ากับสไตล์เรียบง่ายเดิมของระบบ) ใช้กับคำถามแบบ Likert และ choice เท่านั้น —
// คำถามปลายเปิดไม่มีตัวเลขให้สรุปเป็นกราฟ จึงแสดงเป็นรายการคำตอบแทนที่หน้าเรียกใช้เอง

// สีหมวดหมู่คงที่ตามลำดับเดิมเสมอ (ไม่สลับตามอันดับ) หยิบจากโทนสีที่มีอยู่แล้วในระบบ
// (navy/gold ของแบรนด์ + badge-emerald/badge-red ที่ใช้อยู่แล้ว) แทนการสุ่มสีใหม่
const CHART_COLORS = [
  "#1b4177", // navy-700
  "#c19a2e", // gold-500
  "#059669", // emerald-600
  "#dc2626", // red-600
  "#64748b", // slate-500
  "#0284c7", // sky-600
  "#7c3aed", // violet-600
  "#a3791a", // gold-600
];

type Row = { label: string; count: number };

function formatPercent(count: number, total: number) {
  if (total === 0) return "0%";
  return `${((count / total) * 100).toFixed(0)}%`;
}

export function QuestionSummary({ rows, total }: { rows: Row[]; total: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
      <div className="space-y-4">
        <div className="overflow-hidden rounded-lg border border-slate-200/80">
          <table className="table-base">
            <thead>
              <tr>
                <th></th>
                <th>ตัวเลือก</th>
                <th className="text-right">จำนวน</th>
                <th className="text-right">สัดส่วน</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.label}>
                  <td className="w-4">
                    <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  </td>
                  <td>{r.label}</td>
                  <td className="text-right">{r.count}</td>
                  <td className="text-right">{formatPercent(r.count, total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-1.5">
          {rows.map((r, i) => (
            <div key={r.label} className="flex items-center gap-2 text-xs text-slate-500">
              <span className="w-24 shrink-0 truncate text-slate-700">{r.label}</span>
              <div className="h-3 flex-1 rounded bg-slate-100">
                <div
                  className="h-3 rounded"
                  style={{
                    width: total > 0 ? `${(r.count / total) * 100}%` : "0%",
                    background: CHART_COLORS[i % CHART_COLORS.length],
                  }}
                />
              </div>
              <span className="w-8 text-right">{r.count}</span>
            </div>
          ))}
        </div>
      </div>

      {total > 0 && <PieChart rows={rows} total={total} />}
    </div>
  );
}

function PieChart({ rows, total }: { rows: Row[]; total: number }) {
  const { stops } = rows.reduce<{ stops: string[]; cumulative: number }>(
    (acc, r, i) => {
      if (r.count === 0) return acc;
      const start = (acc.cumulative / total) * 360;
      const cumulative = acc.cumulative + r.count;
      const end = (cumulative / total) * 360;
      return { stops: [...acc.stops, `${CHART_COLORS[i % CHART_COLORS.length]} ${start}deg ${end}deg`], cumulative };
    },
    { stops: [], cumulative: 0 },
  );

  return (
    <div className="flex items-center justify-center">
      <div
        className="h-32 w-32 shrink-0 rounded-full"
        style={{ background: `conic-gradient(${stops.join(", ")})` }}
        role="img"
        aria-label="สัดส่วนคำตอบแต่ละตัวเลือก"
      />
    </div>
  );
}
