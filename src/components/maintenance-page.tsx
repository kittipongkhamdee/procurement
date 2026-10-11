"use client";

// หน้า "ปิดปรับปรุงระบบชั่วคราว" — แสดงแทนทั้งระบบให้ผู้ใช้ที่ไม่ใช่ผู้ดูแลระบบ ตอนที่แอดมินเปิดโหมดปิดปรับปรุง
// (ตั้งค่าที่ ตั้งค่าระบบ > ปิดปรับปรุงระบบชั่วคราว) — ใช้ระหว่างประมวลผล/ย้ายข้อมูลที่ไม่อยากให้ใครแก้ไขข้อมูลพร้อมกัน

export const DEFAULT_MAINTENANCE_MESSAGE =
  "ขณะนี้ระบบปิดปรับปรุงชั่วคราวเพื่อประมวลผลข้อมูล กรุณากลับมาใช้งานใหม่อีกครั้งในภายหลัง ขออภัยในความไม่สะดวก";

export function MaintenancePage({
  schoolName,
  logoUrl,
  message,
  checking,
  checkedStillClosed,
  onRetry,
  logoutAction,
  preview = false,
}: {
  schoolName: string;
  logoUrl: string | null;
  message: string | null;
  checking: boolean;
  /** เพิ่งกดตรวจสอบแล้วยังปิดอยู่ */
  checkedStillClosed: boolean;
  onRetry: () => void;
  logoutAction: (formData: FormData) => void | Promise<void>;
  /** ตัวอย่างสำหรับผู้ดูแลระบบ (เปิดจากหน้าตั้งค่า) — ไม่ได้ปิดระบบจริง */
  preview?: boolean;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-navy-950 to-navy-800 p-4">
      {preview && (
        <div className="fixed inset-x-0 top-0 bg-amber-500 px-4 py-1.5 text-center text-sm font-semibold text-navy-950">
          ตัวอย่างหน้าที่ผู้ใช้จะเห็นตอนปิดปรับปรุง (ยังไม่ได้ปิดระบบจริง) —{" "}
          <a href="/settings" className="underline">
            กลับไปหน้าตั้งค่า
          </a>
        </div>
      )}
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-2xl">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={schoolName} className="mx-auto h-16 w-16 object-contain" />
        ) : (
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold-400 bg-navy-950 text-xl font-bold text-gold-400">
            {schoolName.charAt(0) || "ร"}
          </span>
        )}
        <p className="mt-3 text-sm font-semibold text-slate-700">{schoolName}</p>

        <div className="mx-auto mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-7 w-7" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5a1.8 1.8 0 0 0 2.5 2.5l5.8-5.8a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.1-.5-.5-2.1 2.7-2.5Z"
            />
          </svg>
        </div>

        <h1 className="mt-4 text-xl font-bold text-navy-800">ระบบปิดปรับปรุงชั่วคราว</h1>
        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">
          {message?.trim() || DEFAULT_MAINTENANCE_MESSAGE}
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <button type="button" onClick={onRetry} disabled={checking || preview} className="btn-primary">
            {checking ? "กำลังตรวจสอบ..." : "ตรวจสอบอีกครั้ง"}
          </button>
          {preview ? (
            <span className="btn-secondary cursor-not-allowed opacity-60">ออกจากระบบ</span>
          ) : (
            <form action={logoutAction}>
              <button type="submit" className="btn-secondary w-full">
                ออกจากระบบ
              </button>
            </form>
          )}
        </div>
        <p className="mt-4 text-xs text-slate-400" role="status">
          {checkedStillClosed ? "ตรวจสอบแล้ว ระบบยังปิดปรับปรุงอยู่ — " : ""}
          ระบบจะตรวจสอบให้อัตโนมัติ เมื่อเปิดใช้งานแล้วหน้านี้จะเปลี่ยนกลับเอง
        </p>
      </div>
    </main>
  );
}
