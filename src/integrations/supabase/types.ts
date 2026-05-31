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
      frequent_visitors: {
        Row: {
          auto_approve: boolean
          category: Database["public"]["Enums"]["frequent_category"]
          created_at: string
          house_id: string
          id: string
          mobile: string | null
          name: string
        }
        Insert: {
          auto_approve?: boolean
          category?: Database["public"]["Enums"]["frequent_category"]
          created_at?: string
          house_id: string
          id?: string
          mobile?: string | null
          name: string
        }
        Update: {
          auto_approve?: boolean
          category?: Database["public"]["Enums"]["frequent_category"]
          created_at?: string
          house_id?: string
          id?: string
          mobile?: string | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "frequent_visitors_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_passes: {
        Row: {
          created_at: string
          end_time: string
          guest_name: string
          house_id: string
          id: string
          mobile: string | null
          qr_token: string
          start_time: string
          used: boolean
          valid_date: string
        }
        Insert: {
          created_at?: string
          end_time: string
          guest_name: string
          house_id: string
          id?: string
          mobile?: string | null
          qr_token?: string
          start_time: string
          used?: boolean
          valid_date: string
        }
        Update: {
          created_at?: string
          end_time?: string
          guest_name?: string
          house_id?: string
          id?: string
          mobile?: string | null
          qr_token?: string
          start_time?: string
          used?: boolean
          valid_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "guest_passes_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      houses: {
        Row: {
          created_at: string
          house_number: string
          id: string
          mobile_number: string | null
          owner_name: string | null
        }
        Insert: {
          created_at?: string
          house_number: string
          id?: string
          mobile_number?: string | null
          owner_name?: string | null
        }
        Update: {
          created_at?: string
          house_number?: string
          id?: string
          mobile_number?: string | null
          owner_name?: string | null
        }
        Relationships: []
      }
      notices: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          changes: Json | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: Database["public"]["Enums"]["app_role"] | null
        }
        Insert: {
          action: string
          changes?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Update: {
          action?: string
          changes?: Json | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          disabled: boolean
          full_name: string | null
          house_id: string | null
          id: string
          last_login_at: string | null
          mobile: string | null
          must_change_password: boolean
          password_changed_at: string | null
        }
        Insert: {
          created_at?: string
          disabled?: boolean
          full_name?: string | null
          house_id?: string | null
          id: string
          last_login_at?: string | null
          mobile?: string | null
          must_change_password?: boolean
          password_changed_at?: string | null
        }
        Update: {
          created_at?: string
          disabled?: boolean
          full_name?: string | null
          house_id?: string | null
          id?: string
          last_login_at?: string | null
          mobile?: string | null
          must_change_password?: boolean
          password_changed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
      visitor_approvals: {
        Row: {
          approved_at: string
          approved_by: string
          created_at: string
          house_id: string
          id: string
          reason: string | null
          status: Database["public"]["Enums"]["visitor_status"]
          visitor_id: string
        }
        Insert: {
          approved_at?: string
          approved_by: string
          created_at?: string
          house_id: string
          id?: string
          reason?: string | null
          status: Database["public"]["Enums"]["visitor_status"]
          visitor_id: string
        }
        Update: {
          approved_at?: string
          approved_by?: string
          created_at?: string
          house_id?: string
          id?: string
          reason?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitor_approvals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_approvals_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitor_approvals_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "visitors"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visitors: {
        Row: {
          created_at: string
          entered_at: string | null
          exited_at: string | null
          expected_duration: string | null
          full_name: string
          guest_pass_id: string | null
          house_id: string
          id: string
          mobile: string
          photo_url: string | null
          purpose: string | null
          status: Database["public"]["Enums"]["visitor_status"]
          vehicle_number: string | null
          visitor_count: number
        }
        Insert: {
          created_at?: string
          entered_at?: string | null
          exited_at?: string | null
          expected_duration?: string | null
          full_name: string
          guest_pass_id?: string | null
          house_id: string
          id?: string
          mobile: string
          photo_url?: string | null
          purpose?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          vehicle_number?: string | null
          visitor_count?: number
        }
        Update: {
          created_at?: string
          entered_at?: string | null
          exited_at?: string | null
          expected_duration?: string | null
          full_name?: string
          guest_pass_id?: string | null
          house_id?: string
          id?: string
          mobile?: string
          photo_url?: string | null
          purpose?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          vehicle_number?: string | null
          visitor_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "visitors_house_id_fkey"
            columns: ["house_id"]
            isOneToOne: false
            referencedRelation: "houses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_house_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_audit: {
        Args: {
          p_action: string
          p_resource_type: string
          p_resource_id?: string | null
          p_changes?: Json | null
          p_metadata?: Json | null
        }
        Returns: string
      }
      update_password_changed_at: {
        Args: never
        Returns: void
      }
    }
    Enums: {
      app_role: "admin" | "guard" | "resident"
      frequent_category:
        | "maid"
        | "driver"
        | "cook"
        | "tutor"
        | "family"
        | "other"
      visitor_status:
        | "pending"
        | "approved"
        | "rejected"
        | "wait_at_gate"
        | "entered"
        | "exited"
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
      app_role: ["admin", "guard", "resident"],
      frequent_category: ["maid", "driver", "cook", "tutor", "family", "other"],
      visitor_status: [
        "pending",
        "approved",
        "rejected",
        "wait_at_gate",
        "entered",
        "exited",
      ],
    },
  },
} as const
