import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-gold-400 bg-navy-950 text-base font-bold text-gold-400">
            ตว
          </div>
          <h1 className="text-lg font-bold text-slate-900">
            ระบบบริหารงานงบประมาณ
          </h1>
          <p className="text-sm text-slate-500">โรงเรียนตาเบาวิทยา</p>
        </div>

        {notice && (
          <div className="mb-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form action={login} className="space-y-4">
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
            <input id="password" name="password" type="password" required className="input" />
          </div>
          <button type="submit" className="btn-primary w-full">
            เข้าสู่ระบบ
          </button>
        </form>

        <p className="mt-4 text-center text-sm">
          <a href="/login/signup" className="text-navy-800 hover:underline">
            ยังไม่มีบัญชี? สมัครสมาชิก
          </a>
        </p>
      </div>
    </div>
  );
}
