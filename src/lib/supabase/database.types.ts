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
      fin_accounts: {
        Row: {
          account_no: string | null
          bank_name: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          account_no?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          account_no?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      fin_fund_loans: {
        Row: {
          id: string
          fiscal_year: number
          doc_seq: number
          loan_date: string
          lender_type_id: string
          pocket: string
          semester: string | null
          academic_year: string | null
          memo_no: string | null
          memo_date: string | null
          reason: string | null
          director_approved_at: string | null
          director_approved_by: string | null
          director_approved_by_name: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          fiscal_year: number
          doc_seq: number
          loan_date: string
          lender_type_id: string
          pocket?: string
          semester?: string | null
          academic_year?: string | null
          memo_no?: string | null
          memo_date?: string | null
          reason?: string | null
          director_approved_at?: string | null
          director_approved_by?: string | null
          director_approved_by_name?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          fiscal_year?: number
          doc_seq?: number
          loan_date?: string
          lender_type_id?: string
          pocket?: string
          semester?: string | null
          academic_year?: string | null
          memo_no?: string | null
          memo_date?: string | null
          reason?: string | null
          director_approved_at?: string | null
          director_approved_by?: string | null
          director_approved_by_name?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      fin_fund_loan_lines: {
        Row: {
          id: string
          loan_id: string
          borrower_type_id: string
          amount: number
          sort_order: number
        }
        Insert: {
          id?: string
          loan_id: string
          borrower_type_id: string
          amount: number
          sort_order?: number
        }
        Update: {
          id?: string
          loan_id?: string
          borrower_type_id?: string
          amount?: number
          sort_order?: number
        }
        Relationships: [
          { foreignKeyName: "fin_fund_loan_lines_loan_id_fkey"; columns: ["loan_id"]; isOneToOne: false; referencedRelation: "fin_fund_loans"; referencedColumns: ["id"] },
        ]
      }
      fin_fund_loan_repays: {
        Row: {
          id: string
          line_id: string
          fiscal_year: number
          doc_seq: number
          repay_date: string
          amount: number
          pocket: string
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          line_id: string
          fiscal_year: number
          doc_seq: number
          repay_date: string
          amount: number
          pocket?: string
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          line_id?: string
          fiscal_year?: number
          doc_seq?: number
          repay_date?: string
          amount?: number
          pocket?: string
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          { foreignKeyName: "fin_fund_loan_repays_line_id_fkey"; columns: ["line_id"]; isOneToOne: false; referencedRelation: "fin_fund_loan_lines"; referencedColumns: ["id"] },
        ]
      }
      fin_receipt_forms: {
        Row: {
          id: string
          kind: string
          title: string
          data: Json
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          kind: string
          title?: string
          data?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          kind?: string
          title?: string
          data?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      fin_money_types: {
        Row: {
          account_id: string | null
          category: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          account_id?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          account_id?: string | null
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "fin_money_types_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "fin_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_opening_balances: {
        Row: {
          bank: number
          cash: number
          fiscal_year: number
          gov: number
          money_type_id: string
          updated_at: string
        }
        Insert: {
          bank?: number
          cash?: number
          fiscal_year: number
          gov?: number
          money_type_id: string
          updated_at?: string
        }
        Update: {
          bank?: number
          cash?: number
          fiscal_year?: number
          gov?: number
          money_type_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_opening_balances_money_type_id_fkey"
            columns: ["money_type_id"]
            isOneToOne: false
            referencedRelation: "fin_money_types"
            referencedColumns: ["id"]
          },
        ]
      }
      fin_source_skips: {
        Row: {
          created_at: string
          created_by: string | null
          reason: string | null
          source_id: string
          source_kind: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          reason?: string | null
          source_id: string
          source_kind: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          reason?: string | null
          source_id?: string
          source_kind?: string
        }
        Relationships: []
      }
      fin_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      fin_transactions: {
        Row: {
          activity_id: string | null
          amount: number
          created_at: string
          created_by: string | null
          description: string
          doc_kind: string | null
          doc_no: string | null
          doc_seq: number | null
          fiscal_year: number
          from_pocket: string | null
          id: string
          kind: string
          money_type_id: string
          note: string | null
          source_id: string | null
          source_kind: string | null
          fund_line_id: string | null
          fund_repay_id: string | null
          fund_role: string | null
          payee: string | null
          project_id: string | null
          to_pocket: string | null
          txn_date: string
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          amount: number
          created_at?: string
          created_by?: string | null
          description: string
          doc_kind?: string | null
          doc_no?: string | null
          doc_seq?: number | null
          fiscal_year: number
          from_pocket?: string | null
          id?: string
          kind: string
          money_type_id: string
          note?: string | null
          source_id?: string | null
          source_kind?: string | null
          fund_line_id?: string | null
          fund_repay_id?: string | null
          fund_role?: string | null
          payee?: string | null
          project_id?: string | null
          to_pocket?: string | null
          txn_date: string
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string
          doc_kind?: string | null
          doc_no?: string | null
          doc_seq?: number | null
          fiscal_year?: number
          from_pocket?: string | null
          id?: string
          kind?: string
          money_type_id?: string
          note?: string | null
          source_id?: string | null
          source_kind?: string | null
          fund_line_id?: string | null
          fund_repay_id?: string | null
          fund_role?: string | null
          payee?: string | null
          project_id?: string | null
          to_pocket?: string | null
          txn_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fin_transactions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "plan_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_transactions_money_type_id_fkey"
            columns: ["money_type_id"]
            isOneToOne: false
            referencedRelation: "fin_money_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fin_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "plan_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_acquisition_methods: {
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
      asset_audit_inspectors: {
        Row: {
          audit_round_id: string
          full_name_snapshot: string
          id: string
          role_in_committee: string | null
          sort_order: number
          user_id: string
        }
        Insert: {
          audit_round_id: string
          full_name_snapshot: string
          id?: string
          role_in_committee?: string | null
          sort_order?: number
          user_id: string
        }
        Update: {
          audit_round_id?: string
          full_name_snapshot?: string
          id?: string
          role_in_committee?: string | null
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_audit_inspectors_audit_round_id_fkey"
            columns: ["audit_round_id"]
            isOneToOne: false
            referencedRelation: "asset_audit_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_audit_items: {
        Row: {
          actual_condition_id: string | null
          actual_location: string | null
          audit_round_id: string
          book_condition_id: string
          found: boolean | null
          id: string
          inspected_at: string | null
          inspected_by: string | null
          item_id: string
          note: string | null
        }
        Insert: {
          actual_condition_id?: string | null
          actual_location?: string | null
          audit_round_id: string
          book_condition_id: string
          found?: boolean | null
          id?: string
          inspected_at?: string | null
          inspected_by?: string | null
          item_id: string
          note?: string | null
        }
        Update: {
          actual_condition_id?: string | null
          actual_location?: string | null
          audit_round_id?: string
          book_condition_id?: string
          found?: boolean | null
          id?: string
          inspected_at?: string | null
          inspected_by?: string | null
          item_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "asset_audit_items_actual_condition_id_fkey"
            columns: ["actual_condition_id"]
            isOneToOne: false
            referencedRelation: "asset_conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_audit_items_audit_round_id_fkey"
            columns: ["audit_round_id"]
            isOneToOne: false
            referencedRelation: "asset_audit_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_audit_items_book_condition_id_fkey"
            columns: ["book_condition_id"]
            isOneToOne: false
            referencedRelation: "asset_conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_audit_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "asset_items"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_audit_rounds: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          appointment_date: string | null
          appointment_doc_ref: string | null
          created_at: string
          created_by: string | null
          deputy_acknowledged_at: string | null
          deputy_acknowledged_by: string | null
          due_date: string
          fiscal_year: number
          id: string
          report_note: string | null
          start_date: string
          status: Database["public"]["Enums"]["asset_audit_status"]
          submitted_at: string | null
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          appointment_date?: string | null
          appointment_doc_ref?: string | null
          created_at?: string
          created_by?: string | null
          deputy_acknowledged_at?: string | null
          deputy_acknowledged_by?: string | null
          due_date: string
          fiscal_year: number
          id?: string
          report_note?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["asset_audit_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          appointment_date?: string | null
          appointment_doc_ref?: string | null
          created_at?: string
          created_by?: string | null
          deputy_acknowledged_at?: string | null
          deputy_acknowledged_by?: string | null
          due_date?: string
          fiscal_year?: number
          id?: string
          report_note?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["asset_audit_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: []
      }
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
          type_code: string | null
          useful_life_years: number | null
        }
        Insert: {
          depreciation_rate_percent?: number | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          type_code?: string | null
          useful_life_years?: number | null
        }
        Update: {
          depreciation_rate_percent?: number | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          type_code?: string | null
          useful_life_years?: number | null
        }
        Relationships: []
      }
      asset_conditions: {
        Row: {
          badge_color: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          badge_color?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          badge_color?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      asset_item_types: {
        Row: {
          category_id: string
          code: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
        }
        Insert: {
          category_id: string
          code: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
        }
        Update: {
          category_id?: string
          code?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_item_types_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "asset_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_items: {
        Row: {
          source_seq: number | null
          source_id: string | null
          source_type: string | null
          acquired_date: string | null
          acquired_year: number | null
          acquisition_method: string | null
          acquisition_method_id: string | null
          asset_code: string | null
          budget_source_id: string | null
          building: string
          category_id: string | null
          condition_id: string
          created_at: string
          doc_ref: string | null
          floor: string | null
          id: string
          item_type_id: string | null
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
          sequence_no: string | null
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
          source_seq?: number | null
          source_id?: string | null
          source_type?: string | null
          acquired_date?: string | null
          acquired_year?: number | null
          acquisition_method?: string | null
          acquisition_method_id?: string | null
          asset_code?: string | null
          budget_source_id?: string | null
          building: string
          category_id?: string | null
          condition_id: string
          created_at?: string
          doc_ref?: string | null
          floor?: string | null
          id?: string
          item_type_id?: string | null
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
          sequence_no?: string | null
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
          source_seq?: number | null
          source_id?: string | null
          source_type?: string | null
          acquired_date?: string | null
          acquired_year?: number | null
          acquisition_method?: string | null
          acquisition_method_id?: string | null
          asset_code?: string | null
          budget_source_id?: string | null
          building?: string
          category_id?: string | null
          condition_id?: string
          created_at?: string
          doc_ref?: string | null
          floor?: string | null
          id?: string
          item_type_id?: string | null
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
          sequence_no?: string | null
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
            foreignKeyName: "asset_items_acquisition_method_id_fkey"
            columns: ["acquisition_method_id"]
            isOneToOne: false
            referencedRelation: "asset_acquisition_methods"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "asset_items_condition_id_fkey"
            columns: ["condition_id"]
            isOneToOne: false
            referencedRelation: "asset_conditions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asset_items_item_type_id_fkey"
            columns: ["item_type_id"]
            isOneToOne: false
            referencedRelation: "asset_item_types"
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
      asset_repairs: {
        Row: {
          amount: number | null
          created_at: string
          description: string
          id: string
          item_id: string
          note: string | null
          repaired_date: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          description: string
          id?: string
          item_id: string
          note?: string | null
          repaired_date: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          description?: string
          id?: string
          item_id?: string
          note?: string | null
          repaired_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_repairs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "asset_items"
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
      eval_answers: {
        Row: {
          answer_value: string
          id: string
          question_id: string
          response_id: string
        }
        Insert: {
          answer_value: string
          id?: string
          question_id: string
          response_id: string
        }
        Update: {
          answer_value?: string
          id?: string
          question_id?: string
          response_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eval_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "eval_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eval_answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "eval_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_criteria: {
        Row: {
          created_at: string
          form_id: string
          id: string
          label: string
          max_score: number
          min_score: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          form_id: string
          id?: string
          label: string
          max_score: number
          min_score: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          form_id?: string
          id?: string
          label?: string
          max_score?: number
          min_score?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "eval_criteria_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "eval_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_forms: {
        Row: {
          closes_at: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_template: boolean
          opens_at: string | null
          project_id: string | null
          status: string
          template_source_id: string | null
          title: string
          token: string
          updated_at: string
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_template?: boolean
          opens_at?: string | null
          project_id?: string | null
          status?: string
          template_source_id?: string | null
          title: string
          token?: string
          updated_at?: string
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_template?: boolean
          opens_at?: string | null
          project_id?: string | null
          status?: string
          template_source_id?: string | null
          title?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eval_forms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "plan_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eval_forms_template_source_id_fkey"
            columns: ["template_source_id"]
            isOneToOne: false
            referencedRelation: "eval_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_questions: {
        Row: {
          category: string | null
          created_at: string
          form_id: string
          id: string
          options: Json | null
          question_text: string
          question_type: string
          required: boolean
          sort_order: number
        }
        Insert: {
          category?: string | null
          created_at?: string
          form_id: string
          id?: string
          options?: Json | null
          question_text: string
          question_type: string
          required?: boolean
          sort_order?: number
        }
        Update: {
          category?: string | null
          created_at?: string
          form_id?: string
          id?: string
          options?: Json | null
          question_text?: string
          question_type?: string
          required?: boolean
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "eval_questions_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "eval_forms"
            referencedColumns: ["id"]
          },
        ]
      }
      eval_responses: {
        Row: {
          form_id: string
          id: string
          submitted_at: string
        }
        Insert: {
          form_id: string
          id?: string
          submitted_at?: string
        }
        Update: {
          form_id?: string
          id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eval_responses_form_id_fkey"
            columns: ["form_id"]
            isOneToOne: false
            referencedRelation: "eval_forms"
            referencedColumns: ["id"]
          },
        ]
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
          draft_projects_open_edit: boolean
          id: string
          is_open: boolean
          name: string
          year: number
        }
        Insert: {
          created_at?: string
          draft_projects_open_edit?: boolean
          id?: string
          is_open?: boolean
          name: string
          year: number
        }
        Update: {
          created_at?: string
          draft_projects_open_edit?: boolean
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
      plan_draft_activities: {
        Row: {
          budget: number
          created_at: string
          draft_project_id: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          budget?: number
          created_at?: string
          draft_project_id: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          budget?: number
          created_at?: string
          draft_project_id?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_draft_activities_draft_project_id_fkey"
            columns: ["draft_project_id"]
            isOneToOne: false
            referencedRelation: "plan_draft_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_draft_projects: {
        Row: {
          admin_group_id: string | null
          budget: number
          budget_source_id: string | null
          budget_year_id: string
          created_at: string
          editing_at: string | null
          editing_by: string | null
          editing_by_name: string | null
          id: string
          name: string
          sort_order: number
          source_project_id: string | null
          updated_at: string
        }
        Insert: {
          admin_group_id?: string | null
          budget?: number
          budget_source_id?: string | null
          budget_year_id: string
          created_at?: string
          editing_at?: string | null
          editing_by?: string | null
          editing_by_name?: string | null
          id?: string
          name: string
          sort_order?: number
          source_project_id?: string | null
          updated_at?: string
        }
        Update: {
          admin_group_id?: string | null
          budget?: number
          budget_source_id?: string | null
          budget_year_id?: string
          created_at?: string
          editing_at?: string | null
          editing_by?: string | null
          editing_by_name?: string | null
          id?: string
          name?: string
          sort_order?: number
          source_project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_draft_projects_admin_group_id_fkey"
            columns: ["admin_group_id"]
            isOneToOne: false
            referencedRelation: "plan_admin_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_draft_projects_budget_source_id_fkey"
            columns: ["budget_source_id"]
            isOneToOne: false
            referencedRelation: "plan_budget_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_draft_projects_budget_year_id_fkey"
            columns: ["budget_year_id"]
            isOneToOne: false
            referencedRelation: "plan_budget_years"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_group_allocations: {
        Row: {
          admin_group_id: string
          allocated_amount: number
          budget_year_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          admin_group_id: string
          allocated_amount?: number
          budget_year_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          admin_group_id?: string
          allocated_amount?: number
          budget_year_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_group_allocations_admin_group_id_fkey"
            columns: ["admin_group_id"]
            isOneToOne: false
            referencedRelation: "plan_admin_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_group_allocations_budget_year_id_fkey"
            columns: ["budget_year_id"]
            isOneToOne: false
            referencedRelation: "plan_budget_years"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_learning_areas: {
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
          draft_project_id: string | null
          endorse_note: string | null
          endorsed_at: string | null
          endorsed_by_name: string | null
          file_url_pdf: string | null
          file_url_word: string | null
          id: string
          indicators_quality: Json
          indicators_quantity: Json
          name: string
          objectives: Json
          project_id: string | null
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
          draft_project_id?: string | null
          endorse_note?: string | null
          endorsed_at?: string | null
          endorsed_by_name?: string | null
          file_url_pdf?: string | null
          file_url_word?: string | null
          id?: string
          indicators_quality?: Json
          indicators_quantity?: Json
          name: string
          objectives?: Json
          project_id?: string | null
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
          draft_project_id?: string | null
          endorse_note?: string | null
          endorsed_at?: string | null
          endorsed_by_name?: string | null
          file_url_pdf?: string | null
          file_url_word?: string | null
          id?: string
          indicators_quality?: Json
          indicators_quantity?: Json
          name?: string
          objectives?: Json
          project_id?: string | null
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
          {
            foreignKeyName: "plan_project_proposals_project_id_fkey"
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
      plan_revenue_rates: {
        Row: {
          budget_year_id: string
          created_at: string
          grade_key: string
          id: string
          item_key: string
          rate_per_student: number
          updated_at: string
        }
        Insert: {
          budget_year_id: string
          created_at?: string
          grade_key: string
          id?: string
          item_key: string
          rate_per_student?: number
          updated_at?: string
        }
        Update: {
          budget_year_id?: string
          created_at?: string
          grade_key?: string
          id?: string
          item_key?: string
          rate_per_student?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_revenue_rates_budget_year_id_fkey"
            columns: ["budget_year_id"]
            isOneToOne: false
            referencedRelation: "plan_budget_years"
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
      plan_school_income: {
        Row: {
          amount: number
          budget_year_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          amount?: number
          budget_year_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          budget_year_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_school_income_budget_year_id_fkey"
            columns: ["budget_year_id"]
            isOneToOne: true
            referencedRelation: "plan_budget_years"
            referencedColumns: ["id"]
          },
        ]
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
      plan_student_counts: {
        Row: {
          budget_year_id: string
          created_at: string
          grade_key: string
          id: string
          student_count: number
          updated_at: string
        }
        Insert: {
          budget_year_id: string
          created_at?: string
          grade_key: string
          id?: string
          student_count?: number
          updated_at?: string
        }
        Update: {
          budget_year_id?: string
          created_at?: string
          grade_key?: string
          id?: string
          student_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_student_counts_budget_year_id_fkey"
            columns: ["budget_year_id"]
            isOneToOne: false
            referencedRelation: "plan_budget_years"
            referencedColumns: ["id"]
          },
        ]
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
      proc_app_settings: {
        Row: {
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      proc_approval_items: {
        Row: {
          approval_id: string
          id: string
          name: string | null
          note: string | null
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
          note?: string | null
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
          note?: string | null
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
          planning_ack_by_name: string | null
          planning_ack_at: string | null
          planning_note: string | null
          activity_name: string | null
          addressed_to: string
          approve_note: string | null
          approved_at: string | null
          approved_by_name: string | null
          budget: number | null
          budget_year_text: string | null
          created_at: string
          created_by: string | null
          department: string | null
          deputy_decided_at: string | null
          delivery_id: string | null
          deputy_decided_by_name: string | null
          deputy_decision: string | null
          deputy_note: string | null
          detail_text: string | null
          doc_date: string
          doc_number: string | null
          fund_type: string | null
          group_name: string | null
          id: string
          item_list_pdf_url: string | null
          paid: number | null
          plan_date_text: string | null
          project_id: string | null
          remaining: number | null
          requested_amount: number
          requested_by_name: string | null
          requested_by_position: string | null
          status: string
          subject: string
          summary_items: Json
          updated_at: string
        }
        Insert: {
          planning_ack_by_name?: string | null
          planning_ack_at?: string | null
          planning_note?: string | null
          activity_name?: string | null
          addressed_to: string
          approve_note?: string | null
          approved_at?: string | null
          approved_by_name?: string | null
          budget?: number | null
          budget_year_text?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          deputy_decided_at?: string | null
          delivery_id?: string | null
          deputy_decided_by_name?: string | null
          deputy_decision?: string | null
          deputy_note?: string | null
          detail_text?: string | null
          doc_date: string
          doc_number?: string | null
          fund_type?: string | null
          group_name?: string | null
          id?: string
          item_list_pdf_url?: string | null
          paid?: number | null
          plan_date_text?: string | null
          project_id?: string | null
          remaining?: number | null
          requested_amount?: number
          requested_by_name?: string | null
          requested_by_position?: string | null
          status?: string
          subject: string
          summary_items?: Json
          updated_at?: string
        }
        Update: {
          planning_ack_by_name?: string | null
          planning_ack_at?: string | null
          planning_note?: string | null
          activity_name?: string | null
          addressed_to?: string
          approve_note?: string | null
          approved_at?: string | null
          approved_by_name?: string | null
          budget?: number | null
          budget_year_text?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          deputy_decided_at?: string | null
          delivery_id?: string | null
          deputy_decided_by_name?: string | null
          deputy_decision?: string | null
          deputy_note?: string | null
          detail_text?: string | null
          doc_date?: string
          doc_number?: string | null
          fund_type?: string | null
          group_name?: string | null
          id?: string
          item_list_pdf_url?: string | null
          paid?: number | null
          plan_date_text?: string | null
          project_id?: string | null
          remaining?: number | null
          requested_amount?: number
          requested_by_name?: string | null
          requested_by_position?: string | null
          status?: string
          subject?: string
          summary_items?: Json
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
      proc_contract_items: {
        Row: {
          contract_id: string
          created_at: string
          id: string
          name: string | null
          note: string | null
          qty: number | null
          seq: number
          total: number | null
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          id?: string
          name?: string | null
          note?: string | null
          qty?: number | null
          seq: number
          unit?: string | null
          unit_price?: number | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          id?: string
          name?: string | null
          note?: string | null
          qty?: number | null
          seq?: number
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "proc_contract_items_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "proc_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_contracts: {
        Row: {
          budget_source_id: string | null
          contract_file_path: string | null
          rent_periods: number | null
          rent_unit: string | null
          rent_monthly: number | null
          rental_area: string | null
          discount: number | null
          vat_type: string | null
          contract_type: string
          end_date: string | null
          guarantee_amount: number | null
          guarantee_type: string | null
          note: string | null
          penalty_rate: number | null
          start_date: string | null
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
          budget_source_id?: string | null
          contract_file_path?: string | null
          rent_periods?: number | null
          rent_unit?: string | null
          rent_monthly?: number | null
          rental_area?: string | null
          discount?: number | null
          vat_type?: string | null
          contract_type?: string
          end_date?: string | null
          guarantee_amount?: number | null
          guarantee_type?: string | null
          note?: string | null
          penalty_rate?: number | null
          start_date?: string | null
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
          budget_source_id?: string | null
          contract_file_path?: string | null
          rent_periods?: number | null
          rent_unit?: string | null
          rent_monthly?: number | null
          rental_area?: string | null
          discount?: number | null
          vat_type?: string | null
          contract_type?: string
          end_date?: string | null
          guarantee_amount?: number | null
          guarantee_type?: string | null
          note?: string | null
          penalty_rate?: number | null
          start_date?: string | null
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
            foreignKeyName: "proc_contracts_budget_source_id_fkey"
            columns: ["budget_source_id"]
            isOneToOne: false
            referencedRelation: "plan_budget_sources"
            referencedColumns: ["id"]
          },

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
          withholding_tax: number | null
          period_month: string | null
          installment_no: number | null
          late_days: number | null
          note: string | null
          penalty_amount: number | null
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
          withholding_tax?: number | null
          period_month?: string | null
          installment_no?: number | null
          late_days?: number | null
          note?: string | null
          penalty_amount?: number | null
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
          withholding_tax?: number | null
          period_month?: string | null
          installment_no?: number | null
          late_days?: number | null
          note?: string | null
          penalty_amount?: number | null
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
          category: string | null
          created_at: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          sort_order: number | null
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          sort_order?: number | null
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          sort_order?: number | null
          uploaded_by?: string | null
        }
        Relationships: []
      }
      proc_profiles: {
        Row: {
          real_role: Database["public"]["Enums"]["proc_user_role"] | null
          avatar_url: string | null
          created_at: string
          full_name: string
          position: string | null
          role: Database["public"]["Enums"]["proc_user_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          real_role?: Database["public"]["Enums"]["proc_user_role"] | null
          avatar_url?: string | null
          created_at?: string
          full_name: string
          position?: string | null
          role?: Database["public"]["Enums"]["proc_user_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          real_role?: Database["public"]["Enums"]["proc_user_role"] | null
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          position?: string | null
          role?: Database["public"]["Enums"]["proc_user_role"]
          status?: string
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
          activities_done: Json
          background: string | null
          budget_approved: number | null
          budget_used: number | null
          created_at: string
          file_url: string | null
          highlights: Json
          id: string
          indicator_results_quality: Json
          indicator_results_quantity: Json
          location: string | null
          not_implemented: boolean
          not_implemented_reason: string | null
          objectives: Json
          period_end: string | null
          period_start: string | null
          photo_refs: Json
          problems: Json
          project_id: string | null
          recommendations: Json
          responsible_name: string | null
          satisfaction_percent: number | null
          uploaded_by: string | null
        }
        Insert: {
          activities_done?: Json
          background?: string | null
          budget_approved?: number | null
          budget_used?: number | null
          created_at?: string
          file_url?: string | null
          highlights?: Json
          id?: string
          indicator_results_quality?: Json
          indicator_results_quantity?: Json
          location?: string | null
          not_implemented?: boolean
          not_implemented_reason?: string | null
          objectives?: Json
          period_end?: string | null
          period_start?: string | null
          photo_refs?: Json
          problems?: Json
          project_id?: string | null
          recommendations?: Json
          responsible_name?: string | null
          satisfaction_percent?: number | null
          uploaded_by?: string | null
        }
        Update: {
          activities_done?: Json
          background?: string | null
          budget_approved?: number | null
          budget_used?: number | null
          created_at?: string
          file_url?: string | null
          highlights?: Json
          id?: string
          indicator_results_quality?: Json
          indicator_results_quantity?: Json
          location?: string | null
          not_implemented?: boolean
          not_implemented_reason?: string | null
          objectives?: Json
          period_end?: string | null
          period_start?: string | null
          photo_refs?: Json
          problems?: Json
          project_id?: string | null
          recommendations?: Json
          responsible_name?: string | null
          satisfaction_percent?: number | null
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
          item_class: string | null
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
          item_class?: string | null
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
          item_class?: string | null
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
      proc_purchase_photos: {
        Row: {
          category: string
          created_at: string
          file_ref: string
          id: string
          purchase_request_id: string
        }
        Insert: {
          category: string
          created_at?: string
          file_ref: string
          id?: string
          purchase_request_id: string
        }
        Update: {
          category?: string
          created_at?: string
          file_ref?: string
          id?: string
          purchase_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proc_purchase_photos_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "proc_purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_purchase_requests: {
        Row: {
          vat_type: string
          discount: number
          register_note: string | null
          receipt_type: string | null
          activity_id: string | null
          approval_id: string | null
          admin_group: string | null
          amount: number
          created_at: string
          created_by: string | null
          delivery_date: string
          detail: string | null
          doc_no: string
          egp_no: string | null
          method: string
          receipt_book: string | null
          receipt_no: string | null
          receipt_date: string | null
          funding: string | null
          loan_contract_no: string | null
          loan_date: string | null
          spec_author: string | null
          doc_type: Database["public"]["Enums"]["proc_purchase_type"]
          id: string
          inspector_name: string | null
          inspector_position: string | null
          item_name: string | null
          pdf_url: string | null
          penalty_rate: number | null
          order_date: string | null
          delivered_date: string | null
          inspected_date: string | null
          report_date: string | null
          order_signer: string | null
          project_id: string | null
          reason: string | null
          record_date: string
          supply_officer_name: string | null
          updated_at: string
          vendor_id: string | null
          work_days: number | null
        }
        Insert: {
          vat_type?: string
          discount?: number
          register_note?: string | null
          receipt_type?: string | null
          activity_id?: string | null
          approval_id?: string | null
          admin_group?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          delivery_date: string
          detail?: string | null
          doc_no: string
          egp_no?: string | null
          method?: string
          receipt_book?: string | null
          receipt_no?: string | null
          receipt_date?: string | null
          funding?: string | null
          loan_contract_no?: string | null
          loan_date?: string | null
          spec_author?: string | null
          doc_type: Database["public"]["Enums"]["proc_purchase_type"]
          id?: string
          inspector_name?: string | null
          inspector_position?: string | null
          item_name?: string | null
          pdf_url?: string | null
          penalty_rate?: number | null
          order_date?: string | null
          delivered_date?: string | null
          inspected_date?: string | null
          report_date?: string | null
          order_signer?: string | null
          project_id?: string | null
          reason?: string | null
          record_date: string
          supply_officer_name?: string | null
          updated_at?: string
          vendor_id?: string | null
          work_days?: number | null
        }
        Update: {
          vat_type?: string
          discount?: number
          register_note?: string | null
          receipt_type?: string | null
          activity_id?: string | null
          approval_id?: string | null
          admin_group?: string | null
          amount?: number
          created_at?: string
          created_by?: string | null
          delivery_date?: string
          detail?: string | null
          doc_no?: string
          egp_no?: string | null
          method?: string
          receipt_book?: string | null
          receipt_no?: string | null
          receipt_date?: string | null
          funding?: string | null
          loan_contract_no?: string | null
          loan_date?: string | null
          spec_author?: string | null
          doc_type?: Database["public"]["Enums"]["proc_purchase_type"]
          id?: string
          inspector_name?: string | null
          inspector_position?: string | null
          item_name?: string | null
          pdf_url?: string | null
          penalty_rate?: number | null
          order_date?: string | null
          delivered_date?: string | null
          inspected_date?: string | null
          report_date?: string | null
          order_signer?: string | null
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
      proc_school_settings: {
        Row: {
          asset_code_prefix: string | null
          education_area: string | null
          id: boolean
          logo_url: string | null
          maintenance_enabled: boolean
          maintenance_message: string | null
          school_address: string | null
          school_name: string
          updated_at: string
        }
        Insert: {
          asset_code_prefix?: string | null
          education_area?: string | null
          id?: boolean
          logo_url?: string | null
          maintenance_enabled?: boolean
          maintenance_message?: string | null
          school_address?: string | null
          school_name?: string
          updated_at?: string
        }
        Update: {
          asset_code_prefix?: string | null
          education_area?: string | null
          id?: boolean
          logo_url?: string | null
          maintenance_enabled?: boolean
          maintenance_message?: string | null
          school_address?: string | null
          school_name?: string
          updated_at?: string
        }
        Relationships: []
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
      proc_teacher_positions: {
        Row: {
          position: string
          teacher_name: string
          updated_at: string
        }
        Insert: {
          position: string
          teacher_name: string
          updated_at?: string
        }
        Update: {
          position?: string
          teacher_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      proc_vendors: {
        Row: {
          vat_registered: boolean | null
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
          vat_registered?: boolean | null
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
          vat_registered?: boolean | null
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
      proc_expense_claim_items: {
        Row: {
          id: string
          claim_id: string
          seq: number
          kind: string
          name: string
          rate: number | null
          units: number | null
          people: number | null
          days: number | null
          amount: number
          payee: string | null
          evidence: string | null
          receipt_book: string | null
          receipt_no: string | null
          receipt_date: string | null
          rate_id: string | null
        }
        Insert: {
          id?: string
          claim_id: string
          seq: number
          kind: string
          name: string
          rate?: number | null
          units?: number | null
          people?: number | null
          days?: number | null
          amount?: number
          payee?: string | null
          evidence?: string | null
          receipt_book?: string | null
          receipt_no?: string | null
          receipt_date?: string | null
          rate_id?: string | null
        }
        Update: {
          id?: string
          claim_id?: string
          seq?: number
          kind?: string
          name?: string
          rate?: number | null
          units?: number | null
          people?: number | null
          days?: number | null
          amount?: number
          payee?: string | null
          evidence?: string | null
          receipt_book?: string | null
          receipt_no?: string | null
          receipt_date?: string | null
          rate_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proc_expense_claim_items_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "proc_expense_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_expense_claim_photos: {
        Row: {
          id: string
          claim_id: string
          category: string
          file_ref: string
          created_at: string
        }
        Insert: {
          id?: string
          claim_id: string
          category: string
          file_ref: string
          created_at?: string
        }
        Update: {
          id?: string
          claim_id?: string
          category?: string
          file_ref?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proc_expense_claim_photos_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "proc_expense_claims"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_expense_claims: {
        Row: {
          approval_id: string | null
          id: string
          doc_no: string | null
          record_date: string
          event_name: string
          event_date: string
          event_end_date: string | null
          venue: string | null
          admin_group: string | null
          project_id: string | null
          activity_id: string | null
          approval_ref: string | null
          approval_ref_date: string | null
          responsible_name: string | null
          responsible_position: string | null
          fund_source: string | null
          payment_method: string
          amount: number
          created_by: string | null
          created_at: string
        }
        Insert: {
          approval_id?: string | null
          id?: string
          doc_no?: string | null
          record_date: string
          event_name: string
          event_date: string
          event_end_date?: string | null
          venue?: string | null
          admin_group?: string | null
          project_id?: string | null
          activity_id?: string | null
          approval_ref?: string | null
          approval_ref_date?: string | null
          responsible_name?: string | null
          responsible_position?: string | null
          fund_source?: string | null
          payment_method?: string
          amount?: number
          created_by?: string | null
          created_at?: string
        }
        Update: {
          approval_id?: string | null
          id?: string
          doc_no?: string | null
          record_date?: string
          event_name?: string
          event_date?: string
          event_end_date?: string | null
          venue?: string | null
          admin_group?: string | null
          project_id?: string | null
          activity_id?: string | null
          approval_ref?: string | null
          approval_ref_date?: string | null
          responsible_name?: string | null
          responsible_position?: string | null
          fund_source?: string | null
          payment_method?: string
          amount?: number
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proc_expense_claims_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "plan_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_expense_claims_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "plan_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_expense_rates: {
        Row: {
          id: string
          kind: string
          name: string
          max_rate: number
          unit_note: string | null
          note: string | null
          source: string | null
          sort_order: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          kind: string
          name: string
          max_rate: number
          unit_note?: string | null
          note?: string | null
          source?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          kind?: string
          name?: string
          max_rate?: number
          unit_note?: string | null
          note?: string | null
          source?: string | null
          sort_order?: number
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      proc_w119_items: {
        Row: {
          unit: string | null
          qty: number | null
          item_class: string | null
          id: string
          report_id: string
          seq: number
          name: string
          vendor: string | null
          evidence: string | null
          receipt_book: string | null
          receipt_no: string | null
          receipt_date: string | null
          amount: number
        }
        Insert: {
          unit?: string | null
          qty?: number | null
          item_class?: string | null
          id?: string
          report_id: string
          seq: number
          name: string
          vendor?: string | null
          evidence?: string | null
          receipt_book?: string | null
          receipt_no?: string | null
          receipt_date?: string | null
          amount?: number
        }
        Update: {
          unit?: string | null
          qty?: number | null
          item_class?: string | null
          id?: string
          report_id?: string
          seq?: number
          name?: string
          vendor?: string | null
          evidence?: string | null
          receipt_book?: string | null
          receipt_no?: string | null
          receipt_date?: string | null
          amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "proc_w119_items_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "proc_w119_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_w119_photos: {
        Row: {
          id: string
          report_id: string
          category: string
          file_ref: string
          created_at: string
        }
        Insert: {
          id?: string
          report_id: string
          category: string
          file_ref: string
          created_at?: string
        }
        Update: {
          id?: string
          report_id?: string
          category?: string
          file_ref?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proc_w119_photos_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "proc_w119_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_stock_items: {
        Row: {
          id: string
          code: string | null
          category: string
          name: string
          size_desc: string | null
          unit: string
          location: string | null
          max_qty: number | null
          min_qty: number | null
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          code?: string | null
          category?: string
          name: string
          size_desc?: string | null
          unit: string
          location?: string | null
          max_qty?: number | null
          min_qty?: number | null
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          code?: string | null
          category?: string
          name?: string
          size_desc?: string | null
          unit?: string
          location?: string | null
          max_qty?: number | null
          min_qty?: number | null
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      proc_stock_moves: {
        Row: {
          id: string
          item_id: string
          move_date: string
          kind: string
          qty: number
          requested_qty: number | null
          unit_price: number
          party: string | null
          doc_no: string | null
          note: string | null
          source_type: string | null
          source_id: string | null
          source_seq: number | null
          lot_id: string | null
          requisition_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          item_id: string
          move_date: string
          kind: string
          qty: number
          requested_qty?: number | null
          unit_price?: number
          party?: string | null
          doc_no?: string | null
          note?: string | null
          source_type?: string | null
          source_id?: string | null
          source_seq?: number | null
          lot_id?: string | null
          requisition_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          item_id?: string
          move_date?: string
          kind?: string
          qty?: number
          requested_qty?: number | null
          unit_price?: number
          party?: string | null
          doc_no?: string | null
          note?: string | null
          source_type?: string | null
          source_id?: string | null
          source_seq?: number | null
          lot_id?: string | null
          requisition_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proc_stock_moves_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "proc_stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_stock_moves_requisition_id_fkey"
            columns: ["requisition_id"]
            isOneToOne: false
            referencedRelation: "proc_stock_requisitions"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_loan_contracts: {
        Row: {
          borrower_user_id: string | null
          submitted_by_name: string | null
          checked_date: string | null
          project_id: string | null
          activity_id: string | null
          id: string
          doc_no: string | null
          request_date: string
          borrower_name: string
          borrower_position: string | null
          fund_source: string | null
          purpose: string
          loan_type: string
          travel_return_date: string | null
          items: Json
          amount: number
          due_days: number
          received_date: string | null
          due_date: string | null
          checker_name: string | null
          approver_name: string | null
          director_approved_at: string | null
          director_approved_by: string | null
          director_approved_by_name: string | null
          note: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          borrower_user_id?: string | null
          submitted_by_name?: string | null
          checked_date?: string | null
          project_id?: string | null
          activity_id?: string | null
          id?: string
          doc_no?: string | null
          request_date: string
          borrower_name: string
          borrower_position?: string | null
          fund_source?: string | null
          purpose: string
          loan_type?: string
          travel_return_date?: string | null
          items?: Json
          amount?: number
          due_days?: number
          received_date?: string | null
          due_date?: string | null
          checker_name?: string | null
          approver_name?: string | null
          director_approved_at?: string | null
          director_approved_by?: string | null
          director_approved_by_name?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          borrower_user_id?: string | null
          submitted_by_name?: string | null
          checked_date?: string | null
          project_id?: string | null
          activity_id?: string | null
          id?: string
          doc_no?: string | null
          request_date?: string
          borrower_name?: string
          borrower_position?: string | null
          fund_source?: string | null
          purpose?: string
          loan_type?: string
          travel_return_date?: string | null
          items?: Json
          amount?: number
          due_days?: number
          received_date?: string | null
          due_date?: string | null
          checker_name?: string | null
          approver_name?: string | null
          director_approved_at?: string | null
          director_approved_by?: string | null
          director_approved_by_name?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proc_loan_contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "plan_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_loan_contracts_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "plan_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_loan_repayments: {
        Row: {
          voucher_count: number | null
          id: string
          loan_id: string
          repay_date: string
          cash_amount: number
          voucher_amount: number
          receipt_no: string | null
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          voucher_count?: number | null
          id?: string
          loan_id: string
          repay_date: string
          cash_amount?: number
          voucher_amount?: number
          receipt_no?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          voucher_count?: number | null
          id?: string
          loan_id?: string
          repay_date?: string
          cash_amount?: number
          voucher_amount?: number
          receipt_no?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proc_loan_repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "proc_loan_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_stock_requisitions: {
        Row: {
          id: string
          doc_no: string | null
          req_date: string
          requester_name: string
          requester_position: string | null
          purpose: string | null
          source_type: string | null
          source_id: string | null
          note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          doc_no?: string | null
          req_date: string
          requester_name: string
          requester_position?: string | null
          purpose?: string | null
          source_type?: string | null
          source_id?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          doc_no?: string | null
          req_date?: string
          requester_name?: string
          requester_position?: string | null
          purpose?: string | null
          source_type?: string | null
          source_id?: string | null
          note?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      proc_urgent_items: {
        Row: {
          unit: string | null
          qty: number | null
          item_class: string | null
          id: string
          report_id: string
          seq: number
          kind: string
          name: string
          amount: number
        }
        Insert: {
          unit?: string | null
          qty?: number | null
          item_class?: string | null
          id?: string
          report_id: string
          seq?: number
          kind?: string
          name: string
          amount: number
        }
        Update: {
          unit?: string | null
          qty?: number | null
          item_class?: string | null
          id?: string
          report_id?: string
          seq?: number
          kind?: string
          name?: string
          amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "proc_urgent_items_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "proc_urgent_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      proc_urgent_reports: {
        Row: {
          register_note: string | null
          receipt_type: string | null
          id: string
          doc_no: string | null
          doc_type: string
          record_date: string
          purchase_date: string
          subject: string
          reason: string | null
          work_text: string
          amount: number
          payee: string | null
          receipt_book: string | null
          receipt_no: string | null
          receipt_date: string | null
          responsible_name: string | null
          responsible_position: string | null
          admin_group: string | null
          project_id: string | null
          activity_id: string | null
          approval_id: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          register_note?: string | null
          receipt_type?: string | null
          id?: string
          doc_no?: string | null
          doc_type?: string
          record_date: string
          purchase_date: string
          subject: string
          reason?: string | null
          work_text: string
          amount: number
          payee?: string | null
          receipt_book?: string | null
          receipt_no?: string | null
          receipt_date?: string | null
          responsible_name?: string | null
          responsible_position?: string | null
          admin_group?: string | null
          project_id?: string | null
          activity_id?: string | null
          approval_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          register_note?: string | null
          receipt_type?: string | null
          id?: string
          doc_no?: string | null
          doc_type?: string
          record_date?: string
          purchase_date?: string
          subject?: string
          reason?: string | null
          work_text?: string
          amount?: number
          payee?: string | null
          receipt_book?: string | null
          receipt_no?: string | null
          receipt_date?: string | null
          responsible_name?: string | null
          responsible_position?: string | null
          admin_group?: string | null
          project_id?: string | null
          activity_id?: string | null
          approval_id?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: []
      }
      proc_w119_reports: {
        Row: {
          register_note: string | null
          approval_id: string | null
          id: string
          doc_no: string
          record_date: string
          purchase_date: string
          admin_group: string | null
          project_id: string | null
          activity_id: string | null
          purpose: string | null
          expense_category: string
          table_ref: string | null
          responsible_name: string | null
          responsible_position: string | null
          payment_method: string
          fund_source: string | null
          amount: number
          created_by: string | null
          created_at: string
        }
        Insert: {
          register_note?: string | null
          approval_id?: string | null
          id?: string
          doc_no: string
          record_date: string
          purchase_date: string
          admin_group?: string | null
          project_id?: string | null
          activity_id?: string | null
          purpose?: string | null
          expense_category: string
          table_ref?: string | null
          responsible_name?: string | null
          responsible_position?: string | null
          payment_method?: string
          fund_source?: string | null
          amount?: number
          created_by?: string | null
          created_at?: string
        }
        Update: {
          register_note?: string | null
          approval_id?: string | null
          id?: string
          doc_no?: string
          record_date?: string
          purchase_date?: string
          admin_group?: string | null
          project_id?: string | null
          activity_id?: string | null
          purpose?: string | null
          expense_category?: string
          table_ref?: string | null
          responsible_name?: string | null
          responsible_position?: string | null
          payment_method?: string
          fund_source?: string | null
          amount?: number
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proc_w119_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "plan_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proc_w119_reports_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "plan_activities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      proc_set_acting_role: {
        Args: { new_role: string | null }
        Returns: undefined
      }
      proc_user_id_by_name: {
        Args: { full_name: string }
        Returns: string
      }
      fin_can_write: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      proc_approve_fund_loan: {
        Args: { p_id: string; p_approve: boolean }
        Returns: string | null
      }
      proc_approve_loan: {
        Args: { p_id: string; p_approve: boolean }
        Returns: string | null
      }
      proc_loan_pending: {
        Args: { borrower: string }
        Returns: string[]
      }
      proc_real_role: {
        Args: Record<PropertyKey, never>
        Returns: Database["public"]["Enums"]["proc_user_role"]
      }
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
      asset_is_audit_inspector: {
        Args: { p_round_id: string }
        Returns: boolean
      }
      asset_is_deputy_director: { Args: never; Returns: boolean }
      asset_is_director: { Args: never; Returns: boolean }
      asset_is_staff: { Args: never; Returns: boolean }
      eval_response_belongs_to_published_form: {
        Args: { p_response_id: string }
        Returns: boolean
      }
      proc_admin_approve_user: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      proc_admin_list_users: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          position: string
          role: Database["public"]["Enums"]["proc_user_role"]
          status: string
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
      asset_audit_status:
        | "draft"
        | "in_progress"
        | "submitted"
        | "acknowledged_deputy"
        | "acknowledged"
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
        | "deputy_director"
        | "planning_officer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      asset_audit_status: [
        "draft",
        "in_progress",
        "submitted",
        "acknowledged_deputy",
        "acknowledged",
      ],
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
        "deputy_director",
        "planning_officer",
      ],
    },
  },
} as const
