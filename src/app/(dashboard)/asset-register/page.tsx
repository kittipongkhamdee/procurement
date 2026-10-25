"use client";

// หน้า "ทะเบียนคุมทรัพย์สิน" — เชื่อมกับ schema asset_* ที่มีอยู่แล้วในฐานข้อมูลเดียวกัน (เดิมใช้โดย
// ระบบสำรวจทรัพย์สินแยกต่างหาก มีข้อมูลจริงอยู่ก่อนแล้ว) shell แบบแท็บเดียวกับ /fund-allocation —
// ทุกคนที่ล็อกอินดูทะเบียนได้ (SELECT เปิดสาธารณะที่ฐานข้อมูล) เฉพาะ admin/เจ้าหน้าที่พัสดุเท่านั้น
// ที่แก้ไข/อนุมัติ/จัดการข้อมูลหลักได้ (ดู requireAssetStaff() ใน actions.ts)

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { createClient } from "@/lib/supabase/client";
import { PageLoadingSkeleton } from "@/components/loading-skeleton";
import { RegisterTab } from "./register-tab";
import { MasterDataTab } from "./master-data-tab";
import { SummaryTab } from "./summary-tab";
import { AssetDashboard, clearAssetDashboardCache, type DashboardRow } from "./asset-dashboard";
import { AssetImportModal } from "./asset-import-modal";

type Option = { id: string; name: string };
type Lookup = Option & { is_active: boolean };
type Category = Lookup & {
  useful_life_years: number | null;
  depreciation_rate_percent: number | null;
  type_code: string | null;
};
type ItemType = Lookup & { category_id: string; code: string };
type Condition = Lookup & { badge_color: string };
type SurveyRound = { id: string; year: number; name: string; is_open: boolean };

// คีย์แท็บ (key) คงเดิมไว้ตามชื่อฟีเจอร์จริง มีแค่ป้ายที่แสดง (label) เปลี่ยน — แท็บ "register" (เดิม
// ชื่อ "ทะเบียนทรัพย์สิน") เป็นหน้าจัดการ/แก้ไขแบบเต็ม จึงเปลี่ยนป้ายเป็น "จัดการทรัพย์สิน" ส่วนแท็บ
// "summary" (เดิมชื่อ "สรุปรายการ") เป็นตารางดูอย่างเดียว จึงเปลี่ยนป้ายเป็น "ทะเบียนทรัพย์สิน" แทน
const ALL_TABS = [
  { key: "summary", label: "ทะเบียนทรัพย์สิน" },
  { key: "register", label: "จัดการทรัพย์สิน" },
  { key: "master", label: "ข้อมูลหลัก" },
] as const;
type TabKey = (typeof ALL_TABS)[number]["key"];

