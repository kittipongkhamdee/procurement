"use client";

import { useEffect, useRef, useState } from "react";
import { QrCodeIcon } from "@/components/icons";
import { toastError } from "@/lib/swal";

// BarcodeDetector เป็น Web API ในตัวเบราว์เซอร์ (รองรับ Chrome/Edge/Android) ใช้ถอดรหัส QR จากภาพ
// วิดีโอกล้องได้เลยโดยไม่ต้องพึ่งไลบรารีถอดรหัสเพิ่ม — เบราว์เซอร์ที่ไม่รองรับ (เช่น Safari/iOS
// เก่า) จะแจ้งให้ใช้กล้องมือถือสแกนแล้วพิมพ์รหัสเองแทน
type BarcodeDetectorLike = {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
};

export function QrScanButton({ onScan }: { onScan: (value: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [open, setOpen] = useState(false);
  // ตรวจสอบครั้งเดียวตอน mount (ไม่ใช่ใน effect ตอน open) — ค่านี้ไม่เปลี่ยนระหว่างที่หน้าเปิดอยู่
  const [unsupported] = useState(() => typeof window !== "undefined" && !("BarcodeDetector" in window));

  useEffect(() => {
    if (!open || unsupported) return;

    const win = window as typeof window & { BarcodeDetector: new (opts: { formats: string[] }) => BarcodeDetectorLike };
    const detector = new win.BarcodeDetector({ formats: ["qr_code"] });

    let cancelled = false;
    let rafId = 0;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              onScan(codes[0].rawValue);
              setOpen(false);
              return;
            }
          } catch {
            // เฟรมยังไม่พร้อม (เช่นวิดีโอยังไม่เริ่มเล่น) ข้ามไปลองเฟรมถัดไป
          }
          rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
      })
      .catch(() => {
        void toastError("ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการใช้กล้องในเบราว์เซอร์");
        setOpen(false);
      });

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    };
  }, [open, unsupported, onScan]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-secondary btn-sm shrink-0">
        <QrCodeIcon className="h-3.5 w-3.5" />
        สแกน QR
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-lg bg-white p-4" onClick={(e) => e.stopPropagation()}>
            <p className="mb-2 text-sm font-semibold text-navy-900">สแกน QR Code</p>
            {unsupported ? (
              <p className="text-sm text-slate-500">
                เบราว์เซอร์นี้ไม่รองรับการสแกน QR โดยตรง กรุณาใช้กล้องมือถือสแกนแล้วพิมพ์รหัสที่ได้ลงช่องค้นหาแทน
              </p>
            ) : (
              <video ref={videoRef} className="w-full rounded-md bg-black" muted playsInline />
            )}
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary btn-sm mt-3 w-full">
              ปิด
            </button>
          </div>
        </div>
      )}
    </>
  );
}
