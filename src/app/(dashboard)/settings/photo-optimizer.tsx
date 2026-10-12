"use client";

// เครื่องมือ "ย่อรูปทรัพย์สินเก่า" (เฉพาะผู้ดูแลระบบ) — ลดขนาดรูปใน bucket asset-photos ที่เก็บไว้ก่อนมีการย่อรูป เพื่อลดปริมาณข้อมูล
// ที่ส่งออกจาก Supabase (egress) ทำงานฝั่งเบราว์เซอร์ทีละรูป: ดาวน์โหลด → ย่อ (ด้านยาว 1280px, JPEG 75%) → อัปโหลดทับพาธเดิม
// (พาธใน asset_items.photo_path จึงไม่เปลี่ยน) พร้อมสร้างรูปย่อ thumbs/<path> ไว้ใช้ในรายการ
// - ก่อนเขียนทับ คัดลอกต้นฉบับไปเก็บที่ bucket สำรอง asset-photos-backup ก่อนเสมอ (ลบทิ้งภายหลังได้เมื่อมั่นใจแล้ว)
// - ทำซ้ำได้ปลอดภัย: ข้ามรูปที่เล็กพอและมีรูปย่อแล้ว / หยุดกลางทางแล้วกดเริ่มต่อได้ / ไม่เขียนทับถ้าย่อแล้วไม่เล็กลง

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { compressPhotoFile, createPhotoThumbnail } from "@/lib/image-resize";
import {
  ASSET_PHOTO_BACKUP_BUCKET,
  ASSET_PHOTO_BUCKET,
  THUMB_PREFIX,
  thumbPathFor,
} from "@/lib/storage/asset-photo";
import { confirmDelete, confirmWarning, errorMessage, toastError, toastSuccess } from "@/lib/swal";

const BIG_BYTES = 250 * 1024;
const PAGE = 100;

type Entry = { name: string; size: number };
type ScanResult = { total: number; totalBytes: number; candidates: Entry[]; candidateBytes: number; thumbsMissing: number };

function mb(bytes: number) {
  return (bytes / 1048576).toLocaleString("th-TH", { maximumFractionDigits: 1 });
}

