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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      activity_notes: {
        Row: {
          area_id: string
          content: string
          created_at: string
          date: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area_id: string
          content: string
          created_at?: string
          date: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area_id?: string
          content?: string
          created_at?: string
          date?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_notes_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      area_monthly_days: {
        Row: {
          area_id: string
          created_at: string
          day_of_month: number
          id: string
          user_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          day_of_month: number
          id?: string
          user_id: string
        }
        Update: {
          area_id?: string
          created_at?: string
          day_of_month?: number
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_monthly_days_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      area_scheduled_days: {
        Row: {
          area_id: string
          created_at: string
          day_of_week: number
          id: string
          user_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          day_of_week: number
          id?: string
          user_id: string
        }
        Update: {
          area_id?: string
          created_at?: string
          day_of_week?: number
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "area_scheduled_days_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          archived_at: string | null
          baseline_initial: number | null
          biweekly_start_date: string | null
          created_at: string
          data_retained: boolean
          frequency_per_week: number
          google_tasks_sync: boolean
          id: string
          name: string
          recurrence_type: string
          show_quick_add_home: boolean
          tracking_mode: string
          type: Database["public"]["Enums"]["area_type"]
          unit_label: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          baseline_initial?: number | null
          biweekly_start_date?: string | null
          created_at?: string
          data_retained?: boolean
          frequency_per_week: number
          google_tasks_sync?: boolean
          id?: string
          name: string
          recurrence_type?: string
          show_quick_add_home?: boolean
          tracking_mode?: string
          type: Database["public"]["Enums"]["area_type"]
          unit_label?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          baseline_initial?: number | null
          biweekly_start_date?: string | null
          created_at?: string
          data_retained?: boolean
          frequency_per_week?: number
          google_tasks_sync?: boolean
          id?: string
          name?: string
          recurrence_type?: string
          show_quick_add_home?: boolean
          tracking_mode?: string
          type?: Database["public"]["Enums"]["area_type"]
          unit_label?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      checkins: {
        Row: {
          area_id: string
          completed: boolean
          created_at: string
          date: string
          id: string
          user_id: string
        }
        Insert: {
          area_id: string
          completed?: boolean
          created_at?: string
          date: string
          id?: string
          user_id: string
        }
        Update: {
          area_id?: string
          completed?: boolean
          created_at?: string
          date?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_meal_items: {
        Row: {
          active: boolean
          id: string
          max_per_week: number | null
          meal_id: string
          name: string
          order: number
        }
        Insert: {
          active?: boolean
          id?: string
          max_per_week?: number | null
          meal_id: string
          name: string
          order?: number
        }
        Update: {
          active?: boolean
          id?: string
          max_per_week?: number | null
          meal_id?: string
          name?: string
          order?: number
        }
        Relationships: [
          {
            foreignKeyName: "diet_meal_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "diet_program_meals"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_program_meals: {
        Row: {
          active: boolean
          id: string
          meal_type: string
          order: number
          program_id: string
        }
        Insert: {
          active?: boolean
          id?: string
          meal_type: string
          order?: number
          program_id: string
        }
        Update: {
          active?: boolean
          id?: string
          meal_type?: string
          order?: number
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_program_meals_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "diet_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_programs: {
        Row: {
          area_id: string
          created_at: string
          free_meals_per_week: number
          id: string
          mode: string
          name: string
          user_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          free_meals_per_week?: number
          id?: string
          mode?: string
          name?: string
          user_id: string
        }
        Update: {
          area_id?: string
          created_at?: string
          free_meals_per_week?: number
          id?: string
          mode?: string
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_programs_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_session_items: {
        Row: {
          consumed: boolean
          id: string
          meal_item_id: string
          session_meal_id: string
        }
        Insert: {
          consumed?: boolean
          id?: string
          meal_item_id: string
          session_meal_id: string
        }
        Update: {
          consumed?: boolean
          id?: string
          meal_item_id?: string
          session_meal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_session_items_meal_item_id_fkey"
            columns: ["meal_item_id"]
            isOneToOne: false
            referencedRelation: "diet_meal_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diet_session_items_session_meal_id_fkey"
            columns: ["session_meal_id"]
            isOneToOne: false
            referencedRelation: "diet_session_meals"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_session_meals: {
        Row: {
          completed: boolean
          id: string
          is_free: boolean
          program_meal_id: string
          session_id: string
        }
        Insert: {
          completed?: boolean
          id?: string
          is_free?: boolean
          program_meal_id: string
          session_id: string
        }
        Update: {
          completed?: boolean
          id?: string
          is_free?: boolean
          program_meal_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_session_meals_program_meal_id_fkey"
            columns: ["program_meal_id"]
            isOneToOne: false
            referencedRelation: "diet_program_meals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diet_session_meals_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "diet_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      diet_sessions: {
        Row: {
          area_id: string
          created_at: string
          date: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          area_id?: string
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diet_sessions_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      google_oauth_tokens: {
        Row: {
          access_token: string
          access_token_expires_at: string
          connected_at: string
          created_at: string
          google_email: string
          id: string
          refresh_token: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          access_token_expires_at: string
          connected_at?: string
          created_at?: string
          google_email: string
          id?: string
          refresh_token: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          access_token_expires_at?: string
          connected_at?: string
          created_at?: string
          google_email?: string
          id?: string
          refresh_token?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      gym_muscle_groups: {
        Row: {
          created_at: string
          day_id: string
          id: string
          name: string
          order: number
        }
        Insert: {
          created_at?: string
          day_id: string
          id?: string
          name: string
          order?: number
        }
        Update: {
          created_at?: string
          day_id?: string
          id?: string
          name?: string
          order?: number
        }
        Relationships: [
          {
            foreignKeyName: "gym_muscle_groups_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "gym_program_days"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_program_days: {
        Row: {
          created_at: string
          day_of_week: number | null
          id: string
          name: string
          order: number
          program_id: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          id?: string
          name: string
          order?: number
          program_id: string
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          id?: string
          name?: string
          order?: number
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_program_days_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "gym_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_program_exercises: {
        Row: {
          active: boolean
          created_at: string
          default_weight: number | null
          duration_minutes: number | null
          exercise_type: string
          group_id: string
          id: string
          intensity: number | null
          is_daily: boolean
          name: string
          order: number
          reps: number
          sets: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_weight?: number | null
          duration_minutes?: number | null
          exercise_type?: string
          group_id: string
          id?: string
          intensity?: number | null
          is_daily?: boolean
          name: string
          order?: number
          reps: number
          sets: number
        }
        Update: {
          active?: boolean
          created_at?: string
          default_weight?: number | null
          duration_minutes?: number | null
          exercise_type?: string
          group_id?: string
          id?: string
          intensity?: number | null
          is_daily?: boolean
          name?: string
          order?: number
          reps?: number
          sets?: number
        }
        Relationships: [
          {
            foreignKeyName: "gym_program_exercises_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "gym_muscle_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_programs: {
        Row: {
          area_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_programs_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: true
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_session_exercises: {
        Row: {
          completed: boolean
          created_at: string
          duration_used: number | null
          exercise_id: string
          id: string
          intensity_used: number | null
          session_id: string
          weight_used: number | null
        }
        Insert: {
          completed?: boolean
          created_at?: string
          duration_used?: number | null
          exercise_id: string
          id?: string
          intensity_used?: number | null
          session_id: string
          weight_used?: number | null
        }
        Update: {
          completed?: boolean
          created_at?: string
          duration_used?: number | null
          exercise_id?: string
          id?: string
          intensity_used?: number | null
          session_id?: string
          weight_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "gym_session_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "gym_program_exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_session_exercises_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "gym_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      gym_sessions: {
        Row: {
          area_id: string
          created_at: string
          date: string
          day_id: string
          id: string
          user_id: string
        }
        Insert: {
          area_id: string
          created_at?: string
          date: string
          day_id: string
          id?: string
          user_id: string
        }
        Update: {
          area_id?: string
          created_at?: string
          date?: string
          day_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gym_sessions_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gym_sessions_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "gym_program_days"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_quantity_daily: {
        Row: {
          area_id: string
          created_at: string
          date: string
          id: string
          quantity: number
          source: string
          updated_at: string
        }
        Insert: {
          area_id: string
          created_at?: string
          date: string
          id?: string
          quantity?: number
          source?: string
          updated_at?: string
        }
        Update: {
          area_id?: string
          created_at?: string
          date?: string
          id?: string
          quantity?: number
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_quantity_daily_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      score_daily: {
        Row: {
          area_id: string
          consecutive_missed: number
          created_at: string
          cumulative_score: number
          daily_score: number
          date: string
          id: string
          trajectory_state: number
        }
        Insert: {
          area_id: string
          consecutive_missed?: number
          created_at?: string
          cumulative_score?: number
          daily_score?: number
          date: string
          id?: string
          trajectory_state?: number
        }
        Update: {
          area_id?: string
          consecutive_missed?: number
          created_at?: string
          cumulative_score?: number
          daily_score?: number
          date?: string
          id?: string
          trajectory_state?: number
        }
        Relationships: [
          {
            foreignKeyName: "score_daily_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_cards: {
        Row: {
          area_id: string | null
          card_type: string
          created_at: string
          enabled: boolean
          id: string
          user_id: string
        }
        Insert: {
          area_id?: string | null
          card_type: string
          created_at?: string
          enabled?: boolean
          id?: string
          user_id: string
        }
        Update: {
          area_id?: string | null
          card_type?: string
          created_at?: string
          enabled?: boolean
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cards_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          id: string
          language: string
          menu_custom_items: string[]
          plus_activated_at: string | null
          plus_active: boolean
          plus_expires_at: string | null
          plus_provider: string | null
          settings_notifications: boolean
          settings_score_visible: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          language?: string
          menu_custom_items?: string[]
          plus_activated_at?: string | null
          plus_active?: boolean
          plus_expires_at?: string | null
          plus_provider?: string | null
          settings_notifications?: boolean
          settings_score_visible?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          language?: string
          menu_custom_items?: string[]
          plus_activated_at?: string | null
          plus_active?: boolean
          plus_expires_at?: string | null
          plus_provider?: string | null
          settings_notifications?: boolean
          settings_score_visible?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      area_type: "health" | "study" | "reduce" | "finance" | "career"
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
      area_type: ["health", "study", "reduce", "finance", "career"],
    },
  },
} as const
