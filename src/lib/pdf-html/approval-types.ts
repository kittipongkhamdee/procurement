export type ApprovalPdfData = {
  doc_number: string | null;
  doc_date: string;
  subject: string;
  addressed_to: string;
  department: string | null;
  activity_name: string | null;
  project_name: string | null;
  plan_date_text: string | null;
  requested_amount: number;
  summary_items: { label: string; amount: number | null; note: string | null }[];
  requested_by_name: string | null;
  requested_by_position: string | null;

  budget: number | null;
  remaining: number | null;

  fund_type: string | null;

  deputy_decision: "ควร" | "ไม่ควร" | null;
  deputy_note: string | null;

  status: "รออนุมัติ" | "อนุมัติ" | "ไม่อนุมัติ";
  approve_note: string | null;
  approved_at: string | null;

  signer_planning: string | null;
  signer_finance: string | null;
  signer_deputy: string | null;
  signer_director: string | null;

  school_name: string;
  school_logo_url: string | null;

  group_name: string | null;
  budget_year_text: string | null;
  items: {
    seq: number;
    name: string | null;
    qty: number | null;
    unit_price: number | null;
    total: number | null;
    note: string | null;
  }[];
};
