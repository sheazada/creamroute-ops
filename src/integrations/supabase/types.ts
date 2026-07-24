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
      customers: {
        Row: {
          address: string | null
          created_at: string
          credit_limit: number
          email: string | null
          gstin: string | null
          id: string
          mobile: string | null
          name: string
          notes: string | null
          outstanding: number
          shop_name: string | null
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          credit_limit?: number
          email?: string | null
          gstin?: string | null
          id?: string
          mobile?: string | null
          name: string
          notes?: string | null
          outstanding?: number
          shop_name?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          credit_limit?: number
          email?: string | null
          gstin?: string | null
          id?: string
          mobile?: string | null
          name?: string
          notes?: string | null
          outstanding?: number
          shop_name?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          assigned_to: string | null
          collected_amount: number | null
          collected_mode: string | null
          created_at: string
          delivered_at: string | null
          id: string
          invoice_id: string | null
          notes: string | null
          order_id: string | null
          pod_photo_url: string | null
          pod_signature: string | null
          received_by: string | null
          route: string | null
          route_id: string | null
          scheduled_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          collected_amount?: number | null
          collected_mode?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_id?: string | null
          pod_photo_url?: string | null
          pod_signature?: string | null
          received_by?: string | null
          route?: string | null
          route_id?: string | null
          scheduled_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          collected_amount?: number | null
          collected_mode?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          invoice_id?: string | null
          notes?: string | null
          order_id?: string | null
          pod_photo_url?: string | null
          pod_signature?: string | null
          received_by?: string | null
          route?: string | null
          route_id?: string | null
          scheduled_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          note: string | null
          product_id: string
          quantity: number
          ref_id: string | null
          ref_type: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          note?: string | null
          product_id: string
          quantity: number
          ref_id?: string | null
          ref_type?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          note?: string | null
          product_id?: string
          quantity?: number
          ref_id?: string | null
          ref_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number
          discount: number
          gst_rate: number
          hsn: string | null
          id: string
          invoice_id: string
          product_id: string
          product_name: string
          quantity: number
          rate: number
          tax_amount: number
          taxable: number
        }
        Insert: {
          amount: number
          discount?: number
          gst_rate?: number
          hsn?: string | null
          id?: string
          invoice_id: string
          product_id: string
          product_name: string
          quantity: number
          rate: number
          tax_amount: number
          taxable: number
        }
        Update: {
          amount?: number
          discount?: number
          gst_rate?: number
          hsn?: string | null
          id?: string
          invoice_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          rate?: number
          tax_amount?: number
          taxable?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          balance: number
          cgst: number
          created_at: string
          customer_id: string
          discount: number
          due_date: string | null
          id: string
          igst: number
          invoice_date: string
          invoice_no: string
          notes: string | null
          order_id: string | null
          paid: number
          sgst: number
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          balance?: number
          cgst?: number
          created_at?: string
          customer_id: string
          discount?: number
          due_date?: string | null
          id?: string
          igst?: number
          invoice_date?: string
          invoice_no: string
          notes?: string | null
          order_id?: string | null
          paid?: number
          sgst?: number
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          cgst?: number
          created_at?: string
          customer_id?: string
          discount?: number
          due_date?: string | null
          id?: string
          igst?: number
          invoice_date?: string
          invoice_no?: string
          notes?: string | null
          order_id?: string | null
          paid?: number
          sgst?: number
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          amount: number
          id: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          rate: number
        }
        Insert: {
          amount: number
          id?: string
          order_id: string
          product_id: string
          product_name: string
          quantity: number
          rate: number
        }
        Update: {
          amount?: number
          id?: string
          order_id?: string
          product_id?: string
          product_name?: string
          quantity?: number
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          order_date: string
          order_no: string
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          order_date?: string
          order_no: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          order_date?: string
          order_no?: string
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          id: string
          invoice_id: string | null
          mode: string
          notes: string | null
          payment_date: string
          payment_no: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          id?: string
          invoice_id?: string | null
          mode?: string
          notes?: string | null
          payment_date?: string
          payment_no: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          id?: string
          invoice_id?: string | null
          mode?: string
          notes?: string | null
          payment_date?: string
          payment_no?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      product_batches: {
        Row: {
          batch_no: string | null
          created_at: string
          expiry_date: string | null
          id: string
          mfg_date: string | null
          product_id: string
          quantity: number
        }
        Insert: {
          batch_no?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          mfg_date?: string | null
          product_id: string
          quantity?: number
        }
        Update: {
          batch_no?: string | null
          created_at?: string
          expiry_date?: string | null
          id?: string
          mfg_date?: string | null
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand: string | null
          category: string | null
          created_at: string
          current_stock: number
          gst_rate: number
          hsn: string | null
          id: string
          image_url: string | null
          min_stock: number
          mrp: number
          name: string
          purchase_price: number
          selling_price: number
          status: string
          unit: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string
          current_stock?: number
          gst_rate?: number
          hsn?: string | null
          id?: string
          image_url?: string | null
          min_stock?: number
          mrp?: number
          name: string
          purchase_price?: number
          selling_price?: number
          status?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          category?: string | null
          created_at?: string
          current_stock?: number
          gst_rate?: number
          hsn?: string | null
          id?: string
          image_url?: string | null
          min_stock?: number
          mrp?: number
          name?: string
          purchase_price?: number
          selling_price?: number
          status?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_items: {
        Row: {
          amount: number
          gst_rate: number
          id: string
          product_id: string
          product_name: string
          purchase_id: string
          quantity: number
          rate: number
        }
        Insert: {
          amount: number
          gst_rate?: number
          id?: string
          product_id: string
          product_name: string
          purchase_id: string
          quantity: number
          rate: number
        }
        Update: {
          amount?: number
          gst_rate?: number
          id?: string
          product_id?: string
          product_name?: string
          purchase_id?: string
          quantity?: number
          rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          bill_no: string
          challan_url: string | null
          created_at: string
          gst: number
          id: string
          notes: string | null
          paid: number
          purchase_date: string
          status: string
          subtotal: number
          supplier_id: string
          total: number
          updated_at: string
        }
        Insert: {
          bill_no: string
          challan_url?: string | null
          created_at?: string
          gst?: number
          id?: string
          notes?: string | null
          paid?: number
          purchase_date?: string
          status?: string
          subtotal?: number
          supplier_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          bill_no?: string
          challan_url?: string | null
          created_at?: string
          gst?: number
          id?: string
          notes?: string | null
          paid?: number
          purchase_date?: string
          status?: string
          subtotal?: number
          supplier_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      route_stops: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          route_id: string
          sequence: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          route_id: string
          sequence?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          route_id?: string
          sequence?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          active: boolean
          area: string | null
          capacity_label: string | null
          capacity_units: number | null
          created_at: string
          driver_name: string | null
          helper_name: string | null
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          area?: string | null
          capacity_label?: string | null
          capacity_units?: number | null
          created_at?: string
          driver_name?: string | null
          helper_name?: string | null
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          area?: string | null
          capacity_label?: string | null
          capacity_units?: number | null
          created_at?: string
          driver_name?: string | null
          helper_name?: string | null
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      supplier_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          mode: string
          notes: string | null
          payment_date: string
          payment_no: string
          purchase_id: string | null
          reference: string | null
          supplier_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          mode?: string
          notes?: string | null
          payment_date?: string
          payment_no: string
          purchase_id?: string | null
          reference?: string | null
          supplier_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          mode?: string
          notes?: string | null
          payment_date?: string
          payment_no?: string
          purchase_id?: string | null
          reference?: string | null
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          company: string | null
          created_at: string
          gstin: string | null
          id: string
          mobile: string | null
          name: string
          outstanding: number
          status: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          company?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          mobile?: string | null
          name: string
          outstanding?: number
          status?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          company?: string | null
          created_at?: string
          gstin?: string | null
          id?: string
          mobile?: string | null
          name?: string
          outstanding?: number
          status?: string
          updated_at?: string
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
      recalc_customer_outstanding: {
        Args: { _customer_id: string }
        Returns: undefined
      }
      recalc_invoice: { Args: { _invoice_id: string }; Returns: undefined }
      recalc_purchase: { Args: { _purchase_id: string }; Returns: undefined }
      recalc_supplier_outstanding: {
        Args: { _supplier_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "salesperson" | "driver" | "helper"
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
      app_role: ["admin", "manager", "salesperson", "driver", "helper"],
    },
  },
} as const
