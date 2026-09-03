import chromium from "@sparticuz/chromium";
import type { Browser } from "playwright-core";

/**
 * พิมพ์ HTML (สร้างจาก template ในโฟลเดอร์นี้) เป็น PDF ผ่าน headless Chromium จริง — แม่นยำกว่า
 * react-pdf มากสำหรับเอกสารที่ต้องตรงกับแบบฟอร์มทางการทุกพิกเซล (ตาราง/กล่อง/checkbox ซับซ้อน)
 * เพราะใช้ CSS ล้วนแทนการจัดวางด้วย flexbox ของ react-pdf ที่วัดความกว้างตัวอักษรไทยพลาดบ่อย
 *
 * ใช้ @sparticuz/chromium (bundle ไบนารี Chromium ที่รันบน Vercel serverless ได้) ทั้งบนเครื่อง dev
 * และ production เพื่อให้พฤติกรรมการ render เหมือนกันทุกที่ ไม่ต้องแยก logic ตาม environment
 */
export async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  const { chromium: playwrightChromium } = await import("playwright-core");

  let browser: Browser | null = null;
  try {
    browser = await playwrightChromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const buffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    return buffer;
  } finally {
    await browser?.close();
  }
}
