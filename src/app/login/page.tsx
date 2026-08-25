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
          <h1 className="text-lg font-semibold text-slate-900">
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
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            เข้าสู่ระบบ
          </button>
        </form>

        <p className="mt-4 text-center text-sm">
          <a href="/login/signup" className="text-blue-600 hover:underline">
            ยังไม่มีบัญชี? สมัครสมาชิก
          </a>
        </p>
      </div>
    </div>
  );
}