async function listAll(bucket: string, folder: string): Promise<Entry[]> {
  const supabase = createClient();
  const out: Entry[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder, { limit: PAGE, offset, sortBy: { column: "name", order: "asc" } });
    if (error) throw new Error(error.message);
    for (const o of data ?? []) {
      // โฟลเดอร์ (เช่น thumbs) ไม่มี id
      if (!o.id) continue;
      out.push({ name: o.name, size: Number((o.metadata as { size?: number } | null)?.size ?? 0) });
    }
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export function PhotoOptimizer() {
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [savedBytes, setSavedBytes] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [backupInfo, setBackupInfo] = useState<{ count: number; bytes: number } | null>(null);
  const [removingBackup, setRemovingBackup] = useState(false);
  const stopRef = useRef(false);

  async function handleScan() {
    setScanning(true);
    try {
      const [originals, thumbs] = await Promise.all([listAll(ASSET_PHOTO_BUCKET, ""), listAll(ASSET_PHOTO_BUCKET, THUMB_PREFIX.replace(/\/$/, ""))]);
      const thumbSet = new Set(thumbs.map((t) => t.name));
      const candidates = originals.filter((o) => o.size > BIG_BYTES || !thumbSet.has(o.name));
      setScan({
        total: originals.length,
        totalBytes: originals.reduce((s, o) => s + o.size, 0),
        candidates,
        candidateBytes: candidates.reduce((s, o) => s + o.size, 0),
        thumbsMissing: originals.filter((o) => !thumbSet.has(o.name)).length,
      });
      setDone(0);
      setSavedBytes(0);
      setErrors([]);
      const backups = await listAll(ASSET_PHOTO_BACKUP_BUCKET, "").catch(() => []);
      setBackupInfo({ count: backups.length, bytes: backups.reduce((s, o) => s + o.size, 0) });
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setScanning(false);
    }
  }

  async function handleRun() {
    if (!scan || scan.candidates.length === 0) return;
    const ok = await confirmWarning({
      title: `ย่อรูป ${scan.candidates.length.toLocaleString("th-TH")} รูป?`,
      text: `ระบบจะดาวน์โหลดรูปเหล่านี้ (ประมาณ ${mb(scan.candidateBytes)} MB) มาย่อในเบราว์เซอร์นี้ทีละรูป โดยสำรองต้นฉบับไว้ก่อนเขียนทับ กรุณาเปิดหน้านี้ค้างไว้จนเสร็จ (ใช้เวลาหลายนาที) และใช้ Wi-Fi จะดีที่สุด หยุดกลางทางได้และกดเริ่มต่อได้`,
      confirmButtonText: "เริ่มย่อรูป",
    });
    if (!ok) return;

    const supabase = createClient();
    const bucket = supabase.storage.from(ASSET_PHOTO_BUCKET);
    stopRef.current = false;
    setRunning(true);
    setErrors([]);
    let doneCount = 0;
    let saved = 0;
    const errs: string[] = [];
    const thumbNames = new Set((await listAll(ASSET_PHOTO_BUCKET, "thumbs").catch(() => [])).map((t) => t.name));

    for (const entry of scan.candidates) {
      if (stopRef.current) break;
      try {
        const { data: blob, error: dlError } = await bucket.download(entry.name);
        if (dlError || !blob) throw new Error(dlError?.message ?? "ดาวน์โหลดไม่สำเร็จ");
        const original = new File([blob], entry.name, { type: blob.type || "image/jpeg" });

        const compressed = await compressPhotoFile(original);
        const shouldOverwrite = compressed !== original && compressed.size < blob.size * 0.9;
        if (shouldOverwrite) {
          // สำรองต้นฉบับก่อนเขียนทับ (ถ้ามีสำรองอยู่แล้วจากรอบก่อน ถือว่าผ่าน)
          const { error: copyError } = await bucket.copy(entry.name, entry.name, { destinationBucket: ASSET_PHOTO_BACKUP_BUCKET });
          if (copyError && !/exist|duplicate/i.test(copyError.message)) throw new Error(`สำรองไม่สำเร็จ: ${copyError.message}`);
          const { error: upError } = await bucket.upload(entry.name, compressed, { upsert: true, contentType: "image/jpeg" });
          if (upError) throw new Error(`อัปโหลดทับไม่สำเร็จ: ${upError.message}`);
          saved += blob.size - compressed.size;
        }

        if (!thumbNames.has(entry.name)) {
          const thumb = await createPhotoThumbnail(blob);
          if (thumb) {
            const { error: thumbError } = await bucket.upload(thumbPathFor(entry.name), thumb, { upsert: true, contentType: "image/jpeg" });
            if (thumbError) throw new Error(`สร้างรูปย่อไม่สำเร็จ: ${thumbError.message}`);
            thumbNames.add(entry.name);
          }
        }
      } catch (err) {
        errs.push(`${entry.name}: ${errorMessage(err)}`);
      }
      doneCount += 1;
      setDone(doneCount);
      setSavedBytes(saved);
      if (errs.length !== errors.length) setErrors([...errs]);
    }

    setErrors([...errs]);
    setRunning(false);
    const stopped = stopRef.current;
    await toastSuccess(
      stopped
        ? `หยุดแล้ว ย่อไปแล้ว ${doneCount.toLocaleString("th-TH")} รูป (ประหยัด ${mb(saved)} MB) กดตรวจสอบรูปอีกครั้งเพื่อทำต่อ`
        : `เสร็จแล้ว ประมวลผล ${doneCount.toLocaleString("th-TH")} รูป ประหยัดพื้นที่ ${mb(saved)} MB${errs.length > 0 ? ` (มี ${errs.length} รูปไม่สำเร็จ)` : ""}`,
    );
  }

  async function handleRemoveBackup() {
    if (!backupInfo || backupInfo.count === 0) return;
    const ok = await confirmDelete({
      title: `ลบรูปต้นฉบับสำรอง ${backupInfo.count.toLocaleString("th-TH")} รูป (${mb(backupInfo.bytes)} MB)?`,
      text: "ลบแล้วกู้รูปต้นฉบับขนาดเดิมไม่ได้ ควรลบเมื่อตรวจแล้วว่ารูปที่ย่อใช้งานได้ปกติ",
    });
    if (!ok) return;
    setRemovingBackup(true);
    try {
      const supabase = createClient();
      const backups = await listAll(ASSET_PHOTO_BACKUP_BUCKET, "");
      for (let i = 0; i < backups.length; i += 50) {
        const names = backups.slice(i, i + 50).map((b) => b.name);
        const { error } = await supabase.storage.from(ASSET_PHOTO_BACKUP_BUCKET).remove(names);
        if (error) throw new Error(error.message);
      }
      setBackupInfo({ count: 0, bytes: 0 });
      await toastSuccess("ลบรูปสำรองแล้ว");
    } catch (err) {
      await toastError(errorMessage(err));
    } finally {
      setRemovingBackup(false);
    }
  }

  const total = scan?.candidates.length ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleScan} disabled={scanning || running} className="btn-secondary btn-sm">
          {scanning ? "กำลังตรวจสอบ..." : "ตรวจสอบรูป"}
        </button>
        {scan && scan.candidates.length > 0 && !running && (
          <button type="button" onClick={handleRun} className="btn-primary btn-sm">
            เริ่มย่อรูป ({scan.candidates.length.toLocaleString("th-TH")} รูป)
          </button>
        )}
        {running && (
          <button type="button" onClick={() => (stopRef.current = true)} className="btn-danger btn-sm">
            หยุด
          </button>
        )}
      </div>

      {scan && (
        <p className="text-sm text-slate-600">
          รูปทั้งหมด {scan.total.toLocaleString("th-TH")} รูป ({mb(scan.totalBytes)} MB) · ต้องย่อ/ทำรูปย่อ{" "}
          <span className="font-semibold">{scan.candidates.length.toLocaleString("th-TH")}</span> รูป ({mb(scan.candidateBytes)} MB)
          {scan.thumbsMissing > 0 && <> · ยังไม่มีรูปย่อ {scan.thumbsMissing.toLocaleString("th-TH")} รูป</>}
          {scan.candidates.length === 0 && <span className="font-semibold text-emerald-700"> — เรียบร้อยแล้ว ไม่ต้องทำเพิ่ม</span>}
        </p>
      )}

      {(running || done > 0) && total > 0 && (
        <div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-navy-800 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {done.toLocaleString("th-TH")} / {total.toLocaleString("th-TH")} รูป ({pct}%) · ประหยัดแล้ว {mb(savedBytes)} MB
            {running && " — กรุณาอย่าปิดหน้านี้"}
          </p>
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          <p className="font-semibold">รูปที่ไม่สำเร็จ {errors.length} รูป (กดตรวจสอบรูปแล้วเริ่มใหม่เพื่อลองอีกครั้ง):</p>
          <ul className="mt-1 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-4">
            {errors.slice(0, 20).map((e, i) => (
              <li key={i} className="break-all">
                {e}
              </li>
            ))}
          </ul>
        </div>
      )}

      {backupInfo && backupInfo.count > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span>
            มีรูปต้นฉบับสำรอง {backupInfo.count.toLocaleString("th-TH")} รูป ({mb(backupInfo.bytes)} MB) — ตรวจว่ารูปที่ย่อแล้วใช้งานได้ปกติ แล้วค่อยลบสำรองเพื่อคืนพื้นที่
          </span>
          <button type="button" onClick={handleRemoveBackup} disabled={removingBackup || running} className="btn-danger btn-sm">
            {removingBackup ? "กำลังลบ..." : "ลบรูปสำรอง"}
          </button>
        </div>
      )}
    </div>
  );
}
