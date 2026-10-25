"use client";

// สลิปเงินเดือน — ฟอร์มช่วยเปิดสลิปเงินเดือนจากเว็บทางการของ สพม.สุรินทร์ (salaryweb3.sesao33.net)
// หน้านี้ "ไม่" เก็บหรือดึงข้อมูลเงินเดือนมาไว้ในระบบเราเอง เพียงประกอบลิงก์แล้วเปิดหน้าสลิปบนเว็บต้นทาง
// ในหน้าต่างเล็ก/ป๊อปอัป (ข้อมูลและการควบคุมสิทธิ์ทั้งหมดอยู่ที่เว็บต้นทาง) — จึงไม่ต้องกรอกเลขบัญชีธนาคาร เพราะเว็บ
// ต้นทางแสดงผลได้ด้วยเลขบัตรประชาชน + เดือน/ปี (ดูฟอร์ม repslp.php ของต้นทาง)

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { THAI_MONTHS, todayTh } from "@/lib/thai";
import { CoinsIcon } from "@/components/icons";

// ฐานของเว็บทางการและพารามิเตอร์คงที่ของหน้า repslp.php (ถอดมาจากลิงก์ที่ต้นทางใช้)
const SLIP_BASE = "http://salaryweb3.sesao33.net/repslp.php";
const SLIP_FIXED = {
  app: "รายละเอียดบัญชีจ่ายเงินรายเดือน",
  fd: "/home/salaryweb3/homes/data/",
  bk: "2",
  cm: "สำนักงานเขตพื้นที่การศึกษาสุรินทร์",
};

// จำเลขบัตรไว้ในเบราว์เซอร์ของเครื่องนี้ (localStorage) ไม่ส่งขึ้นเซิร์ฟเวอร์ — แยกคีย์ตามผู้ใช้ที่ล็อกอิน
// กันกรณีใช้เครื่องร่วมกันแล้วเห็นเลขบัตรของอีกคน
const storageKey = (userId: string) => `salary-slip-national-id:${userId}`;

