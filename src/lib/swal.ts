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

export async function toastError(title: string) {
  const swal = await loadSwal();
  await swal.fire({
    toast: true,
    position: "top-end",
    icon: "error",
    title,
    showConfirmButton: false,
    timer: 3200,
    timerProgressBar: true,
  });
}

export function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
}
