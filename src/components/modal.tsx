"use client";

import { forwardRef, useImperativeHandle, useRef, type ReactNode } from "react";

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
  }
>(function Modal({ trigger, triggerClassName, title, children, closeOnSubmit }, forwardedRef) {
  const ref = useRef<HTMLDialogElement>(null);

  useImperativeHandle(forwardedRef, () => ({
    close: () => ref.current?.close(),
  }));

  return (
    <>
      <button type="button" className={triggerClassName} onClick={() => ref.current?.showModal()}>
        {trigger}
      </button>
      <dialog
        ref={ref}
        className="m-auto w-full max-w-2xl rounded-xl border-0 bg-white p-0 shadow-2xl backdrop:bg-navy-950/60"
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
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="ปิด"
              className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              ✕
            </button>
          </div>
          <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
        </div>
      </dialog>
    </>
  );
});
