"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";

export function QrCodeButton({ value, filename }: { value: string; filename: string }) {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !value) return;
    QRCode.toDataURL(value, { width: 320, margin: 1, color: { dark: "#0f1f3d" } }).then(setDataUrl);
  }, [open, value]);

  return (
    <>
      <button type="button" onClick={() => setOpen((v) => !v)} className="btn-secondary btn-sm">
        {open ? "ซ่อน QR Code" : "แสดง QR Code"}
      </button>

      {open && dataUrl && (
        <div className="mt-3 flex flex-col items-start gap-2">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <Image src={dataUrl} alt="QR Code ลิงก์แบบประเมิน" width={160} height={160} unoptimized />
          </div>
          <a href={dataUrl} download={filename} className="btn-secondary btn-sm">
            ดาวน์โหลด QR Code
          </a>
        </div>
      )}
    </>
  );
}
