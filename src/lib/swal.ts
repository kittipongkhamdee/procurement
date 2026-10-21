"use client";

// SweetAlert2 touches `document` at import time, so it must only ever be
// loaded from client code, and lazily (dynamic import) so it never runs
// during server-side rendering of a "use client" component's initial HTML.
async function loadSwal() {
  const { default: Swal } = await import("sweetalert2");

  // Our popups (projects/edit) use a native <dialog>.showModal(), which the
  // browser promotes into the "top layer" — that always paints above every
  // normal z-indexed element, SweetAlert2 included, no matter how high its
  // z-index is set. Appending the swal popup *inside* the open dialog makes
  // it part of the same top-layer stack instead, so it renders above it.
  const openDialog = document.querySelector<HTMLDialogElement>("dialog[open]");

  return Swal.mixin({
    confirmButtonColor: "#123361",
    cancelButtonColor: "#64748b",
    reverseButtons: true,
    buttonsStyling: true,
    target: openDialog ?? document.body,
  });
}

export async function confirmDelete(opts: { title: string; text?: string }) {
  const swal = await loadSwal();
  const result = await swal.fire({
    title: opts.title,
    text: opts.text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: "ลบ",
    cancelButtonText: "ยกเลิก",
    confirmButtonColor: "#dc2626",
    focusCancel: true,
  });
  return result.isConfirmed;
}

export async function confirmWarning(opts: { title: string; text?: string; confirmButtonText?: string }) {
  const swal = await loadSwal();
  const result = await swal.fire({
    title: opts.title,
    text: opts.text,
    icon: "warning",
    showCancelButton: true,
    confirmButtonText: opts.confirmButtonText ?? "ดำเนินการต่อ",
    cancelButtonText: "ยกเลิก",
    focusCancel: true,
  });
  return result.isConfirmed;
}

/** ถามตกลง/ไม่ตกลง โดยกำหนดข้อความปุ่มได้ทั้งสองปุ่ม (html แสดงรายละเอียดเป็นรายการได้) */
export async function confirmChoice(opts: { title: string; text?: string; html?: string; confirmButtonText: string; cancelButtonText: string; icon?: "question" | "warning" | "info" }) {
  const swal = await loadSwal();
  const result = await swal.fire({
    title: opts.title,
    text: opts.html ? undefined : opts.text,
    html: opts.html,
    icon: opts.icon ?? "question",
    showCancelButton: true,
    confirmButtonText: opts.confirmButtonText,
    cancelButtonText: opts.cancelButtonText,
    reverseButtons: false,
  });
  return result.isConfirmed;
}

/** แจ้งข้อความ (ปุ่มรับทราบปุ่มเดียว) */
export async function alertInfo(opts: { title: string; text?: string; html?: string }) {
  const swal = await loadSwal();
  await swal.fire({ title: opts.title, text: opts.html ? undefined : opts.text, html: opts.html, icon: "info", confirmButtonText: "รับทราบ" });
}

/** ถามเหตุผล (ข้อความบังคับกรอก) พร้อมยืนยัน/ยกเลิก — คืนค่าเหตุผลที่กรอกถ้ายืนยัน, null ถ้ายกเลิก */
export async function promptReason(opts: { title: string; inputLabel?: string }) {
  const swal = await loadSwal();
  const result = await swal.fire({
    title: opts.title,
    input: "textarea",
    inputLabel: opts.inputLabel ?? "เหตุผล",
    inputPlaceholder: "ระบุเหตุผล...",
    showCancelButton: true,
    confirmButtonText: "บันทึก",
    cancelButtonText: "ยกเลิก",
    focusCancel: true,
    inputValidator: (value: string) => (value?.trim() ? undefined : "กรุณาระบุเหตุผล"),
  });
  if (!result.isConfirmed) return null;
  return String(result.value ?? "").trim();
}

/** ถามข้อความบรรทัดเดียว (เช่น แก้เลขที่เอกสาร) — คืน null เมื่อยกเลิก */
export async function promptText(opts: { title: string; inputLabel?: string; value?: string; placeholder?: string }) {
  const swal = await loadSwal();
  const result = await swal.fire({
    title: opts.title,
    input: "text",
    inputLabel: opts.inputLabel,
    inputValue: opts.value ?? "",
    inputPlaceholder: opts.placeholder,
    showCancelButton: true,
    confirmButtonText: "บันทึก",
    cancelButtonText: "ยกเลิก",
  });
  if (!result.isConfirmed) return null;
  return String(result.value ?? "").trim();
}

export async function toastSuccess(title: string) {
  const swal = await loadSwal();
  await swal.fire({
    toast: true,
    position: "top-end",
    icon: "success",
    title,
    showConfirmButton: false,
    timer: 2200,
    timerProgressBar: true,
  });
}

/** แจ้งข้อผิดพลาดเป็นป๊อปอัปกลางจอ ค้างไว้จนผู้ใช้กด "รับทราบ" (เดิมเป็น toast มุมจอ 3 วินาที — ผู้ใช้อ่านไม่ทัน ต.ค. 2569)
 *  ชื่อฟังก์ชันคงเดิมเพื่อไม่ต้องแก้ทุกจุดที่เรียก */
export async function toastError(message: string) {
  const swal = await loadSwal();
  await swal.fire({
    icon: "error",
    title: "ทำรายการไม่สำเร็จ",
    text: message,
    confirmButtonText: "รับทราบ",
  });
}

export async function alertError(opts: { title: string; text?: string }) {
  const swal = await loadSwal();
  await swal.fire({
    icon: "error",
    title: opts.title,
    text: opts.text,
    confirmButtonText: "ตกลง",
  });
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}
