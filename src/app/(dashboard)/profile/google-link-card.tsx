"use client";

// ผูก/ยกเลิกผูกบัญชี Google ของผู้ใช้ที่ล็อกอินอยู่ — ผูกแล้วเข้าสู่ระบบด้วยปุ่ม Google ที่หน้า login ได้
// (ใช้ supabase.auth.linkIdentity — ต้องเปิด "Manual linking" ใน Supabase Auth และเปิดผู้ให้บริการ Google ไว้)

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { confirmDelete, errorMessage, toastError, toastSuccess } from "@/lib/swal";

type Identity = { identity_id: string; provider: string; identity_data?: { email?: string } | null };

export function GoogleLinkCard() {
  const [identities, setIdentities] = useState<Identity[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.auth.getUserIdentities();
    setIdentities((data?.identities ?? []) as unknown as Identity[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const params = new URLSearchParams(window.location.search);
    const err = params.get("google_error");
    if (err) {
      toastError(`ผูกบัญชี Google ไม่สำเร็จ: ${err}`);
      window.history.replaceState(null, "", "/profile");
    }
  }, [load]);

  const google = identities?.find((i) => i.provider === "google") ?? null;
  const hasOther = (identities ?? []).some((i) => i.provider !== "google");

  async function link() {
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/profile` },
      });
      if (error) throw error;
    } catch (err) {
      setBusy(false);
      await toastError(errorMessage(err));
    }
  }

  async function unlink() {
    if (!google) return;
    const ok = await confirmDelete({
      title: "ยกเลิกการผูกบัญชี Google?",
      text: "หลังยกเลิก จะเข้าสู่ระบบด้วย Google ไม่ได้ ใช้อีเมล/รหัสผ่านตามเดิม",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.unlinkIdentity(google as never);
      if (error) throw error;
      await load();
      await toastSuccess("ยกเลิกการผูกบัญชี Google แล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-title mb-4">บัญชี Google</div>
      {identities === null ? (
        <p className="text-sm text-slate-400">กำลังโหลด...</p>
      ) : google ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            ผูกกับ Google แล้ว: <span className="font-medium">{google.identity_data?.email ?? "-"}</span>
          </p>
          <p className="text-xs text-slate-500">เข้าสู่ระบบด้วยปุ่ม &quot;เข้าสู่ระบบด้วย Google&quot; ที่หน้า login ได้</p>
          <button type="button" onClick={unlink} disabled={busy || !hasOther} className="btn-secondary btn-sm text-red-600 disabled:opacity-50">
            ยกเลิกการผูก
          </button>
          {!hasOther && <p className="text-xs text-slate-500">ยกเลิกไม่ได้ เพราะเป็นวิธีเข้าสู่ระบบเดียวของบัญชีนี้</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">ผูกบัญชี Google ของคุณกับผู้ใช้นี้ เพื่อเข้าสู่ระบบด้วย Google ได้โดยไม่ต้องพิมพ์รหัสผ่าน</p>
          <button type="button" onClick={link} disabled={busy} className="btn-primary btn-sm">
            {busy ? "กำลังไปที่ Google..." : "ผูกบัญชี Google"}
          </button>
        </div>
      )}
    </div>
  );
}
