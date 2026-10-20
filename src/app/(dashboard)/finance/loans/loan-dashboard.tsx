"use client";

// แดชบอร์ดสัญญาการยืมเงิน (หัวหน้า /finance/loans) — ตัวเลขสรุปเป็นการ์ด (ไม่ใช่กราฟ: ข้อมูลเป็นยอดเดี่ยวๆ) +
// แถบส่งใช้แล้ว/ยืมทั้งปีงบ + รายการต้องติดตาม (เกินกำหนด/ใกล้ครบกำหนด) — สถานะมีข้อความกำกับทุกครั้ง ไม่ใช้สีอย่างเดียว

import { formatThaiDate } from "@/lib/thai";

export type DashLoan = {
  id: string;
  doc_no: string | null;
  borrower_name: string;
  request_date: string;
  received_date: string | null;
  due_date: string | null;
  amount: number;
  repaid: number;
  outstanding: number;
  cleared: boolean;
  overdue: boolean;
};

export type DashFilter = "open" | "overdue" | "cleared" | "all";

const GOOD = "#059669";
const WARN = "#d97706";
const RED = "#dc2626";
const BRAND = "#123361";
const SOON_DAYS = 7;

const baht = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}
/** ปีงบประมาณ พ.ศ. (ต.ค. ขึ้นปีใหม่) */
function fiscalYear(iso: string) {
  const [y, m] = iso.split("-").map(Number);
  return y + 543 + (m >= 10 ? 1 : 0);
}

function Tile({
  label,
  value,
  suffix,
  sub,
  accent,
  onClick,
}: {
  label: string;
  value: string;
  suffix?: string;
  sub: string;
  accent: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value} {suffix && <span className="stat-suffix">{suffix}</span>}
      </div>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </>
  );
  const style = { "--accent": accent } as React.CSSProperties;
  return onClick ? (
    <button type="button" onClick={onClick} style={style} className="stat-card text-left transition hover:border-slate-300 hover:shadow-md">
      {body}
    </button>
  ) : (
    <div className="stat-card" style={style}>
      {body}
    </div>
  );
}

export function LoanDashboard({ loans, onFilter }: { loans: DashLoan[]; onFilter: (f: DashFilter) => void }) {
  const today = todayIso();
  const fy = fiscalYear(today);
  const open = loans.filter((l) => !l.cleared);
  const overdue = open.filter((l) => l.overdue);
  const soon = open.filter((l) => !l.overdue && l.due_date && daysBetween(today, l.due_date) <= SOON_DAYS);
  const pendingCheck = loans.filter((l) => !l.doc_no);
  const waitingPay = open.filter((l) => l.doc_no && !l.received_date);
  const sum = (xs: DashLoan[], k: "outstanding" | "amount" | "repaid") => xs.reduce((s, l) => s + l[k], 0);

  const yearLoans = loans.filter((l) => fiscalYear(l.request_date) === fy);
  const yearAmount = sum(yearLoans, "amount");
  const yearRepaid = sum(yearLoans, "repaid");
  const repaidPct = yearAmount > 0 ? Math.min(100, (yearRepaid / yearAmount) * 100) : 0;

  // ต้องติดตาม: เกินกำหนดก่อน (เกินนานสุดก่อน) แล้วตามด้วยใกล้ครบกำหนด
  const watch = [...overdue, ...soon].sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")).slice(0, 6);

  return (
    <div className="mb-5 print:hidden">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          label="ค้างส่งใช้"
          value={baht(sum(open, "outstanding"))}
          suffix="บาท"
          sub={`${open.length.toLocaleString("th-TH")} สัญญา${waitingPay.length ? ` (รอรับเงิน ${waitingPay.length})` : ""}`}
          accent={WARN}
          onClick={() => onFilter("open")}
        />
        <Tile
          label="เกินกำหนดส่งใช้"
          value={overdue.length.toLocaleString("th-TH")}
          suffix="สัญญา"
          sub={overdue.length ? `คงค้าง ${baht(sum(overdue, "outstanding"))} บาท — ต้องเรียกชดใช้ (ข้อ 68)` : "ไม่มีสัญญาเกินกำหนด"}
          accent={overdue.length ? RED : GOOD}
          onClick={() => onFilter("overdue")}
        />
        <Tile
          label={`ครบกำหนดใน ${SOON_DAYS} วัน`}
          value={soon.length.toLocaleString("th-TH")}
          suffix="สัญญา"
          sub={soon.length ? `คงค้าง ${baht(sum(soon, "outstanding"))} บาท` : "ยังไม่มีสัญญาใกล้ครบกำหนด"}
          accent={WARN}
        />
        <Tile
          label="รอการเงินตรวจสอบ"
          value={pendingCheck.length.toLocaleString("th-TH")}
          suffix="สัญญา"
          sub="ยื่นแล้ว ยังไม่ออกเลขที่สัญญา"
          accent={BRAND}
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="card">
          <div className="card-title">ปีงบประมาณ {fy}</div>
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="text-slate-600">
              ยืม <b className="tabular-nums text-slate-900">{baht(yearAmount)}</b> บาท ({yearLoans.length.toLocaleString("th-TH")} สัญญา)
            </span>
            <span className="text-slate-600">
              ส่งใช้แล้ว <b className="tabular-nums text-slate-900">{baht(yearRepaid)}</b> บาท ({repaidPct.toFixed(1)}%)
            </span>
          </div>
          <div
            className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-100"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(repaidPct)}
            aria-label="สัดส่วนส่งใช้แล้วต่อยอดยืมทั้งปีงบ"
            title={`ส่งใช้แล้ว ${baht(yearRepaid)} จาก ${baht(yearAmount)} บาท`}
          >
            <div className="h-full rounded-full" style={{ width: `${repaidPct}%`, background: GOOD }} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            คงค้างของปีงบนี้ {baht(Math.max(yearAmount - yearRepaid, 0))} บาท — กำหนดส่งใช้: จัดซื้อ/กิจกรรม 30 วันนับแต่วันรับเงิน, ไปราชการ 15 วันนับแต่วันกลับ
          </p>
        </div>

        <div className="card">
          <div className="card-title">ต้องติดตาม</div>
          {watch.length === 0 ? (
            <p className="text-sm text-slate-500">ไม่มีสัญญาเกินกำหนดหรือใกล้ครบกำหนด</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {watch.map((l) => {
                const d = l.due_date ? daysBetween(today, l.due_date) : 0;
                return (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 py-1.5">
                    <span className="min-w-0">
                      <span className="font-medium text-slate-900">{l.borrower_name}</span>
                      <span className="text-slate-500"> · {l.doc_no ?? "-"}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums text-slate-700">{baht(l.outstanding)}</span>
                      {l.overdue ? (
                        <span className="badge-red !text-sm">เกิน {Math.abs(d)} วัน</span>
                      ) : (
                        <span className="badge-amber !text-sm">{d === 0 ? "ครบวันนี้" : `อีก ${d} วัน`}</span>
                      )}
                    </span>
                    {l.due_date && <span className="w-full text-xs text-slate-400">ครบกำหนด {formatThaiDate(l.due_date)}</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
