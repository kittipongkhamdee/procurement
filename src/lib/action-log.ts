// บันทึก error ฝั่ง server action ลง log ของ Vercel (Runtime Logs) ให้ตามรอยได้เมื่อผู้ใช้แจ้งว่า "กดบันทึกแล้วไม่เข้า"
// ใช้กับ error จากฐานข้อมูลเท่านั้น (ไม่ใช่ข้อความตรวจสอบข้อมูลที่ผู้ใช้กรอกผิด)
export function dbFail(action: string, message: string): { error: string } {
  console.error(`[action-error] ${action}: ${message}`);
  return { error: message };
}
