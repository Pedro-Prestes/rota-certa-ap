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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      codigos_sms: {
        Row: {
          codigo_hash: string
          created_at: string
          expira_em: string
          id: string
          telefone: string
          tentativas: number
          usado: boolean
        }
        Insert: {
          codigo_hash: string
          created_at?: string
          expira_em: string
          id?: string
          telefone: string
          tentativas?: number
          usado?: boolean
        }
        Update: {
          codigo_hash?: string
          created_at?: string
          expira_em?: string
          id?: string
          telefone?: string
          tentativas?: number
          usado?: boolean
        }
        Relationships: []
      }
      corridas: {
        Row: {
          assentos: number
          bagagem_l: number
          comissao_percentual: number
          created_at: string
          data_corrida: string
          desconto: number
          destino: string
          distancia_km: number
          hora_chegada: string | null
          hora_partida: string | null
          id: string
          motorista_nome: string
          observacoes: string | null
          origem: string
          passageiro_nome: string
          updated_at: string
          user_id: string
          valor_bagagem: number
          valor_extras: number
          valor_pedagios: number
          valor_tarifa: number
          veiculo: string | null
        }
        Insert: {
          assentos?: number
          bagagem_l?: number
          comissao_percentual?: number
          created_at?: string
          data_corrida?: string
          desconto?: number
          destino?: string
          distancia_km?: number
          hora_chegada?: string | null
          hora_partida?: string | null
          id?: string
          motorista_nome?: string
          observacoes?: string | null
          origem?: string
          passageiro_nome?: string
          updated_at?: string
          user_id: string
          valor_bagagem?: number
          valor_extras?: number
          valor_pedagios?: number
          valor_tarifa?: number
          veiculo?: string | null
        }
        Update: {
          assentos?: number
          bagagem_l?: number
          comissao_percentual?: number
          created_at?: string
          data_corrida?: string
          desconto?: number
          destino?: string
          distancia_km?: number
          hora_chegada?: string | null
          hora_partida?: string | null
          id?: string
          motorista_nome?: string
          observacoes?: string | null
          origem?: string
          passageiro_nome?: string
          updated_at?: string
          user_id?: string
          valor_bagagem?: number
          valor_extras?: number
          valor_pedagios?: number
          valor_tarifa?: number
          veiculo?: string | null
        }
        Relationships: []
      }
      pagamentos: {
        Row: {
          autorizacao: string | null
          bandeira: string | null
          chave_pix: string | null
          corrida_id: string
          created_at: string
          forma: Database["public"]["Enums"]["forma_pagamento"]
          id: string
          observacoes: string | null
          pago_em: string
          parcelas: number
          status: Database["public"]["Enums"]["status_pagamento"]
          taxa_percentual: number
          troco: number
          updated_at: string
          user_id: string
          valor: number
          valor_recebido: number | null
        }
        Insert: {
          autorizacao?: string | null
          bandeira?: string | null
          chave_pix?: string | null
          corrida_id: string
          created_at?: string
          forma: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          observacoes?: string | null
          pago_em?: string
          parcelas?: number
          status?: Database["public"]["Enums"]["status_pagamento"]
          taxa_percentual?: number
          troco?: number
          updated_at?: string
          user_id: string
          valor?: number
          valor_recebido?: number | null
        }
        Update: {
          autorizacao?: string | null
          bandeira?: string | null
          chave_pix?: string | null
          corrida_id?: string
          created_at?: string
          forma?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          observacoes?: string | null
          pago_em?: string
          parcelas?: number
          status?: Database["public"]["Enums"]["status_pagamento"]
          taxa_percentual?: number
          troco?: number
          updated_at?: string
          user_id?: string
          valor?: number
          valor_recebido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          municipio: string | null
          nome_completo: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          municipio?: string | null
          nome_completo?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          municipio?: string | null
          nome_completo?: string
          telefone?: string | null
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
      app_role: "passageiro" | "motorista" | "admin"
      forma_pagamento: "pix" | "credito" | "debito" | "dinheiro"
      status_pagamento: "pendente" | "pago" | "estornado" | "cancelado"
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
      app_role: ["passageiro", "motorista", "admin"],
      forma_pagamento: ["pix", "credito", "debito", "dinheiro"],
      status_pagamento: ["pendente", "pago", "estornado", "cancelado"],
    },
  },
} as const
