"use client";

import { ToggleSwitch } from "@/components/toggle-switch";
import { errorMessage, toastError, toastSuccess } from "@/lib/swal";
import type { toggleBudgetSourceActive as toggleBudgetSourceActiveAction } from "./actions";

export function BudgetSourceToggle({
  id,
  isActive,
  toggleBudgetSourceActive,
  onChanged,
}: {
  id: string;
  isActive: boolean;
  toggleBudgetSourceActive: typeof toggleBudgetSourceActiveAction;
  onChanged?: () => void;
}) {
  async function handleToggle() {
    try {
      await toggleBudgetSourceActive(id, isActive);
      await toastSuccess(isActive ? "ปิดใช้งานแล้ว" : "เปิดใช้งานแล้ว");
      onChanged?.();
    } catch (err) {
      await toastError(errorMessage(err));
    }
  }

  return <ToggleSwitch checked={isActive} onChange={handleToggle} />;
}