export default function SalarySlipPage() {
  const { user } = useAuth();
  const userId = user?.userId ?? null;
  const today = todayTh(); // "YYYY-MM-DD" (ค.ศ.)
  const curMonth = today.slice(5, 7); // "01".."12"
  const curYearBE = Number(today.slice(0, 4)) + 543;

  const [nationalId, setNationalId] = useState("");
  const [month, setMonth] = useState(curMonth);
  const [yearBE, setYearBE] = useState(String(curYearBE));
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(true);
  const [hasSaved, setHasSaved] = useState(false);

  // โหลดเลขบัตรที่จำไว้เป็นค่าเริ่มต้น (อ่านได้เฉพาะฝั่ง client หลังรู้ว่าใครล็อกอินอยู่)
  useEffect(() => {
    if (!userId) return;
    try {
      const saved = localStorage.getItem(storageKey(userId));
      if (saved && /^\d{13}$/.test(saved)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNationalId(saved);
        setHasSaved(true);
      }
    } catch {
      // เบราว์เซอร์ปิดการเก็บข้อมูล — ใช้งานต่อได้ แค่ไม่จำค่า
    }
  }, [userId]);

  function forgetSaved() {
    try {
      if (userId) localStorage.removeItem(storageKey(userId));
    } catch {
      // ไม่มีอะไรต้องทำ
    }
    setNationalId("");
    setHasSaved(false);
  }

  function openSlip(e: React.FormEvent) {
    e.preventDefault();
    const id = nationalId.replace(/\D/g, "");
    if (id.length !== 13) {
      setError("กรุณากรอกเลขประจำตัวประชาชนให้ครบ 13 หลัก");
      return;
    }
    if (!/^25\d{2}$/.test(yearBE)) {
      setError("กรุณากรอกปี พ.ศ. 4 หลัก (เช่น 2569)");
      return;
    }
    setError("");
    try {
      if (userId) {
        if (remember) {
          localStorage.setItem(storageKey(userId), id);
          setHasSaved(true);
        } else {
          localStorage.removeItem(storageKey(userId));
          setHasSaved(false);
        }
      }
    } catch {
      // เก็บไม่ได้ก็ไม่เป็นไร เปิดสลิปต่อตามปกติ
    }
    const params = new URLSearchParams({
      app: SLIP_FIXED.app,
      tag: id,
      fd: SLIP_FIXED.fd,
      fi: `${month}${yearBE}`, // เดือน 2 หลัก + ปี พ.ศ. 4 หลัก เช่น 102569
      bk: SLIP_FIXED.bk,
      cm: SLIP_FIXED.cm,
    });
    // เปิดเป็นหน้าต่างเล็กขนาดพอดีสลิป กลางจอ (เว็บต้นทางเป็น http จึงฝัง iframe ในหน้า https ของเราไม่ได้ — ถูกบล็อก)
    // บนมือถือเบราว์เซอร์มักเปิดเป็นแท็บใหม่แทนหน้าต่างเล็กเอง ซึ่งใช้งานได้ตามปกติ
    const w = Math.min(960, window.screen.availWidth - 40);
    const h = Math.min(720, window.screen.availHeight - 80);
    const left = Math.max(0, Math.round((window.screen.availWidth - w) / 2));
    const top = Math.max(0, Math.round((window.screen.availHeight - h) / 2));
    const win = window.open(
      `${SLIP_BASE}?${params.toString()}`,
      "salaryslip",
      `popup=yes,width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`,
    );
    if (!win) setError("เบราว์เซอร์บล็อกหน้าต่างป๊อปอัป กรุณาอนุญาตป๊อปอัปสำหรับเว็บนี้แล้วกดอีกครั้ง");
    else win.focus();
  }

  // ปีให้เลือก: ปีปัจจุบัน ย้อนหลัง 3 ปี
  const yearOptions = Array.from({ length: 4 }, (_, i) => curYearBE - i);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">สลิปเงินเดือน</h1>
          <p className="page-subtitle">เปิดดูสลิปเงินเดือนจากระบบของสำนักงานเขตพื้นที่การศึกษามัธยมศึกษาสุรินทร์</p>
        </div>
      </div>

      <div className="card max-w-xl">
        <form onSubmit={openSlip} className="space-y-4">
          <div>
            <label className="label">เลขประจำตัวประชาชน (13 หลัก)</label>
            <input
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value.replace(/\D/g, "").slice(0, 13))}
              inputMode="numeric"
              autoComplete="off"
              placeholder="เช่น 1234567890123"
              className="input w-full tracking-widest"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">เดือน</label>
              <select value={month} onChange={(e) => setMonth(e.target.value)} className="input w-full">
                {THAI_MONTHS.slice(1).map((m, i) => (
                  <option key={m} value={String(i + 1).padStart(2, "0")}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">ปี พ.ศ.</label>
              <select value={yearBE} onChange={(e) => setYearBE(e.target.value)} className="input w-full">
                {yearOptions.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <label className="flex items-center gap-2 text-slate-700">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              จำเลขบัตรไว้ในเครื่องนี้
            </label>
            {hasSaved && (
              <button type="button" onClick={forgetSaved} className="text-red-600 hover:underline">
                ลบเลขบัตรที่จำไว้
              </button>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" className="btn-primary inline-flex items-center gap-2">
            <CoinsIcon className="h-4 w-4" />
            เปิดสลิปเงินเดือน
          </button>
        </form>

        <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
          สลิปจะเปิดในหน้าต่างเล็กจากเว็บ salaryweb3.sesao33.net โดยตรง — ระบบนี้ไม่ได้เก็บข้อมูลเงินเดือนของท่านไว้
          ไม่ต้องกรอกเลขบัญชีธนาคาร
          · เลขบัตรที่จำไว้เก็บเฉพาะในเบราว์เซอร์ของเครื่องนี้ ไม่ส่งไปเก็บที่เซิร์ฟเวอร์ ถ้าใช้เครื่องร่วมกับผู้อื่น
          ให้เอาเครื่องหมายถูกออก หรือกด &quot;ลบเลขบัตรที่จำไว้&quot;
        </p>
      </div>
    </div>
  );
}
