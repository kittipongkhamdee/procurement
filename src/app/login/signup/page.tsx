import Image from "next/image";
import { signup } from "./actions";
import { getSchoolSettings } from "@/lib/school-settings-server";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { schoolName, logoUrl } = await getSchoolSettings();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div
            className={
              logoUrl
                ? "mx-auto mb-3 flex h-12 w-12 items-center justify-center"
                : "mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-gold-400 bg-navy-950 text-base font-bold text-gold-400"
            }
          >
            {logoUrl ? (
              <Image src={logoUrl} alt={schoolName} width={48} height={48} unoptimized className="h-full w-full object-contain" />
            ) : (
              schoolName.charAt(0) || "ร"
            )}
          </div>
          <h1 className="text-lg font-bold text-slate-900">สมัครสมาชิก</h1>
          <p className="text-sm text-slate-500">
            ระบบบริหารงานงบประมาณ {schoolName}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <form action={signup} className="space-y-4">
          <div>
            <label htmlFor="full_name" className="label">
              ชื่อ-นามสกุล
            </label>
            <input id="full_name" name="full_name" type="text" required className="input" />
          </div>
          <div>
            <label htmlFor="email" className="label">
              อีเมล
            </label>
            <input id="email" name="email" type="email" required className="input" />
          </div>
          <div>
            <label htmlFor="password" className="label">
              รหัสผ่าน
            </label>
            <input id="password" name="password" type="password" required minLength={6} className="input" />
          </div>
          <button type="submit" className="btn-primary w-full">
            สมัครสมาชิก
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          บัญชีใหม่จะได้สิทธิ์ระดับ &ldquo;ครู&rdquo; ก่อน — ให้แอดมินปรับสิทธิ์ที่หน้าจัดการผู้ใช้
        </p>
        <p className="mt-2 text-center text-sm">
          <a href="/login" className="text-navy-800 hover:underline">
            มีบัญชีแล้ว? เข้าสู่ระบบ
          </a>
        </p>
      </div>
    </div>
  );
}
