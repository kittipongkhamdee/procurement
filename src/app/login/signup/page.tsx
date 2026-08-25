import { signup } from "./actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-lg font-semibold text-slate-900">สมัครสมาชิก</h1>
          <p className="text-sm text-slate-500">
            ระบบบริหารงานงบประมาณ โรงเรียนตาเบาวิทยา
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <form action={signup} className="space-y-4">
          <div>
            <label htmlFor="full_name" className="mb-1 block text-sm font-medium text-slate-700">
              ชื่อ-นามสกุล
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
              อีเมล
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
              รหัสผ่าน
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            สมัครสมาชิก
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          บัญชีใหม่จะได้สิทธิ์ระดับ &ldquo;ครู&rdquo; ก่อน — ให้แอดมินปรับสิทธิ์ที่หน้าจัดการผู้ใช้
        </p>
        <p className="mt-2 text-center text-sm">
          <a href="/login" className="text-blue-600 hover:underline">
            มีบัญชีแล้ว? เข้าสู่ระบบ
          </a>
        </p>
      </div>
    </div>
  );
}
