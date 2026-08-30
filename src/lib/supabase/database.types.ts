export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      plan_admin_groups: {
        Row: { id: string; is_active: boolean; name: string; sort_order: number }
        Insert: { id?: string; is_active?: boolean; name: string; sort_order?: number }
        Update: { id?: string; is_active?: boolean; name?: string; sort_order?: number }
        Relationships: []
      }
      plan_budget_years: {
        Row: { created_at: string; id: string; is_open: boolean; name: string; year: number }
        Insert: { created_at?: string; id?: string; is_open?: boolean; name: string; year: number }
        Update: { created_at?: string; id?: string; is_open?: boolean; name?: string; year?: number }
        Relationships: []
      }
      plan_budget_sources: {
        Row: { id: string; is_active: boolean; name: string; sort_order: number }
        Insert: { id?: string; is_active?: boolean; name: string; sort_order?: number }
        Update: { id?: string; is_active?: boolean; name?: string; sort_order?: number }
        Relationships: []
      }
      plan_teachers: {
        Row: { created_at: string; id: string; is_active: boolean; name: string; sort_order: number }
        Insert: { created_at?: string; id?: string; is_active?: boolean; name: string; sort_order?: number }
        Update: { created_at?: string; id?: string; is_active?: boolean; name?: string; sort_order?: number }
        Relationships: []
      }
      plan_activities: {
        Row: {
          budget: number
          created_at: string
          id: string
          name: string | null
          project_id: string
          responsible: string[] | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          budget?: number
          created_at?: string
          id?: string
          name?: string | null
          project_id: string
          responsible?: string[] | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          budget?: number
          created_at?: string
          id?: string
          name?: string | null
          project_id?: string
          responsible?: string[] | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_activities_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "plan_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_projects: {
        Row: {
          admin_group_id: string
          budget: number
          budget_source_id: string | null
          budget_year_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          admin_group_id: string
          budget?: number
          budget_source_id?: string | null
          budget_year_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          admin_group_id?: string
          budget?: number
          budget_source_id?: string | null
          budget_year_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_projects_admin_group_id_fkey"
            columns: ["admin_group_id"]
            isOneToOne: false
            referencedRelation: "plan_admin_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_projects_budget_year_id_fkey"
            columns: ["budget_year_id"]
            isOneToOne: false
            referencedRelation: "plan_budget_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_projects_budget_source_id_fkey"
            columns: ["budget_source_id"]
            isOneToOne: false
            referencedRelation: "plan_budget_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_project_proposals: {
        Row: {
          activities: Json
          admin_group_id: string | null
          approve_note: string | null
          approved_at: string | null
          approved_by_name: string | null
          budget_amount: number
          budget_source_id: string | null
          budget_year_id: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          endorse_note: string | null
          endorsed_at: string | null
          endorsed_by_name: string | null
          evaluation_items: Json
          expected_results: string | null
          id: string
          location: string | null
          name: string
          objectives: string | null
          project_type: string
          proposer_name: string | null
          rationale: string | null
          responsible: string[]
          risk_factors: string | null
          risk_mitigation: string | null
          standard: string | null
          start_date: string | null
          status: string
          strategy_alignment: string | null
          target_quality: string | null
          target_quantity: string | null
        }
        Insert: {
          activities?: Json
          admin_group_id?: string | null
          approve_note?: string | null
          approved_at?: string | null
          approved_by_name?: string | null
          budget_amount?: number
          budget_source_id?: string | null
          budget_year_id?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          endorse_note?: string | null
          endorsed_at?: string | null
          endorsed_by_name?: string | null
          evaluation_items?: Json
          expected_results?: string | null
          id?: string
          location?: string | null
          name: string
          objectives?: string | null
          project_type?: string
          proposer_name?: string | null
          rationale?: string | null
          responsible?: string[]
          risk_factors?: string | null
          risk_mitigation?: string | null
          standard?: string | null
          start_date?: string | null
          status?: string
          strategy_alignment?: string | null
          target_quality?: string | null
          target_quantity?: string | null
        }
        Update: {
          activities?: Json
          admin_group_id?: string | null
          approve_note?: string | null
          approved_at?: string | null
          approved_by_name?: string | null
          budget_amount?: number
          budget_source_id?: string | null
          budget_year_id?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          endorse_note?: string | null
          endorsed_at?: string | null
          endorsed_by_name?: string | null
          evaluation_items?: Json
          expected_results?: string | null
          id?: string
          location?: string | null
          name?: string
          objectives?: string | null
          project_type?: string
          proposer_name?: string | null
          rationale?: string | null
          responsible?: string[]
          risk_factors?: string | null
          risk_mitigation?: string | null
          standard?: string | null
          start_date?: string | null
          status?: string
          strategy_alignment?: string | null
          target_quality?: string | null
          target_quantity?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_project_proposals_admin_group_id_fkey"
            columns: ["admin_group_id"]
            isOneToOne: false
            referencedRelation: "plan_admin_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_project_proposals_budget_year_id_fkey"
            columns: ["budget_year_id"]
            isOneToOne: false
            referencedRelation: "plan_budget_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_project_proposals_budget_source_id_fkey"
            columns: ["budget_source_id"]
            isOneToOne: false
            referencedRelation: "plan_budget_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_allowance_disbursements: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          doc_no: string
          expense_type: string
          fund_source: string
          id: string
          project_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          doc_no: string
          expense_type: string
          fund_source: string
          id?: string
          project_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          doc_no?: string
          expense_type?: string
          fund_source?: string
          id?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proc_allowance_disbursements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "plan_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_approval_items: {
        Row: {
          approval_id: string
          id: string
          name: string | null
          qty: number | null
          seq: number
          total: number | null
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          approval_id: string
          id?: string
          name?: string | null
          qty?: number | null
          seq: number
          total?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Update: {
          approval_id?: string
          id?: string
          name?: string | null
          qty?: number | null
          seq?: number
          total?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proc_approval_items_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "proc_approvals"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_approvals: {
        Row: {
          addressed_to: string
          approval_pdf_url: string | null
          budget: number | null
          created_at: string
          created_by: string | null
          detail_text: string | null
          doc_date: string
          fund_type: string | null
          id: string
          item_list_pdf_url: string | null
          paid: number | null
          project_id: string | null
          remaining: number | null
          requested_amount: number
          requested_by_name: string | null
          requested_by_position: string | null
          subject: string
          updated_at: string
        }
        Insert: {
          addressed_to: string
          approval_pdf_url?: string | null
          budget?: number | null
          created_at?: string
          created_by?: string | null
          detail_text?: string | null
          doc_date: string
          fund_type?: string | null
          id?: string
          item_list_pdf_url?: string | null
          paid?: number | null
          project_id?: string | null
          remaining?: number | null
          requested_amount?: number
          requested_by_name?: string | null
          requested_by_position?: string | null
          subject: string
          updated_at?: string
        }
        Update: {
          addressed_to?: string
          approval_pdf_url?: string | null
          budget?: number | null
          created_at?: string
          created_by?: string | null
          detail_text?: string | null
          doc_date?: string
          fund_type?: string | null
          id?: string
          item_list_pdf_url?: string | null
          paid?: number | null
          project_id?: string | null
          remaining?: number | null
          requested_amount?: number
          requested_by_name?: string | null
          requested_by_position?: string | null
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proc_approvals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "plan_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_contracts: {
        Row: {
          amount: number
          amphoe: string | null
          budget: number | null
          contract_date: string
          contract_no: string
          created_at: string
          detail: string | null
          house_no: string | null
          id: string
          id_card: string | null
          inspector_name: string | null
          moo: string | null
          phone: string | null
          project_id: string | null
          province: string | null
          tambon: string | null
          updated_at: string
          vendor_name: string
          zipcode: string | null
        }
        Insert: {
          amount?: number
          amphoe?: string | null
          budget?: number | null
          contract_date: string
          contract_no: string
          created_at?: string
          detail?: string | null
          house_no?: string | null
          id?: string
          id_card?: string | null
          inspector_name?: string | null
          moo?: string | null
          phone?: string | null
          project_id?: string | null
          province?: string | null
          tambon?: string | null
          updated_at?: string
          vendor_name: string
          zipcode?: string | null
        }
        Update: {
          amount?: number
          amphoe?: string | null
          budget?: number | null
          contract_date?: string
          contract_no?: string
          created_at?: string
          detail?: string | null
          house_no?: string | null
          id?: string
          id_card?: string | null
          inspector_name?: string | null
          moo?: string | null
          phone?: string | null
          project_id?: string | null
          province?: string | null
          tambon?: string | null
          updated_at?: string
          vendor_name?: string
          zipcode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proc_contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "plan_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_deliveries: {
        Row: {
          amount: number
          amount_text: string | null
          contract_id: string
          created_at: string
          delivery_date: string
          delivery_month: string | null
          id: string
          inspector_name: string | null
          pdf_url: string | null
        }
        Insert: {
          amount?: number
          amount_text?: string | null
          contract_id: string
          created_at?: string
          delivery_date: string
          delivery_month?: string | null
          id?: string
          inspector_name?: string | null
          pdf_url?: string | null
        }
        Update: {
          amount?: number
          amount_text?: string | null
          contract_id?: string
          created_at?: string
          delivery_date?: string
          delivery_month?: string | null
          id?: string
          inspector_name?: string | null
          pdf_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proc_deliveries_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "proc_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_documents: {
        Row: { created_at: string; file_name: string; file_url: string; id: string; uploaded_by: string | null }
        Insert: { created_at?: string; file_name: string; file_url: string; id?: string; uploaded_by?: string | null }
        Update: { created_at?: string; file_name?: string; file_url?: string; id?: string; uploaded_by?: string | null }
        Relationships: []
      }
      proc_profiles: {
        Row: {
          created_at: string
          full_name: string
          position: string | null
          role: Database["public"]["Enums"]["proc_user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          position?: string | null
          role?: Database["public"]["Enums"]["proc_user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          position?: string | null
          role?: Database["public"]["Enums"]["proc_user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      proc_user_groups: {
        Row: { created_at: string; id: string; is_active: boolean; name: string; sort_order: number }
        Insert: { created_at?: string; id?: string; is_active?: boolean; name: string; sort_order?: number }
        Update: { created_at?: string; id?: string; is_active?: boolean; name?: string; sort_order?: number }
        Relationships: []
      }
      proc_user_group_members: {
        Row: { created_at: string; group_id: string; user_id: string }
        Insert: { created_at?: string; group_id: string; user_id: string }
        Update: { created_at?: string; group_id?: string; user_id?: string }
        Relationships: [
          {
            foreignKeyName: "proc_user_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "proc_user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_project_disbursements: {
        Row: {
          activity_name: string | null
          amount: number
          created_at: string
          created_by: string | null
          doc_no: string | null
          id: string
          paid_at: string | null
          project_id: string | null
          status: Database["public"]["Enums"]["proc_disbursement_status"]
        }
        Insert: {
          activity_name?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          id?: string
          paid_at?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["proc_disbursement_status"]
        }
        Update: {
          activity_name?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          doc_no?: string | null
          id?: string
          paid_at?: string | null
          project_id?: string | null
          status?: Database["public"]["Enums"]["proc_disbursement_status"]
        }
        Relationships: [
          {
            foreignKeyName: "proc_project_disbursements_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "plan_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_project_reports: {
        Row: { created_at: string; file_url: string; id: string; project_id: string | null; uploaded_by: string | null }
        Insert: { created_at?: string; file_url: string; id?: string; project_id?: string | null; uploaded_by?: string | null }
        Update: { created_at?: string; file_url?: string; id?: string; project_id?: string | null; uploaded_by?: string | null }
        Relationships: [
          {
            foreignKeyName: "proc_project_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "plan_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_purchase_items: {
        Row: {
          id: string
          name: string | null
          purchase_request_id: string
          qty: number | null
          seq: number
          total: number | null
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          id?: string
          name?: string | null
          purchase_request_id: string
          qty?: number | null
          seq: number
          total?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Update: {
          id?: string
          name?: string | null
          purchase_request_id?: string
          qty?: number | null
          seq?: number
          total?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proc_purchase_items_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "proc_purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_purchase_requests: {
        Row: {
          activity_id: string | null
          admin_group: string | null
          amount: number
          created_at: string
          created_by: string | null
          delivery_date: string
          detail: string | null
          doc_no: string
          doc_type: Database["public"]["Enums"]["proc_purchase_type"]
          id: string
          inspector_name: string | null
          inspector_position: string | null
          item_name: string | null
          pdf_url: string | null
          project_id: string | null
          reason: string | null
          record_date: string
          supply_officer_name: string | null
          updated_at: string
          vendor_id: string | null
          work_days: number | null
        }
        Insert: {
          activity_id?: string | null
          admin_group?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          delivery_date: string
          detail?: string | null
          doc_no: string
          doc_type: Database["public"]["Enums"]["proc_purchase_type"]
          id?: string
          inspector_name?: string | null
          inspector_position?: string | null
          item_name?: string | null
          pdf_url?: string | null
          project_id?: string | null
          reason?: string | null
          record_date: string
          supply_officer_name?: string | null
          updated_at?: string
          vendor_id?: string | null
          work_days?: number | null
        }
        Update: {
          activity_id?: string | null
          admin_group?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          delivery_date?: string
          detail?: string | null
          doc_no?: string
          doc_type?: Database["public"]["Enums"]["proc_purchase_type"]
          id?: string
          inspector_name?: string | null
          inspector_position?: string | null
          item_name?: string | null
          pdf_url?: string | null
          project_id?: string | null
          reason?: string | null
          record_date?: string
          supply_officer_name?: string | null
          updated_at?: string
          vendor_id?: string | null
          work_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proc_purchase_requests_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "plan_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_purchase_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "plan_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_purchase_requests_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "proc_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_vendors: {
        Row: {
          amphoe: string | null
          created_at: string
          house_no: string | null
          id: string
          moo: string | null
          name: string
          phone: string | null
          province: string | null
          tambon: string | null
          tax_id: string | null
          updated_at: string
          zipcode: string | null
        }
        Insert: {
          amphoe?: string | null
          created_at?: string
          house_no?: string | null
          id?: string
          moo?: string | null
          name: string
          phone?: string | null
          province?: string | null
          tambon?: string | null
          tax_id?: string | null
          updated_at?: string
          zipcode?: string | null
        }
        Update: {
          amphoe?: string | null
          created_at?: string
          house_no?: string | null
          id?: string
          moo?: string | null
          name?: string
          phone?: string | null
          province?: string | null
          tambon?: string | null
          tax_id?: string | null
          updated_at?: string
          zipcode?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      proc_admin_list_users: {
        Args: Record<string, never>
        Returns: {
          created_at: string
          email: string
          full_name: string
          position: string
          role: Database["public"]["Enums"]["proc_user_role"]
          user_id: string
        }[]
      }
      proc_admin_set_role: {
        Args: {
          new_role: Database["public"]["Enums"]["proc_user_role"]
          target_user_id: string
        }
        Returns: undefined
      }
      proc_current_role: {
        Args: Record<string, never>
        Returns: Database["public"]["Enums"]["proc_user_role"]
      }
      proc_is_staff: { Args: Record<string, never>; Returns: boolean }
    }
    Enums: {
      proc_disbursement_status: "pending" | "paid"
      proc_purchase_type: "ซื้อ" | "จ้าง"
      proc_user_role: "admin" | "supply_officer" | "finance_officer" | "teacher" | "director"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> = DefaultSchema["Tables"][T]["Update"]
export type Enums<T extends keyof DefaultSchema["Enums"]> = DefaultSchema["Enums"][T]
