export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      asset_budget_sources: {
        Row: {
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      asset_buildings: {
        Row: {
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      asset_categories: {
        Row: {
          depreciation_rate_percent: number | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          useful_life_years: number | null
        }
        Insert: {
          depreciation_rate_percent?: number | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          useful_life_years?: number | null
        }
        Update: {
          depreciation_rate_percent?: number | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          useful_life_years?: number | null
        }
        Relationships: []
      }
      asset_items: {
        Row: {
          acquired_year: number | null
          acquisition_method: string | null
          asset_code: string | null
          budget_source_id: string | null
          building: string
          category_id: string | null
          condition: Database["public"]["Enums"]["asset_condition"]
          created_at: string
          floor: string | null
          id: string
          model: string | null
          name: string
          note: string | null
          photo_path: string | null
          price: number | null
          quantity: number
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          room: string
          round_id: string
          spec: string | null
          status: Database["public"]["Enums"]["asset_item_status"]
          surveyed_by: string | null
          unit: string | null
          untagged: boolean
          updated_at: string
          vendor_address: string | null
          vendor_name: string | null
          vendor_phone: string | null
        }
        Insert: {
          acquired_year?: number | null
          acquisition_method?: string | null
          asset_code?: string | null
          budget_source_id?: string | null
          building: string
          category_id?: string | null
          condition: Database["public"]["Enums"]["asset_condition"]
          created_at?: string
          floor?: string | null
          id?: string
          model?: string | null
          name: string
          note?: string | null
          photo_path?: string | null
          price?: number | null
          quantity?: number
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          room: string
          round_id: string
          spec?: string | null
          status?: Database["public"]["Enums"]["asset_item_status"]
          surveyed_by?: string | null
          unit?: string | null
          untagged?: boolean
          updated_at?: string
          vendor_address?: string | null
          vendor_name?: string | null
          vendor_phone?: string | null
        }
        Update: {
          acquired_year?: number | null
          acquisition_method?: string | null
          asset_code?: string | null
          budget_source_id?: string | null
          building?: string
          category_id?: string | null
          condition?: Database["public"]["Enums"]["asset_condition"]
          created_at?: string
          floor?: string | null
          id?: string
          model?: string | null
          name?: string
          note?: string | null
          photo_path?: string | null
          price?: number | null
          quantity?: number
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          room?: string
          round_id?: string
          spec?: string | null
          status?: Database["public"]["Enums"]["asset_item_status"]
          surveyed_by?: string | null
          unit?: string | null
          untagged?: boolean
          updated_at?: string
          vendor_address?: string | null
          vendor_name?: string | null
          vendor_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_items_budget_source_id_fkey"
            columns: ["budget_source_id"]
            isOneToOne: false
            referencedRelation: "asset_budget_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_items_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "asset_survey_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_school_settings: {
        Row: {
          id: boolean
          logo_path: string | null
          school_name: string | null
          system_name: string
          updated_at: string
        }
        Insert: {
          id?: boolean
          logo_path?: string | null
          school_name?: string | null
          system_name?: string
          updated_at?: string
        }
        Update: {
          id?: boolean
          logo_path?: string | null
          school_name?: string | null
          system_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      asset_survey_profiles: {
        Row: {
          created_at: string
          department: string | null
          full_name: string
          role: Database["public"]["Enums"]["asset_user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          full_name: string
          role?: Database["public"]["Enums"]["asset_user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          department?: string | null
          full_name?: string
          role?: Database["public"]["Enums"]["asset_user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      asset_survey_rounds: {
        Row: {
          created_at: string
          id: string
          is_open: boolean
          name: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_open?: boolean
          name: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          is_open?: boolean
          name?: string
          year?: number
        }
        Relationships: []
      }
      asset_units: {
        Row: {
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
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
      plan_admin_groups: {
        Row: {
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      plan_budget_sources: {
        Row: {
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      plan_budget_years: {
        Row: {
          created_at: string
          id: string
          is_open: boolean
          name: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_open?: boolean
          name: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          is_open?: boolean
          name?: string
          year?: number
        }
        Relationships: []
      }
      plan_disbursement_requests: {
        Row: {
          activity_id: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          purpose: string | null
          reject_reason: string | null
          requested_amount: number
          requested_at: string
          requested_by: string | null
          requester_name: string
          status: Database["public"]["Enums"]["plan_disbursement_status"]
          updated_at: string
        }
        Insert: {
          activity_id: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          purpose?: string | null
          reject_reason?: string | null
          requested_amount: number
          requested_at?: string
          requested_by?: string | null
          requester_name?: string
          status?: Database["public"]["Enums"]["plan_disbursement_status"]
          updated_at?: string
        }
        Update: {
          activity_id?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          purpose?: string | null
          reject_reason?: string | null
          requested_amount?: number
          requested_at?: string
          requested_by?: string | null
          requester_name?: string
          status?: Database["public"]["Enums"]["plan_disbursement_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_disbursement_requests_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "plan_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_official_rates: {
        Row: {
          id: string
          level_label: string
          note: string
          rate_per_student: number
          revenue_type_id: string
          sort_order: number
          year: number
        }
        Insert: {
          id?: string
          level_label: string
          note?: string
          rate_per_student: number
          revenue_type_id: string
          sort_order?: number
          year: number
        }
        Update: {
          id?: string
          level_label?: string
          note?: string
          rate_per_student?: number
          revenue_type_id?: string
          sort_order?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_official_rates_revenue_type_id_fkey"
            columns: ["revenue_type_id"]
            isOneToOne: false
            referencedRelation: "plan_revenue_types"
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
          endorse_note: string | null
          endorsed_at: string | null
          endorsed_by_name: string | null
          file_url_pdf: string | null
          file_url_word: string | null
          id: string
          name: string
          proposer_name: string | null
          responsible: string[]
          standard: string | null
          status: string
          strategy_alignment: string | null
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
          endorse_note?: string | null
          endorsed_at?: string | null
          endorsed_by_name?: string | null
          file_url_pdf?: string | null
          file_url_word?: string | null
          id?: string
          name: string
          proposer_name?: string | null
          responsible?: string[]
          standard?: string | null
          status?: string
          strategy_alignment?: string | null
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
          endorse_note?: string | null
          endorsed_at?: string | null
          endorsed_by_name?: string | null
          file_url_pdf?: string | null
          file_url_word?: string | null
          id?: string
          name?: string
          proposer_name?: string | null
          responsible?: string[]
          standard?: string | null
          status?: string
          strategy_alignment?: string | null
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
            foreignKeyName: "plan_project_proposals_budget_source_id_fkey"
            columns: ["budget_source_id"]
            isOneToOne: false
            referencedRelation: "plan_budget_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_project_proposals_budget_year_id_fkey"
            columns: ["budget_year_id"]
            isOneToOne: false
            referencedRelation: "plan_budget_years"
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
            foreignKeyName: "plan_projects_budget_source_id_fkey"
            columns: ["budget_source_id"]
            isOneToOne: false
            referencedRelation: "plan_budget_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_projects_budget_year_id_fkey"
            columns: ["budget_year_id"]
            isOneToOne: false
            referencedRelation: "plan_budget_years"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_requesters: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      plan_revenue_lines: {
        Row: {
          budget_year_id: string
          created_at: string
          id: string
          level_label: string
          rate_per_student: number
          revenue_type_id: string
          sort_order: number
          student_count: number
          total: number | null
          updated_at: string
        }
        Insert: {
          budget_year_id: string
          created_at?: string
          id?: string
          level_label: string
          rate_per_student?: number
          revenue_type_id: string
          sort_order?: number
          student_count?: number
          total?: number | null
          updated_at?: string
        }
        Update: {
          budget_year_id?: string
          created_at?: string
          id?: string
          level_label?: string
          rate_per_student?: number
          revenue_type_id?: string
          sort_order?: number
          student_count?: number
          total?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_revenue_lines_budget_year_id_fkey"
            columns: ["budget_year_id"]
            isOneToOne: false
            referencedRelation: "plan_budget_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_revenue_lines_revenue_type_id_fkey"
            columns: ["revenue_type_id"]
            isOneToOne: false
            referencedRelation: "plan_revenue_types"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_revenue_types: {
        Row: {
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      plan_standards: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      plan_strategies: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      plan_teachers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
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
        Row: {
          created_at: string
          file_name: string
          file_url: string
          id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_url: string
          id?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_url?: string
          id?: string
          uploaded_by?: string | null
        }
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
        Row: {
          created_at: string
          file_url: string
          id: string
          project_id: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          project_id?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          project_id?: string | null
          uploaded_by?: string | null
        }
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
      proc_user_group_members: {
        Row: {
          created_at: string
          group_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          user_id?: string
        }
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
      proc_user_groups: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
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
      asset_admin_delete_user: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      asset_admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          department: string
          email: string
          full_name: string
          is_anonymous: boolean
          role: Database["public"]["Enums"]["asset_user_role"]
          user_id: string
        }[]
      }
      asset_current_role: {
        Args: never
        Returns: Database["public"]["Enums"]["asset_user_role"]
      }
      asset_is_staff: { Args: never; Returns: boolean }
      proc_admin_list_users: {
        Args: never
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
        Args: never
        Returns: Database["public"]["Enums"]["proc_user_role"]
      }
      proc_is_staff: { Args: never; Returns: boolean }
    }
    Enums: {
      asset_condition: "usable" | "damaged" | "disposal"
      asset_item_status: "draft" | "submitted" | "approved" | "rejected"
      asset_user_role: "teacher" | "supply" | "admin" | "director"
      plan_disbursement_status: "pending" | "approved" | "rejected"
      proc_disbursement_status: "pending" | "paid"
      proc_purchase_type: "ซื้อ" | "จ้าง"
      proc_user_role:
        | "admin"
        | "supply_officer"
        | "finance_officer"
        | "teacher"
        | "director"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      asset_condition: ["usable", "damaged", "disposal"],
      asset_item_status: ["draft", "submitted", "approved", "rejected"],
      asset_user_role: ["teacher", "supply", "admin", "director"],
      plan_disbursement_status: ["pending", "approved", "rejected"],
      proc_disbursement_status: ["pending", "paid"],
      proc_purchase_type: ["ซื้อ", "จ้าง"],
      proc_user_role: [
        "admin",
        "supply_officer",
        "finance_officer",
        "teacher",
        "director",
      ],
    },
  },
} as const
