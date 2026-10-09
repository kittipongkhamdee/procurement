"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";

export type ModalHandle = { close: () => void };

export const Modal = forwardRef<
  ModalHandle,
  {
    trigger: ReactNode;
    triggerClassName?: string;
    title: string;
    children: ReactNode;
    /** ปิด popup ทันทีที่กด submit ฟอร์มใดๆ ข้างใน (เหมาะกับ popup ที่มีฟอร์มเดียว) */
    closeOnSubmit?: boolean;
    /** ขยายความกว้างสูงสุดของ popup — ใช้กับฟอร์มที่มีเนื้อหาเยอะ/มีตาราง เช่น เสนอโครงการ, รายงานโครงการ (ค่าเริ่มต้น max-w-2xl) */
    wide?: boolean;
    /** เปิด popup อัตโนมัติทันทีตอน mount — ใช้กับลิงก์ลัดจากหน้า "ผู้บริหาร" (เช่น
     * /project-proposals?open=<id>) ที่ต้องการพาผู้ใช้เข้าไปยังป็อปอัปรายการนั้นตรงๆ */
    defaultOpen?: boolean;
    /** แจ้งสถานะเปิด/ปิดของ popup — ใช้ให้เนื้อหาหนัก (เช่น iframe PDF) โหลดเฉพาะตอนเปิดดูจริง เพราะเนื้อหาใน popup ถูก
     * เรนเดอร์ไว้ใน <dialog> ที่ปิดอยู่เสมอ ถ้าไม่ lazy จะโหลดทุกแถวพร้อมกันตั้งแต่เปิดหน้า (มือถือหน่วยความจำไม่พอแล้วหน้าค้าง/รีเฟรช) */
    onOpenChange?: (open: boolean) => void;
    /** เรนเดอร์เนื้อหาเมื่อ popup ถูกเปิดครั้งแรก (เปิดแล้วคงไว้ ไม่ถอดตอนปิด จึงไม่เสียข้อมูลที่กรอกค้างไว้) — ใช้กับรายการยาว
     * ที่มี popup หนักๆ ต่อแถว (ฟอร์มแก้ไข/รายละเอียด) ไม่งั้นทุกแถวเรนเดอร์ไว้ตั้งแต่เปิดหน้า มือถือหน่วยความจำไม่พอแล้วหน้าค้าง */
    lazy?: boolean;
  }
>(function Modal(
  { trigger, triggerClassName, title, children, closeOnSubmit, wide, defaultOpen, onOpenChange, lazy },
  forwardedRef,
) {
  const ref = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(false);

  useImperativeHandle(forwardedRef, () => ({
    close: () => ref.current?.close(),
  }));

  useEffect(() => {
    if (!defaultOpen || !ref.current) return;
    // แต่ละแถวมักเรนเดอร์ 2 ชุด (การ์ดมือถือ md:hidden + ตารางจอกว้าง hidden md:table) —
    // ถ้าเรียก showModal() ทั้งคู่พร้อมกัน dialog ที่อยู่ใต้ ancestor display:none จะกลาย
    // เป็น modal ที่มองไม่เห็นแต่ยังแย่ง top layer ไปบล็อกการคลิก/กดปิด popup ที่มองเห็นอยู่ —
    // ไล่เช็ค ancestor ก่อนว่าถูกซ่อนอยู่หรือไม่ ถ้าซ่อนอยู่ก็ไม่ต้องเปิด dialog นี้
    let el: HTMLElement | null = ref.current.parentElement;
    while (el) {
      if (getComputedStyle(el).display === "none") return;
      el = el.parentElement;
    }
    setOpened(true);
    ref.current.showModal();
    onOpenChange?.(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => {
          setOpened(true);
          onOpenChange?.(true);
          ref.current?.showModal();
        }}
      >
        {trigger}
      </button>
      <dialog
        ref={ref}
        onClose={() => onOpenChange?.(false)}
        className={`m-auto w-full text-left ${wide ? "max-w-6xl" : "max-w-2xl"} rounded-xl border-0 bg-white p-0 shadow-2xl backdrop:bg-navy-950/60`}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
      >
        <div
          onSubmit={() => {
            if (closeOnSubmit) ref.current?.close();
          }}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-bold text-navy-900">{title}</h2>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="ปิด"
              className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
          <div className="max-h-[75vh] overflow-y-auto p-5">{lazy && !opened ? null : children}</div>
        </div>
      </dialog>
    </>
  );
});
