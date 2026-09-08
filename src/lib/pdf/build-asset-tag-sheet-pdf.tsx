import type { SupabaseClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import type { Database } from "@/lib/supabase/database.types";
import { AssetTagSheetDocument } from "./asset-tag-sheet-document";
import type { AssetTagPdfData } from "./asset-tag-document";

export async function buildAssetTagSheetPdfData(
  supabase: SupabaseClient<Database>,
  ids: string[],
): Promise<{ items: AssetTagPdfData[]; fileLabel: string } | null> {
  if (ids.length === 0) return null;

  const { data: rows, error } = await supabase.from("asset_items").select("id, name, asset_code, building, floor, room").in("id", ids);

  if (error || !rows || rows.length === 0) return null;

  const byId = new Map(rows.map((r) => [r.id, r]));

  // คงลำดับตาม ids ที่ผู้ใช้เลือก (ไม่ใช่ลำดับที่ฐานข้อมูลคืนมา) ให้ตรงกับที่เลือกไว้ในตาราง
  const items: AssetTagPdfData[] = [];
  for (const id of ids) {
    const item = byId.get(id);
    if (!item) continue;
    const qrUrl = await QRCode.toDataURL(item.asset_code || id, { width: 200, margin: 0 });
    items.push({
      name: item.name,
      asset_code: item.asset_code,
      building: item.building,
      floor: item.floor,
      room: item.room,
      qr_url: qrUrl,
    });
  }

  if (items.length === 0) return null;

  return { items, fileLabel: `ป้ายครุภัณฑ์-${items.length}-รายการ` };
}

export async function renderAssetTagSheetPdfBuffer(items: AssetTagPdfData[]): Promise<Buffer> {
  return renderToBuffer(<AssetTagSheetDocument items={items} />);
}
