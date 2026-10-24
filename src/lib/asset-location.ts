// ตัวกรอง "สถานที่" ของทะเบียนทรัพย์สิน — สถานที่ = อาคาร + ชั้น + ห้อง รวมเป็นคีย์เดียว (JSON) ส่งผ่าน
// state/query string ได้ และแปลงกลับเป็นเงื่อนไข building/floor/room ตอนกรองที่ฝั่ง Supabase

export type AssetLocation = { building: string; floor: string | null; room: string };

export function locationKey(l: AssetLocation): string {
  return JSON.stringify([l.building ?? "", l.floor ?? "", l.room ?? ""]);
}

export function parseLocationKey(key: string | null | undefined): AssetLocation | null {
  if (!key) return null;
  try {
    const [building, floor, room] = JSON.parse(key) as [string, string, string];
    return { building, floor: floor || null, room };
  } catch {
    return null;
  }
}

export function locationLabel(l: AssetLocation): string {
  return [l.building, l.floor ? `ชั้น ${l.floor}` : "", l.room].filter(Boolean).join(" ") || "(ไม่ระบุสถานที่)";
}

/** ตัวเลือกสถานที่ทั้งหมดที่มีครุภัณฑ์อยู่ เรียงตามอาคาร/ชั้น/ห้อง ไม่ซ้ำกัน */
export function distinctLocations(rows: AssetLocation[]): { key: string; label: string }[] {
  const m = new Map<string, AssetLocation>();
  for (const r of rows) m.set(locationKey(r), r);
  return [...m.entries()]
    .map(([key, l]) => ({ key, label: locationLabel(l) }))
    .sort((a, b) => a.label.localeCompare(b.label, "th", { numeric: true }));
}

/** ใส่เงื่อนไขสถานที่ให้ query ของ asset_items (floor ว่าง = null หรือ "") */
export function applyLocationFilter<Q extends { eq: (c: string, v: string) => Q; or: (f: string) => Q }>(query: Q, loc: AssetLocation | null): Q {
  if (!loc) return query;
  let q = query.eq("building", loc.building).eq("room", loc.room);
  q = loc.floor ? q.eq("floor", loc.floor) : q.or("floor.is.null,floor.eq.");
  return q;
}