export default function AssetRegisterPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const canManage = isAdmin || user?.role === "supply_officer";
  // ครูทั่วไปเข้าดูได้เฉพาะแท็บ "ทะเบียนทรัพย์สิน" (ตารางดูอย่างเดียว) แท็บอื่นทั้งหมด (จัดการ
  // ทรัพย์สิน/ข้อมูลหลัก/รอบสำรวจ) ซ่อนไว้ — เป็นการซ่อนระดับ UI เท่านั้น ข้อมูลจริงยังปลอดภัยด้วย RLS
  // ที่ฐานข้อมูลเหมือนเดิม (ดูคอมเมนต์ด้านบนของไฟล์)
  const isTeacher = user?.role === "teacher";
  const visibleTabs = isTeacher ? ALL_TABS.filter((t) => t.key === "summary") : ALL_TABS;
  const [tab, setTab] = useState<TabKey>("summary");

  useEffect(() => {
    if (!authLoading && isTeacher) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab("summary");
    }
  }, [authLoading, isTeacher]);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [buildings, setBuildings] = useState<Lookup[]>([]);
  const [units, setUnits] = useState<Lookup[]>([]);
  const [budgetSources, setBudgetSources] = useState<Lookup[]>([]);
  const [acquisitionMethods, setAcquisitionMethods] = useState<Lookup[]>([]);
  const [itemTypes, setItemTypes] = useState<ItemType[]>([]);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [rounds, setRounds] = useState<SurveyRound[]>([]);
  // ส่งครุภัณฑ์จากรายการจัดซื้อแล้ว → โหลดแท็บจัดการทรัพย์สินใหม่
  const [importTick, setImportTick] = useState(0);
  // รายการที่ตรงตัวกรองของแท็บทะเบียน — ให้แดชบอร์ดรวมยอดตามตัวกรอง (null = ทั้งระบบ)
  const [filtered, setFiltered] = useState<{ rows: DashboardRow[] | null; active: boolean }>({ rows: null, active: false });
  const handleFilteredChange = useCallback((rows: DashboardRow[] | null, active: boolean) => setFiltered({ rows, active }), []);

  const reload = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const [
      { data: categoriesData },
      { data: buildingsData },
      { data: unitsData },
      { data: budgetSourcesData },
      { data: acquisitionMethodsData },
      { data: itemTypesData },
      { data: conditionsData },
      { data: roundsData },
    ] = await Promise.all([
      supabase
        .from("asset_categories")
        .select("id, name, useful_life_years, depreciation_rate_percent, type_code, is_active")
        .order("sort_order")
        .order("name"),
      supabase.from("asset_buildings").select("id, name, is_active").order("sort_order").order("name"),
      supabase.from("asset_units").select("id, name, is_active").order("sort_order").order("name"),
      supabase.from("asset_budget_sources").select("id, name, is_active").order("sort_order").order("name"),
      supabase.from("asset_acquisition_methods").select("id, name, is_active").order("sort_order").order("name"),
      supabase.from("asset_item_types").select("id, category_id, name, code, is_active").order("sort_order").order("name"),
      supabase.from("asset_conditions").select("id, name, badge_color, is_active").order("sort_order").order("name"),
      supabase.from("asset_survey_rounds").select("id, year, name, is_open").order("year", { ascending: false }),
    ]);
    setCategories(categoriesData ?? []);
    setBuildings(buildingsData ?? []);
    setUnits(unitsData ?? []);
    setBudgetSources(budgetSourcesData ?? []);
    setAcquisitionMethods(acquisitionMethodsData ?? []);
    setItemTypes(itemTypesData ?? []);
    setConditions(conditionsData ?? []);
    setRounds(roundsData ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reload();
  }, [reload]);

  // มีการเพิ่ม/แก้/ลบทรัพย์สินหรือข้อมูลหลัก → ล้างแคชแดชบอร์ดให้ดึงตัวเลขใหม่
  function handleChanged() {
    clearAssetDashboardCache();
    reload();
  }

  if (authLoading || loading) return <PageLoadingSkeleton />;

  const activeCategories = categories.filter((c) => c.is_active);
  const activeBuildings = buildings.filter((b) => b.is_active);
  const activeUnits = units.filter((u) => u.is_active);
  const activeBudgetSources = budgetSources.filter((s) => s.is_active);
  const activeAcquisitionMethods = acquisitionMethods.filter((m) => m.is_active);
  const activeItemTypes = itemTypes.filter((t) => t.is_active);
  const activeConditions = conditions.filter((c) => c.is_active);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">ทะเบียนคุมทรัพย์สิน</h1>
          <p className="page-subtitle">ทะเบียนคุมทรัพย์สินของโรงเรียน จากข้อมูลการสำรวจครุภัณฑ์และรายการจัดซื้อที่เป็นครุภัณฑ์</p>
        </div>
        {canManage && (
          <AssetImportModal
            onDone={() => {
              clearAssetDashboardCache();
              setImportTick((n) => n + 1);
              setTab("register");
            }}
          />
        )}
      </div>

      {/* แดชบอร์ดสรุป — อยู่ใต้หัวหน้าจอ/ปุ่มดึงจากรายการจัดซื้อ เหนือแท็บ */}
      <AssetDashboard conditions={activeConditions} categories={categories} refreshKey={importTick} filteredRows={filtered.rows} filterActive={filtered.active} />

      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200">
        {visibleTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`shrink-0 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-navy-800 text-navy-800"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "register" && !isTeacher && (
          <RegisterTab
            key={importTick}
            canManage={canManage}
            rounds={rounds}
            categories={activeCategories}
            buildings={activeBuildings}
            units={activeUnits}
            budgetSources={activeBudgetSources}
            acquisitionMethods={activeAcquisitionMethods}
            itemTypes={activeItemTypes}
            conditions={activeConditions}
            onChanged={handleChanged}
          />
        )}
        {tab === "summary" && <SummaryTab conditions={activeConditions} canExport={!isTeacher} onFilteredChange={handleFilteredChange} />}
        {tab === "master" && !isTeacher && (
          <MasterDataTab
            canManage={canManage}
            categories={categories}
            buildings={buildings}
            units={units}
            budgetSources={budgetSources}
            acquisitionMethods={acquisitionMethods}
            itemTypes={itemTypes}
            conditions={conditions}
            onChanged={handleChanged}
          />
        )}
      </div>
    </div>
  );
}
