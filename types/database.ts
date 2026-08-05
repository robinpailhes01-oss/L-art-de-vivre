// Types du schéma Supabase — tenus à la main, alignés sur
// supabase/migrations/0001_init.sql. À régénérer via
// `supabase gen types typescript` une fois le projet lié si besoin.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "quote_sent"
  | "followed_up"
  | "booked"
  | "lost"

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      leads: {
        Row: {
          id: string
          first_name: string | null
          phone: string | null
          source_channel: string | null
          status: LeadStatus
          score: number | null
          service_type: string | null
          service_detail: string | null
          occasion: string | null
          party_size: number | null
          desired_date: string | null
          desired_date_end: string | null
          desired_time_slot: string | null
          budget_range: string | null
          location: string | null
          ai_memo: string | null
          needs_human_intervention: boolean
          followup_count: number
          last_followup_at: string | null
          last_interaction_at: string | null
          archived: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          first_name?: string | null
          phone?: string | null
          source_channel?: string | null
          status?: LeadStatus
          score?: number | null
          service_type?: string | null
          service_detail?: string | null
          occasion?: string | null
          party_size?: number | null
          desired_date?: string | null
          desired_date_end?: string | null
          desired_time_slot?: string | null
          budget_range?: string | null
          location?: string | null
          ai_memo?: string | null
          needs_human_intervention?: boolean
          followup_count?: number
          last_followup_at?: string | null
          last_interaction_at?: string | null
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          first_name?: string | null
          phone?: string | null
          source_channel?: string | null
          status?: LeadStatus
          score?: number | null
          service_type?: string | null
          service_detail?: string | null
          occasion?: string | null
          party_size?: number | null
          desired_date?: string | null
          desired_date_end?: string | null
          desired_time_slot?: string | null
          budget_range?: string | null
          location?: string | null
          ai_memo?: string | null
          needs_human_intervention?: boolean
          followup_count?: number
          last_followup_at?: string | null
          last_interaction_at?: string | null
          archived?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          lead_id: string | null
          channel: string
          messages: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lead_id?: string | null
          channel?: string
          messages?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lead_id?: string | null
          channel?: string
          messages?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      wa_conversations: {
        Row: {
          id: string
          customer_phone: string
          customer_name: string | null
          lead_id: string | null
          is_paused: boolean
          paused_until: string | null
          unread_count: number
          last_message_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          customer_phone: string
          customer_name?: string | null
          lead_id?: string | null
          is_paused?: boolean
          paused_until?: string | null
          unread_count?: number
          last_message_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          customer_phone?: string
          customer_name?: string | null
          lead_id?: string | null
          is_paused?: boolean
          paused_until?: string | null
          unread_count?: number
          last_message_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      wa_messages: {
        Row: {
          id: string
          conversation_id: string
          from_me: boolean
          is_from_human: boolean
          body: string | null
          wa_message_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          from_me?: boolean
          is_from_human?: boolean
          body?: string | null
          wa_message_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          from_me?: boolean
          is_from_human?: boolean
          body?: string | null
          wa_message_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      wa_inbox: {
        Row: {
          id: number
          wa_message_id: string
          phone: string
          text: string
          received_at: string
          processed_at: string | null
        }
        Insert: {
          id?: number
          wa_message_id: string
          phone: string
          text: string
          received_at?: string
          processed_at?: string | null
        }
        Update: {
          id?: number
          wa_message_id?: string
          phone?: string
          text?: string
          received_at?: string
          processed_at?: string | null
        }
        Relationships: []
      }
      wa_auth_state: {
        Row: {
          id: string
          data: Json | null
          updated_at: string
        }
        Insert: {
          id: string
          data?: Json | null
          updated_at?: string
        }
        Update: {
          id?: string
          data?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      agent_config: {
        Row: {
          id: string
          identity: Json
          services: Json
          faq: Json
          business_hours: Json
          auto_followup_enabled: boolean
          max_followups: number
          updated_at: string
        }
        Insert: {
          id?: string
          identity?: Json
          services?: Json
          faq?: Json
          business_hours?: Json
          auto_followup_enabled?: boolean
          max_followups?: number
          updated_at?: string
        }
        Update: {
          id?: string
          identity?: Json
          services?: Json
          faq?: Json
          business_hours?: Json
          auto_followup_enabled?: boolean
          max_followups?: number
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_events: {
        Row: {
          id: number
          occurred_at: string
          source: string
          model: string
          lead_id: string | null
          customer_phone: string | null
          input_tokens: number
          output_tokens: number
          cache_creation_input_tokens: number
          cache_read_input_tokens: number
          tool_turn: number | null
          request_id: string | null
        }
        Insert: {
          id?: number
          occurred_at?: string
          source: string
          model: string
          lead_id?: string | null
          customer_phone?: string | null
          input_tokens?: number
          output_tokens?: number
          cache_creation_input_tokens?: number
          cache_read_input_tokens?: number
          tool_turn?: number | null
          request_id?: string | null
        }
        Update: {
          id?: number
          occurred_at?: string
          source?: string
          model?: string
          lead_id?: string | null
          customer_phone?: string | null
          input_tokens?: number
          output_tokens?: number
          cache_creation_input_tokens?: number
          cache_read_input_tokens?: number
          tool_turn?: number | null
          request_id?: string | null
        }
        Relationships: []
      }
      model_pricing: {
        Row: {
          model: string
          effective_from: string
          input_usd_per_mtok: number
          output_usd_per_mtok: number
          cache_write_usd_per_mtok: number
          cache_read_usd_per_mtok: number
        }
        Insert: {
          model: string
          effective_from?: string
          input_usd_per_mtok: number
          output_usd_per_mtok: number
          cache_write_usd_per_mtok: number
          cache_read_usd_per_mtok: number
        }
        Update: {
          model?: string
          effective_from?: string
          input_usd_per_mtok?: number
          output_usd_per_mtok?: number
          cache_write_usd_per_mtok?: number
          cache_read_usd_per_mtok?: number
        }
        Relationships: []
      }
      billing_settings: {
        Row: {
          id: boolean
          margin_multiplier: number
          usd_eur_rate: number
          plan_type: string
          included_amount_eur: number | null
          overage_multiplier: number | null
          updated_at: string
        }
        Insert: {
          id?: boolean
          margin_multiplier?: number
          usd_eur_rate?: number
          plan_type?: string
          included_amount_eur?: number | null
          overage_multiplier?: number | null
          updated_at?: string
        }
        Update: {
          id?: boolean
          margin_multiplier?: number
          usd_eur_rate?: number
          plan_type?: string
          included_amount_eur?: number | null
          overage_multiplier?: number | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_ai_usage_daily: {
        Row: {
          day: string | null
          model: string | null
          calls: number | null
          input_tokens: number | null
          output_tokens: number | null
          cache_write_tokens: number | null
          cache_read_tokens: number | null
          cost_usd: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      lead_status: LeadStatus
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]

export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]

export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]

export type Views<T extends keyof DefaultSchema["Views"]> =
  DefaultSchema["Views"][T]["Row"]
