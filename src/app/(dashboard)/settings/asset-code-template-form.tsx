"use client";

import { useState } from "react";
import { renderNumberTemplate } from "@/lib/format-template";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import type { setAssetCodeTemplate as setAssetCodeTemplateAction } from "./actions";

const EXAMPLE_VARS = { prefix: "ต.บ.ว.", type_code: "20", item_code: "01", seq: 5, yy: "69", yyyy: 2569 };

export function AssetCodeTemplateForm({
  template,
  setAssetCodeTemplate,
  onChanged,
}: {
  template: string;
  setAssetCodeTemplate: typeof setAssetCodeTemplateAction;
  onChanged: () => void;
}) {
  const [value, setValue] = useState(template);
  const [saving, setSaving] = useState(false);

  const preview = renderNumberTemplate(value, EXAMPLE_VARS);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("asset_code_template", value);
      const result = await setAssetCodeTemplate(fd);
      if (result?.error) {
        await toastError(result.error);
        return;
      }
      await toastSuccess("บันทึกรูปแบบเลขครุภัณฑ์แล้ว");
      onChanged();
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="label">รูปแบบเลขครุภัณฑ์</label>
        <input value={value} onChange={(e) => setValue(e.target.value)} required className="input w-full font-mono" />
      </div>
      <p className="text-xs text-slate-500">
        ตัวแปรที่ใช้ได้: <code className="rounded bg-slate-100 px-1">{"{prefix}"}</code> อักษรย่อโรงเรียน,{" "}
        <code className="rounded bg-slate-100 px-1">{"{type_code}"}</code> รหัสหมวดหมู่,{" "}
        <code className="rounded bg-slate-100 px-1">{"{item_code}"}</code> รหัสชนิดครุภัณฑ์,{" "}
        <code className="rounded bg-slate-100 px-1">{"{seq}"}</code> หรือ{" "}
        <code className="rounded bg-slate-100 px-1">{"{seq:3}"}</code> เลขลำดับ (ใส่ :N เพื่อเติม 0 นำหน้าให้ครบ N หลัก),{" "}
        <code className="rounded bg-slate-100 px-1">{"{yy}"}</code>/<code className="rounded bg-slate-100 px-1">{"{yyyy}"}</code>{" "}
        ปีงบประมาณ พ.ศ. 2/4 หลัก
      </p>
      <p className="text-sm text-slate-500">
        ตัวอย่าง: <span className="font-medium text-navy-800">{preview || "-"}</span>
      </p>
      <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
        {saving ? "กำลังบันทึก..." : "บันทึกรูปแบบ"}
      </button>
    </form>
  );
}
