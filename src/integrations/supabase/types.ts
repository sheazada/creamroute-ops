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
      crate_transactions: {
        Row: {
          crate_type_id: string
          created_at: string
          created_by: string | null
          delivery_id: string | null
          id: string
          notes: string | null
          quantity: number
          retailer_id: string
          route_id: string | null
          transaction_date: string
          transaction_type: string
        }
        Insert: {
          crate_type_id: string
          created_at?: string
          created_by?: string | null
          delivery_id?: string | null
          id?: string
          notes?: string | null
          quantity: number
          retailer_id: string
          route_id?: string | null
          transaction_date?: string
          transaction_type: string
        }
        Update: {
          crate_type_id?: string
          created_at?: string
          created_by?: string | null
          delivery_id?: string | null
          id?: string
          notes?: string | null
          quantity?: number
          retailer_id?: string
          route_id?: string | null
          transaction_date?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crate_transactions_crate_type_id_fkey"
            columns: ["crate_type_id"]
            isOneToOne: false
            referencedRelation: "crate_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crate_transactions_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crate_transactions_retailer_id_fkey"
            columns: ["retailer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crate_transactions_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      crate_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          credit_limit: number
          email: string | null
          gstin: string | null
          id: string
          latitude: number | null
          longitude: number | null
          mobile: string | null
          name: string
          notes: string | null
          notify_email: boolean
          notify_sms: boolean
          notify_whatsapp: boolean
          outstanding: number
          shop_name: string | null
          status: string
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          credit_limit?: number
          email?: string | null
          gstin?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          mobile?: string | null
          name: string
          notes?: string | null
          notify_email?: boolean
          notify_sms?: boolean
          notify_whatsapp?: boolean
          outstanding?: number
          shop_name?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          credit_limit?: number
          email?: string | null
          gstin?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          mobile?: string | null
          name?: string
          notes?: string | null
          notify_email?: boolean
          notify_sms?: boolean
          notify_whatsapp?: boolean
          outstanding?: number
          shop_name?: string | null
          status?: string
          updated_at?: string
          whatsapp?: string | null
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
          pod_accuracy_m: number | null
          pod_captured_at: string | null
          pod_latitude: number | null
          pod_longitude: number | null
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
          pod_accuracy_m?: number | null
          pod_captured_at?: string | null
          pod_latitude?: number | null
          pod_longitude?: number | null
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
          pod_accuracy_m?: number | null
          pod_captured_at?: string | null
          pod_latitude?: number | null
          pod_longitude?: number | null
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
      delivery_runs: {
        Row: {
          created_at: string
          delivery_status: string
          driver_name: string | null
          end_accuracy_m: number | null
          end_latitude: number | null
          end_longitude: number | null
          ended_at: string | null
          helper_name: string | null
          id: string
          notes: string | null
          odometer_end: number | null
          odometer_start: number | null
          pickup_confirmed_at: string | null
          route_id: string
          run_date: string
          start_accuracy_m: number | null
          start_latitude: number | null
          start_longitude: number | null
          started_at: string | null
          status: string
          updated_at: string
          vehicle_number: string | null
          vehicle_type: string | null
        }
        Insert: {
          created_at?: string
          delivery_status?: string
          driver_name?: string | null
          end_accuracy_m?: number | null
          end_latitude?: number | null
          end_longitude?: number | null
          ended_at?: string | null
          helper_name?: string | null
          id?: string
          notes?: string | null
          odometer_end?: number | null
          odometer_start?: number | null
          pickup_confirmed_at?: string | null
          route_id: string
          run_date?: string
          start_accuracy_m?: number | null
          start_latitude?: number | null
          start_longitude?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Update: {
          created_at?: string
          delivery_status?: string
          driver_name?: string | null
          end_accuracy_m?: number | null
          end_latitude?: number | null
          end_longitude?: number | null
          ended_at?: string | null
          helper_name?: string | null
          id?: string
          notes?: string | null
          odometer_end?: number | null
          odometer_start?: number | null
          pickup_confirmed_at?: string | null
          route_id?: string
          run_date?: string
          start_accuracy_m?: number | null
          start_latitude?: number | null
          start_longitude?: number | null
          started_at?: string | null
          status?: string
          updated_at?: string
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_runs_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      edit_audit_logs: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          delivery_id: string | null
          field: string | null
          id: string
          new_value: string | null
          old_value: string | null
          record_id: string
          record_type: string
          route_id: string | null
          run_id: string | null
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          delivery_id?: string | null
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          record_id: string
          record_type: string
          route_id?: string | null
          run_id?: string | null
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          delivery_id?: string | null
          field?: string | null
          id?: string
          new_value?: string | null
          old_value?: string | null
          record_id?: string
          record_type?: string
          route_id?: string | null
          run_id?: string | null
        }
        Relationships: []
      }
      gps_audit_logs: {
        Row: {
          accuracy: number | null
          created_at: string
          customer_id: string | null
          delivery_id: string | null
          error_code: string | null
          error_message: string | null
          event_type: string
          id: string
          invoice_id: string | null
          latitude: number | null
          longitude: number | null
          metadata: Json | null
          route_id: string | null
          run_id: string | null
          success: boolean
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          customer_id?: string | null
          delivery_id?: string | null
          error_code?: string | null
          error_message?: string | null
          event_type: string
          id?: string
          invoice_id?: string | null
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          route_id?: string | null
          run_id?: string | null
          success: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          customer_id?: string | null
          delivery_id?: string | null
          error_code?: string | null
          error_message?: string | null
          event_type?: string
          id?: string
          invoice_id?: string | null
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          route_id?: string | null
          run_id?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "gps_audit_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_audit_logs_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_audit_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_audit_logs_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gps_audit_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "delivery_runs"
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
          delivered_quantity: number | null
          discount: number
          gst_rate: number
          hsn: string | null
          id: string
          invoice_id: string
          ordered_quantity: number | null
          product_id: string
          product_name: string
          quantity: number
          rate: number
          tax_amount: number
          taxable: number
        }
        Insert: {
          amount: number
          delivered_quantity?: number | null
          discount?: number
          gst_rate?: number
          hsn?: string | null
          id?: string
          invoice_id: string
          ordered_quantity?: number | null
          product_id: string
          product_name: string
          quantity: number
          rate: number
          tax_amount: number
          taxable: number
        }
        Update: {
          amount?: number
          delivered_quantity?: number | null
          discount?: number
          gst_rate?: number
          hsn?: string | null
          id?: string
          invoice_id?: string
          ordered_quantity?: number | null
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
      notification_logs: {
        Row: {
          attempts: number
          body: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          customer_id: string | null
          delivery_id: string | null
          id: string
          idempotency_key: string | null
          invoice_id: string | null
          last_attempt_at: string | null
          last_error: string | null
          max_attempts: number
          next_retry_at: string | null
          provider: string | null
          provider_message_id: string | null
          recipient: string
          recipient_name: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          subject: string | null
          template: string | null
          template_data: Json
          triggered_by: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          body?: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          customer_id?: string | null
          delivery_id?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          provider?: string | null
          provider_message_id?: string | null
          recipient: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string | null
          template?: string | null
          template_data?: Json
          triggered_by?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          body?: string | null
          channel?: Database["public"]["Enums"]["notification_channel"]
          created_at?: string
          customer_id?: string | null
          delivery_id?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_id?: string | null
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          provider?: string | null
          provider_message_id?: string | null
          recipient?: string
          recipient_name?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          subject?: string | null
          template?: string | null
          template_data?: Json
          triggered_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
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
          available_qty: number | null
          batch_no: string | null
          cost_price: number | null
          created_at: string
          damaged_qty: number | null
          expiry_date: string | null
          id: string
          mfg_date: string | null
          product_id: string
          quantity: number
          reserved_qty: number | null
          status: string | null
          supplier_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          available_qty?: number | null
          batch_no?: string | null
          cost_price?: number | null
          created_at?: string
          damaged_qty?: number | null
          expiry_date?: string | null
          id?: string
          mfg_date?: string | null
          product_id: string
          quantity?: number
          reserved_qty?: number | null
          status?: string | null
          supplier_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          available_qty?: number | null
          batch_no?: string | null
          cost_price?: number | null
          created_at?: string
          damaged_qty?: number | null
          expiry_date?: string | null
          id?: string
          mfg_date?: string | null
          product_id?: string
          quantity?: number
          reserved_qty?: number | null
          status?: string | null
          supplier_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_batches_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
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
          max_stops: number | null
          name: string
          notes: string | null
          start_latitude: number | null
          start_longitude: number | null
          updated_at: string
          vehicle_number: string | null
          vehicle_type: string | null
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
          max_stops?: number | null
          name: string
          notes?: string | null
          start_latitude?: number | null
          start_longitude?: number | null
          updated_at?: string
          vehicle_number?: string | null
          vehicle_type?: string | null
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
          max_stops?: number | null
          name?: string
          notes?: string | null
          start_latitude?: number | null
          start_longitude?: number | null
          updated_at?: string
          vehicle_number?: string | null
          vehicle_type?: string | null
        }
        Relationships: []
      }
      share_activity_logs: {
        Row: {
          channel: string
          created_at: string
          customer_id: string | null
          id: string
          invoice_id: string | null
          invoice_no: string | null
          recipient: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          invoice_no?: string | null
          recipient?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          invoice_no?: string | null
          recipient?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "share_activity_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "share_activity_logs_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustment_items: {
        Row: {
          adjustment_id: string
          batch_id: string | null
          created_at: string | null
          diff_qty: number
          id: string
          physical_qty: number
          product_id: string
          reason_detail: string | null
          system_qty: number
          unit_cost: number | null
        }
        Insert: {
          adjustment_id: string
          batch_id?: string | null
          created_at?: string | null
          diff_qty?: number
          id?: string
          physical_qty?: number
          product_id: string
          reason_detail?: string | null
          system_qty?: number
          unit_cost?: number | null
        }
        Update: {
          adjustment_id?: string
          batch_id?: string | null
          created_at?: string | null
          diff_qty?: number
          id?: string
          physical_qty?: number
          product_id?: string
          reason_detail?: string | null
          system_qty?: number
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustment_items_adjustment_id_fkey"
            columns: ["adjustment_id"]
            isOneToOne: false
            referencedRelation: "stock_adjustments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_adjustment_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_adjustments: {
        Row: {
          adjustment_date: string
          adjustment_no: string
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          notes: string | null
          reason: string | null
          requested_by: string | null
          status: string
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          adjustment_date?: string
          adjustment_no: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          adjustment_date?: string
          adjustment_no?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          reason?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_adjustments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reconciliation_items: {
        Row: {
          batch_id: string | null
          created_at: string | null
          diff_qty: number
          id: string
          physical_qty: number
          product_id: string
          recon_id: string
          system_qty: number
          variance_reason: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string | null
          diff_qty?: number
          id?: string
          physical_qty?: number
          product_id: string
          recon_id: string
          system_qty?: number
          variance_reason?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string | null
          diff_qty?: number
          id?: string
          physical_qty?: number
          product_id?: string
          recon_id?: string
          system_qty?: number
          variance_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_reconciliation_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "product_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reconciliation_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_reconciliation_items_recon_id_fkey"
            columns: ["recon_id"]
            isOneToOne: false
            referencedRelation: "stock_reconciliations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_reconciliations: {
        Row: {
          completed_at: string | null
          conducted_by: string | null
          created_at: string | null
          id: string
          notes: string | null
          recon_date: string
          recon_no: string
          status: string
          warehouse_id: string | null
        }
        Insert: {
          completed_at?: string | null
          conducted_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          recon_date?: string
          recon_no: string
          status?: string
          warehouse_id?: string | null
        }
        Update: {
          completed_at?: string | null
          conducted_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          recon_date?: string
          recon_no?: string
          status?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_reconciliations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
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
      warehouses: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          location: string | null
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_delivery_quantities: {
        Args: { _invoice_id: string; _items: Json }
        Returns: string
      }
      can_manage_finance: { Args: { _uid: string }; Returns: boolean }
      can_manage_sales: { Args: { _uid: string }; Returns: boolean }
      enqueue_delivery_notifications: {
        Args: { _delivery_id: string }
        Returns: number
      }
      enqueue_run_en_route_notifications: {
        Args: { _run_id: string }
        Returns: number
      }
      generate_adjustment_no: { Args: never; Returns: string }
      generate_recon_no: { Args: never; Returns: string }
      get_crate_balance_as_of: {
        Args: { p_as_of_date?: string; p_crate_type_id?: string }
        Returns: {
          balance: number
          crate_type_id: string
          crate_type_name: string
          retailer_id: string
          retailer_name: string
          shop_name: string
        }[]
      }
      get_near_expiry_stock: {
        Args: { _days?: number }
        Returns: {
          available_qty: number
          batch_no: string
          days_remaining: number
          expiry_date: string
          product_name: string
        }[]
      }
      get_stock_valuation: {
        Args: never
        Returns: {
          available_qty: number
          avg_cost: number
          damaged_qty: number
          product_id: string
          product_name: string
          total_qty: number
          total_value: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _uid: string }; Returns: boolean }
      post_stock_adjustment: {
        Args: { _adjustment_id: string }
        Returns: undefined
      }
      recalc_customer_outstanding: {
        Args: { _customer_id: string }
        Returns: undefined
      }
      recalc_invoice: { Args: { _invoice_id: string }; Returns: undefined }
      recalc_purchase: { Args: { _purchase_id: string }; Returns: undefined }
      recalc_run_delivery_status: {
        Args: { _run_id: string }
        Returns: undefined
      }
      recalc_supplier_outstanding: {
        Args: { _supplier_id: string }
        Returns: undefined
      }
      record_notification_attempt: {
        Args: {
          _error?: string
          _id: string
          _provider?: string
          _provider_msg?: string
          _success: boolean
          _suppressed?: boolean
        }
        Returns: {
          attempts: number
          body: string | null
          channel: Database["public"]["Enums"]["notification_channel"]
          created_at: string
          customer_id: string | null
          delivery_id: string | null
          id: string
          idempotency_key: string | null
          invoice_id: string | null
          last_attempt_at: string | null
          last_error: string | null
          max_attempts: number
          next_retry_at: string | null
          provider: string | null
          provider_message_id: string | null
          recipient: string
          recipient_name: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          subject: string | null
          template: string | null
          template_data: Json
          triggered_by: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "notification_logs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "manager" | "salesperson" | "driver" | "helper"
      notification_channel: "email" | "sms" | "whatsapp"
      notification_status:
        | "queued"
        | "sending"
        | "sent"
        | "failed"
        | "suppressed"
        | "cancelled"
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
      notification_channel: ["email", "sms", "whatsapp"],
      notification_status: [
        "queued",
        "sending",
        "sent",
        "failed",
        "suppressed",
        "cancelled",
      ],
    },
  },
} as const
