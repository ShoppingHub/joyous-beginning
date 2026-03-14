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
          created_at: string
          frequency_per_week: number
          id: string
          name: string
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
          created_at?: string
          frequency_per_week: number
          id?: string
          name: string
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
          created_at?: string
          frequency_per_week?: number
          id?: string
          name?: string
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
          id: string
          name: string
          order: number
          program_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order?: number
          program_id: string
        }
        Update: {
          created_at?: string
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
          group_id: string
          id: string
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
          group_id: string
          id?: string
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
          group_id?: string
          id?: string
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
          exercise_id: string
          id: string
          session_id: string
          weight_used: number | null
        }
        Insert: {
          completed?: boolean
          created_at?: string
          exercise_id: string
          id?: string
          session_id: string
          weight_used?: number | null
        }
        Update: {
          completed?: boolean
          created_at?: string
          exercise_id?: string
          id?: string
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
        }
        Insert: {
          area_id: string
          consecutive_missed?: number
          created_at?: string
          cumulative_score?: number
          daily_score?: number
          date: string
          id?: string
        }
        Update: {
          area_id?: string
          consecutive_missed?: number
          created_at?: string
          cumulative_score?: number
          daily_score?: number
          date?: string
          id?: string
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
      users: {
        Row: {
          created_at: string
          extra_tab_enabled: boolean
          id: string
          language: string
          menu_custom_items: string[]
          settings_notifications: boolean
          settings_score_visible: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          extra_tab_enabled?: boolean
          id?: string
          language?: string
          menu_custom_items?: string[]
          settings_notifications?: boolean
          settings_score_visible?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          extra_tab_enabled?: boolean
          id?: string
          language?: string
          menu_custom_items?: string[]
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
      area_type: "health" | "study" | "reduce" | "finance"
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
      area_type: ["health", "study", "reduce", "finance"],
    },
  },
} as const
