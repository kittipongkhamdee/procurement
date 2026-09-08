import type { SupabaseClient } from "@supabase/supabase-js";
import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import type { Database } from "@/lib/supabase/database.types";
import { AssetTagDocument, type AssetTagPdfData } from "./asset-tag-document";

export async function buildAssetTagPdfData(
  supabase: SupabaseClient<Database>,
  id: string,
): Promise<{ data: AssetTagPdfData; fileLabel: string } | null> {
  const { data: item, error } = await supabase
    .from("asset_items")
    .select("name, asset_code, building, floor, room")
    .eq("id", id)
    .maybeSingle();

  if (error || !item) return null;

  const { data: schoolSettings } = await supabase.from("proc_school_settings").select("school_name").eq("id", true).maybeSingle();

  // ใช้ค่าเข้ารหัส QR เดียวกับใน PDF ทะเบียนคุมทรัพย์สิน (รหัสครุภัณฑ์ หรือ id ถ้ายังไม่มีรหัส) —
  // สแกนแล้ววางลงช่องค้นหาในหน้าทะเบียนทรัพย์สินเพื่อค้นรายการนี้ได้
  const qrUrl = await QRCode.toDataURL(item.asset_code || id, { width: 200, margin: 0 });

  const data: AssetTagPdfData = {
    school_name: schoolSettings?.school_name ?? "โรงเรียนตาเบาวิทยา",
    name: item.name,
    asset_code: item.asset_code,
    building: item.building,
    floor: item.floor,
    room: item.room,
    qr_url: qrUrl,
  };

  return { data, fileLabel: `ป้ายครุภัณฑ์-${item.asset_code ?? item.name}` };
}

export async function renderAssetTagPdfBuffer(data: AssetTagPdfData): Promise<Buffer> {
  return renderToBuffer(<AssetTagDocument data={data} />);
}
