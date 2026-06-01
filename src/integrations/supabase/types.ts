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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      budgets: {
        Row: {
          category: string
          created_at: string
          id: string
          income_target: number | null
          month: number
          monthly_limit: number
          year: number
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          income_target?: number | null
          month?: number
          monthly_limit: number
          year?: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          income_target?: number | null
          month?: number
          monthly_limit?: number
          year?: number
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      category_rules: {
        Row: {
          category: string
          keyword: string
        }
        Insert: {
          category: string
          keyword: string
        }
        Update: {
          category?: string
          keyword?: string
        }
        Relationships: []
      }
      cravings: {
        Row: {
          created_at: string | null
          date: string
          id: string
          item: string
          notes: string | null
          satisfied: boolean | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          item: string
          notes?: string | null
          satisfied?: boolean | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          item?: string
          notes?: string | null
          satisfied?: boolean | null
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          id: string
          is_auto_generated: boolean
          is_self_transfer: boolean
          notes: string | null
          payment_method: string
          recurring_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          date?: string
          id?: string
          is_auto_generated?: boolean
          is_self_transfer?: boolean
          notes?: string | null
          payment_method: string
          recurring_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          id?: string
          is_auto_generated?: boolean
          is_self_transfer?: boolean
          notes?: string | null
          payment_method?: string
          recurring_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      food_warnings: {
        Row: {
          id: string
          keyword: string
          severity: string
          warning: string
        }
        Insert: {
          id?: string
          keyword: string
          severity: string
          warning: string
        }
        Update: {
          id?: string
          keyword?: string
          severity?: string
          warning?: string
        }
        Relationships: []
      }
      income: {
        Row: {
          amount: number
          created_at: string
          date: string
          id: string
          is_auto_generated: boolean
          is_self_transfer: boolean
          notes: string | null
          recurring_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          date?: string
          id?: string
          is_auto_generated?: boolean
          is_self_transfer?: boolean
          notes?: string | null
          recurring_id?: string | null
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          date?: string
          id?: string
          is_auto_generated?: boolean
          is_self_transfer?: boolean
          notes?: string | null
          recurring_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      loan_repayments: {
        Row: {
          amount_paid: number
          created_at: string
          created_by: string
          id: string
          loan_id: string
          notes: string | null
          payment_date: string
          remaining_balance: number
        }
        Insert: {
          amount_paid: number
          created_at?: string
          created_by: string
          id?: string
          loan_id: string
          notes?: string | null
          payment_date?: string
          remaining_balance: number
        }
        Update: {
          amount_paid?: number
          created_at?: string
          created_by?: string
          id?: string
          loan_id?: string
          notes?: string | null
          payment_date?: string
          remaining_balance?: number
        }
        Relationships: [
          {
            foreignKeyName: "loan_repayments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          created_at: string
          created_by: string
          end_date: string | null
          id: string
          interest_rate: number | null
          lender_or_borrower_name: string
          loan_type: string
          principal_amount: number
          remaining_balance: number
          repayment_frequency: string
          start_date: string
          status: string
          total_amount_due: number
        }
        Insert: {
          created_at?: string
          created_by: string
          end_date?: string | null
          id?: string
          interest_rate?: number | null
          lender_or_borrower_name: string
          loan_type: string
          principal_amount: number
          remaining_balance: number
          repayment_frequency?: string
          start_date: string
          status?: string
          total_amount_due: number
        }
        Update: {
          created_at?: string
          created_by?: string
          end_date?: string | null
          id?: string
          interest_rate?: number | null
          lender_or_borrower_name?: string
          loan_type?: string
          principal_amount?: number
          remaining_balance?: number
          repayment_frequency?: string
          start_date?: string
          status?: string
          total_amount_due?: number
        }
        Relationships: []
      }
      market_prices: {
        Row: {
          category: string | null
          created_by: string | null
          id: string
          name: string
          name_amharic: string | null
          price: number
          source: string | null
          unit: string
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          created_by?: string | null
          id?: string
          name: string
          name_amharic?: string | null
          price: number
          source?: string | null
          unit?: string
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          created_by?: string | null
          id?: string
          name?: string
          name_amharic?: string | null
          price?: number
          source?: string | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      meal_ingredients: {
        Row: {
          created_at: string | null
          estimated_cost: number | null
          id: string
          meal_id: string
          name: string
          quantity: number | null
          unit: string | null
        }
        Insert: {
          created_at?: string | null
          estimated_cost?: number | null
          id?: string
          meal_id: string
          name: string
          quantity?: number | null
          unit?: string | null
        }
        Update: {
          created_at?: string | null
          estimated_cost?: number | null
          id?: string
          meal_id?: string
          name?: string
          quantity?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_ingredients_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_nutrition: {
        Row: {
          id: string
          meal_id: string
          nutrient: string
        }
        Insert: {
          id?: string
          meal_id: string
          nutrient: string
        }
        Update: {
          id?: string
          meal_id?: string
          nutrient?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_nutrition_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          created_at: string | null
          created_by: string
          id: string
          notes: string | null
          week_start: string
        }
        Insert: {
          created_at?: string | null
          created_by: string
          id?: string
          notes?: string | null
          week_start: string
        }
        Update: {
          created_at?: string | null
          created_by?: string
          id?: string
          notes?: string | null
          week_start?: string
        }
        Relationships: []
      }
      meals: {
        Row: {
          batch_days: number | null
          created_at: string | null
          day_of_week: number
          estimated_cost: number | null
          id: string
          is_batch: boolean | null
          meal_type: string
          name: string
          notes: string | null
          plan_id: string
        }
        Insert: {
          batch_days?: number | null
          created_at?: string | null
          day_of_week: number
          estimated_cost?: number | null
          id?: string
          is_batch?: boolean | null
          meal_type: string
          name: string
          notes?: string | null
          plan_id: string
        }
        Update: {
          batch_days?: number | null
          created_at?: string | null
          day_of_week?: number
          estimated_cost?: number | null
          id?: string
          is_batch?: boolean | null
          meal_type?: string
          name?: string
          notes?: string | null
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "meals_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "meal_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pregnancy_profile: {
        Row: {
          created_at: string | null
          due_date: string
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          due_date: string
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          due_date?: string
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          amount: number
          auto_post: boolean
          category: string
          created_at: string
          created_by: string
          end_date: string | null
          frequency: string
          id: string
          is_active: boolean
          last_generated_date: string | null
          start_date: string
          title: string
        }
        Insert: {
          amount: number
          auto_post?: boolean
          category: string
          created_at?: string
          created_by: string
          end_date?: string | null
          frequency: string
          id?: string
          is_active?: boolean
          last_generated_date?: string | null
          start_date: string
          title: string
        }
        Update: {
          amount?: number
          auto_post?: boolean
          category?: string
          created_at?: string
          created_by?: string
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_generated_date?: string | null
          start_date?: string
          title?: string
        }
        Relationships: []
      }
      recurring_income: {
        Row: {
          amount: number
          auto_post: boolean
          created_at: string
          created_by: string
          end_date: string | null
          frequency: string
          id: string
          is_active: boolean
          last_generated_date: string | null
          start_date: string
          title: string
        }
        Insert: {
          amount: number
          auto_post?: boolean
          created_at?: string
          created_by: string
          end_date?: string | null
          frequency: string
          id?: string
          is_active?: boolean
          last_generated_date?: string | null
          start_date: string
          title: string
        }
        Update: {
          amount?: number
          auto_post?: boolean
          created_at?: string
          created_by?: string
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_generated_date?: string | null
          start_date?: string
          title?: string
        }
        Relationships: []
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
      water_intake: {
        Row: {
          date: string
          glasses: number
          goal: number
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          date?: string
          glasses?: number
          goal?: number
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          date?: string
          glasses?: number
          goal?: number
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "member"
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
      app_role: ["admin", "member"],
    },
  },
} as const
