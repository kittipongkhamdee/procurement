// การ์ดบัญชีเงินฝากแบบสมุดบัญชี (แถบสีธนาคารด้านซ้าย + ชื่อกองทุน/เลขบัญชี + ยอดคงเหลือตัวใหญ่)
// สีเป็นโทนตัวแทนของแต่ละธนาคาร ตัวย่อในวงกลมเป็นตัวอักษรธรรมดา — ไม่ได้ใช้โลโก้จริงของธนาคาร (เครื่องหมายการค้า)
// จับคู่ธนาคารจากคำในชื่อที่การเงินกรอกไว้ (fin_accounts.bank_name) ถ้าไม่ตรง/ไม่กรอก = สีเทา "ยังไม่ระบุ"

import Link from "next/link";

type BankStyle = { abbr: string; label: string; c1: string; c2: string; ink: string };

const BANKS: { keys: string[]; style: BankStyle }[] = [
  { keys: ["กรุงไทย", "ktb"], style: { abbr: "KTB", label: "กรุงไทย", c1: "#00a6e6", c2: "#0077b6", ink: "#fff" } },
  { keys: ["ธ.ก.ส", "ธกส", "เพื่อการเกษตร", "baac"], style: { abbr: "BAAC", label: "ธ.ก.ส.", c1: "#2aa84a", c2: "#13752f", ink: "#fff" } },
  { keys: ["ออมสิน", "gsb"], style: { abbr: "GSB", label: "ออมสิน", c1: "#ec2f97", c2: "#b81269", ink: "#fff" } },
  { keys: ["กสิกร", "kbank"], style: { abbr: "KBank", label: "กสิกรไทย", c1: "#2fb44a", c2: "#138f2d", ink: "#fff" } },
  { keys: ["ไทยพาณิชย์", "scb"], style: { abbr: "SCB", label: "ไทยพาณิชย์", c1: "#7a4fb8", c2: "#4e2e7f", ink: "#fff" } },
  { keys: ["กรุงเทพ", "bbl"], style: { abbr: "BBL", label: "กรุงเทพ", c1: "#2f62c4", c2: "#1e4598", ink: "#fff" } },
  { keys: ["กรุงศรี", "krungsri", "bay"], style: { abbr: "BAY", label: "กรุงศรี", c1: "#ffd24a", c2: "#e0a800", ink: "#1f2937" } },
  { keys: ["ทหารไทย", "ธนชาต", "ttb"], style: { abbr: "ttb", label: "ทหารไทยธนชาต", c1: "#ff9a3c", c2: "#e06a00", ink: "#fff" } },
];
const NONE: BankStyle = { abbr: "—", label: "ไม่ระบุ", c1: "#94a3b8", c2: "#64748b", ink: "#fff" };

export function bankStyleOf(bankName: string | null | undefined): BankStyle {
  const n = (bankName ?? "").toLowerCase().replace(/\s+/g, "");
  if (!n) return NONE;
  return BANKS.find((b) => b.keys.some((k) => n.includes(k.toLowerCase().replace(/\s+/g, ""))))?.style ?? { ...NONE, label: bankName!.trim().slice(0, 14) };
}

export function BankAccountCard({
  name,
  bankName,
  accountNo,
  balance,
  settingsHref,
}: {
  name: string;
  bankName: string | null;
  accountNo: string | null;
  balance: number;
  /** ลิงก์ไปตั้งค่าธนาคาร/เลขบัญชี — ใส่เมื่อผู้ใช้มีสิทธิ์แก้ (แสดงเมื่อข้อมูลยังไม่ครบ) */
  settingsHref?: string;
}) {
  const st = bankStyleOf(bankName);
  const incomplete = !bankName?.trim() || !accountNo?.trim();
  return (
    <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div
        className="flex w-[84px] shrink-0 flex-col items-center justify-center gap-1.5 px-1.5 py-3 text-center text-[11px] font-bold"
        style={{ background: `linear-gradient(180deg, ${st.c1}, ${st.c2})`, color: st.ink }}
      >
        <span className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-white text-[11px] font-bold" style={{ color: st.c2 }}>
          {st.abbr}
        </span>
        <span className="leading-tight">{st.label}</span>
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-900">{name}</p>
          <p className="text-[13px] tracking-wide text-slate-500">{accountNo?.trim() || "ยังไม่ระบุเลขบัญชี"}</p>
          {incomplete && settingsHref && (
            <Link href={settingsHref} className="mt-1 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 hover:bg-slate-200">
              ไปตั้งค่า
            </Link>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[11px] text-slate-500">คงเหลือ (บาท)</p>
          <p className="text-[26px] font-bold leading-none tabular-nums" style={{ color: st.c2 }}>
            {balance.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>
    </div>
  );
}
