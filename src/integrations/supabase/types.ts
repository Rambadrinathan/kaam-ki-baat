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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string
        }
        Relationships: []
      }
      daily_scores: {
        Row: {
          ai_analysis: string | null
          auto_score: number | null
          created_at: string
          date: string
          final_score: number | null
          id: string
          summary_text: string | null
          task_assignment_id: string
          updated_at: string
          validated_by_user_id: string | null
          validation_timestamp: string | null
        }
        Insert: {
          ai_analysis?: string | null
          auto_score?: number | null
          created_at?: string
          date: string
          final_score?: number | null
          id?: string
          summary_text?: string | null
          task_assignment_id: string
          updated_at?: string
          validated_by_user_id?: string | null
          validation_timestamp?: string | null
        }
        Update: {
          ai_analysis?: string | null
          auto_score?: number | null
          created_at?: string
          date?: string
          final_score?: number | null
          id?: string
          summary_text?: string | null
          task_assignment_id?: string
          updated_at?: string
          validated_by_user_id?: string | null
          validation_timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_scores_task_assignment_id_fkey"
            columns: ["task_assignment_id"]
            isOneToOne: false
            referencedRelation: "task_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      earnings: {
        Row: {
          amount: number
          created_at: string
          daily_score_id: string | null
          date: string
          id: string
          score: number
          status: Database["public"]["Enums"]["earning_status"]
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          daily_score_id?: string | null
          date: string
          id?: string
          score: number
          status?: Database["public"]["Enums"]["earning_status"]
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          daily_score_id?: string | null
          date?: string
          id?: string
          score?: number
          status?: Database["public"]["Enums"]["earning_status"]
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "earnings_daily_score_id_fkey"
            columns: ["daily_score_id"]
            isOneToOne: false
            referencedRelation: "daily_scores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "earnings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      error_tracking: {
        Row: {
          created_at: string
          error_code: string | null
          error_type: string
          id: string
          message: string
          metadata: Json | null
          page_url: string | null
          resolved: boolean
          severity: string
          stack_trace: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_type: string
          id?: string
          message: string
          metadata?: Json | null
          page_url?: string | null
          resolved?: boolean
          severity?: string
          stack_trace?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_type?: string
          id?: string
          message?: string
          metadata?: Json | null
          page_url?: string | null
          resolved?: boolean
          severity?: string
          stack_trace?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          read: boolean | null
          related_task_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          read?: boolean | null
          related_task_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          read?: boolean | null
          related_task_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_task_id_fkey"
            columns: ["related_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_invitations: {
        Row: {
          created_at: string
          id: string
          invited_by_user_id: string | null
          name: string
          phone: string
          role: Database["public"]["Enums"]["team_membership_role"]
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by_user_id?: string | null
          name: string
          phone: string
          role?: Database["public"]["Enums"]["team_membership_role"]
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by_user_id?: string | null
          name?: string
          phone?: string
          role?: Database["public"]["Enums"]["team_membership_role"]
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          name: string
          phone: string | null
          preferred_language: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name: string
          phone?: string | null
          preferred_language?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
          preferred_language?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_assignments: {
        Row: {
          accepted_at: string | null
          assigned_to_user_id: string
          completed_at: string | null
          created_at: string
          id: string
          status: Database["public"]["Enums"]["task_assignment_status"]
          task_id: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_to_user_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["task_assignment_status"]
          task_id: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_to_user_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["task_assignment_status"]
          task_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assignments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          description_text: string | null
          estimated_slots: number
          id: string
          image_url: string | null
          scheduled_date: string
          status: Database["public"]["Enums"]["task_status"]
          team_id: string | null
          title: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at: string
          voice_note_url: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          description_text?: string | null
          estimated_slots?: number
          id?: string
          image_url?: string | null
          scheduled_date: string
          status?: Database["public"]["Enums"]["task_status"]
          team_id?: string | null
          title: string
          type: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          voice_note_url?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          description_text?: string | null
          estimated_slots?: number
          id?: string
          image_url?: string | null
          scheduled_date?: string
          status?: Database["public"]["Enums"]["task_status"]
          team_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["task_type"]
          updated_at?: string
          voice_note_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_memberships: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["team_membership_role"]
          status: Database["public"]["Enums"]["team_membership_status"]
          team_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["team_membership_role"]
          status?: Database["public"]["Enums"]["team_membership_status"]
          team_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["team_membership_role"]
          status?: Database["public"]["Enums"]["team_membership_status"]
          team_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_memberships_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          description: string | null
          full_score_value: number
          id: string
          invite_code: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          full_score_value?: number
          id?: string
          invite_code?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          description?: string | null
          full_score_value?: number
          id?: string
          invite_code?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_logs: {
        Row: {
          created_at: string
          created_by_user_id: string | null
          id: string
          image_url: string | null
          note_text: string | null
          task_assignment_id: string
          timestamp: string
          updated_at: string
          voice_note_url: string | null
        }
        Insert: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          image_url?: string | null
          note_text?: string | null
          task_assignment_id: string
          timestamp?: string
          updated_at?: string
          voice_note_url?: string | null
        }
        Update: {
          created_at?: string
          created_by_user_id?: string | null
          id?: string
          image_url?: string | null
          note_text?: string | null
          task_assignment_id?: string
          timestamp?: string
          updated_at?: string
          voice_note_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_logs_task_assignment_id_fkey"
            columns: ["task_assignment_id"]
            isOneToOne: false
            referencedRelation: "task_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_invite_code: { Args: never; Returns: string }
      get_user_team_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_team_captain: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      is_team_member: {
        Args: { _team_id: string; _user_id: string }
        Returns: boolean
      }
      log_activity: {
        Args: {
          _action: string
          _details?: Json
          _entity_id?: string
          _entity_type?: string
        }
        Returns: string
      }
      log_error: {
        Args: {
          _error_type: string
          _message: string
          _metadata?: Json
          _page_url?: string
          _severity?: string
          _stack_trace?: string
        }
        Returns: string
      }
    }
    Enums: {
      app_role: "admin" | "captain" | "worker"
      earning_status: "pending" | "calculated" | "exported"
      task_assignment_status:
        | "pending"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
      task_status:
        | "open"
        | "pending_approval"
        | "assigned"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "rejected"
      task_type: "captain_assigned" | "self_proposed"
      team_membership_role: "captain" | "vice_captain" | "member"
      team_membership_status: "active" | "inactive"
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
      app_role: ["admin", "captain", "worker"],
      earning_status: ["pending", "calculated", "exported"],
      task_assignment_status: [
        "pending",
        "accepted",
        "in_progress",
        "completed",
        "cancelled",
      ],
      task_status: [
        "open",
        "pending_approval",
        "assigned",
        "in_progress",
        "completed",
        "cancelled",
        "rejected",
      ],
      task_type: ["captain_assigned", "self_proposed"],
      team_membership_role: ["captain", "vice_captain", "member"],
      team_membership_status: ["active", "inactive"],
    },
  },
} as const
