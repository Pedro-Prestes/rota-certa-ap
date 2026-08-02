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
      admins_master: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      blockchain_blocos: {
        Row: {
          corrida_id: string | null
          created_at: string
          dados: Json
          evento: string
          hash: string
          hash_anterior: string
          id: string
          indice: number
          registrado_por: string | null
        }
        Insert: {
          corrida_id?: string | null
          created_at?: string
          dados?: Json
          evento: string
          hash: string
          hash_anterior: string
          id?: string
          indice?: number
          registrado_por?: string | null
        }
        Update: {
          corrida_id?: string | null
          created_at?: string
          dados?: Json
          evento?: string
          hash?: string
          hash_anterior?: string
          id?: string
          indice?: number
          registrado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "blockchain_blocos_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
        ]
      }
      carteira_transacoes: {
        Row: {
          corrida_id: string | null
          created_at: string
          descricao: string | null
          environment: string
          id: string
          pagamento_id: string | null
          referencia_externa: string | null
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          corrida_id?: string | null
          created_at?: string
          descricao?: string | null
          environment?: string
          id?: string
          pagamento_id?: string | null
          referencia_externa?: string | null
          tipo: string
          user_id: string
          valor: number
        }
        Update: {
          corrida_id?: string | null
          created_at?: string
          descricao?: string | null
          environment?: string
          id?: string
          pagamento_id?: string | null
          referencia_externa?: string | null
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "carteira_transacoes_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carteira_transacoes_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
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
      custos_terceiros: {
        Row: {
          categoria: string
          competencia: string
          created_at: string
          descricao: string
          fornecedor: string
          id: string
          recorrente: boolean
          updated_at: string
          valor: number
        }
        Insert: {
          categoria?: string
          competencia?: string
          created_at?: string
          descricao?: string
          fornecedor: string
          id?: string
          recorrente?: boolean
          updated_at?: string
          valor?: number
        }
        Update: {
          categoria?: string
          competencia?: string
          created_at?: string
          descricao?: string
          fornecedor?: string
          id?: string
          recorrente?: boolean
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      estornos: {
        Row: {
          autorizado_por: string | null
          corrida_id: string | null
          created_at: string
          devolve_taxa: boolean
          id: string
          integral: boolean
          motivo: string
          pagamento_id: string
          processado_em: string | null
          provedor: string | null
          provedor_ref: string | null
          status: Database["public"]["Enums"]["status_estorno"]
          updated_at: string
          valor: number
        }
        Insert: {
          autorizado_por?: string | null
          corrida_id?: string | null
          created_at?: string
          devolve_taxa?: boolean
          id?: string
          integral?: boolean
          motivo?: string
          pagamento_id: string
          processado_em?: string | null
          provedor?: string | null
          provedor_ref?: string | null
          status?: Database["public"]["Enums"]["status_estorno"]
          updated_at?: string
          valor: number
        }
        Update: {
          autorizado_por?: string | null
          corrida_id?: string | null
          created_at?: string
          devolve_taxa?: boolean
          id?: string
          integral?: boolean
          motivo?: string
          pagamento_id?: string
          processado_em?: string | null
          provedor?: string | null
          provedor_ref?: string | null
          status?: Database["public"]["Enums"]["status_estorno"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "estornos_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estornos_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_contabeis: {
        Row: {
          competencia: string
          corrida_id: string | null
          created_at: string
          custo_id: string | null
          descricao: string
          detalhamento: Json
          estorno_id: string | null
          id: string
          pagamento_id: string | null
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at: string
          valor: number
        }
        Insert: {
          competencia?: string
          corrida_id?: string | null
          created_at?: string
          custo_id?: string | null
          descricao?: string
          detalhamento?: Json
          estorno_id?: string | null
          id?: string
          pagamento_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at?: string
          valor?: number
        }
        Update: {
          competencia?: string
          corrida_id?: string | null
          created_at?: string
          custo_id?: string | null
          descricao?: string
          detalhamento?: Json
          estorno_id?: string | null
          id?: string
          pagamento_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_lancamento"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_contabeis_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_custo_id_fkey"
            columns: ["custo_id"]
            isOneToOne: false
            referencedRelation: "custos_terceiros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_estorno_id_fkey"
            columns: ["estorno_id"]
            isOneToOne: false
            referencedRelation: "estornos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          mensagem: string
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem: string
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string
          tipo?: string
          titulo?: string
          user_id?: string
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
      plataforma_config: {
        Row: {
          chave: string
          created_at: string
          descricao: string
          id: string
          repasse_motorista_percentual: number
          taxa_fixa: number
          taxa_percentual: number
          updated_at: string
          vigente_desde: string
        }
        Insert: {
          chave: string
          created_at?: string
          descricao?: string
          id?: string
          repasse_motorista_percentual?: number
          taxa_fixa?: number
          taxa_percentual?: number
          updated_at?: string
          vigente_desde?: string
        }
        Update: {
          chave?: string
          created_at?: string
          descricao?: string
          id?: string
          repasse_motorista_percentual?: number
          taxa_fixa?: number
          taxa_percentual?: number
          updated_at?: string
          vigente_desde?: string
        }
        Relationships: []
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
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string
          product_id: string
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id: string
          product_id: string
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string
          product_id?: string
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trajetos: {
        Row: {
          corrida_id: string
          created_at: string
          id: string
          latitude: number
          longitude: number
          precisao_m: number | null
          registrado_em: string
          sequencia: number
          velocidade_kmh: number | null
        }
        Insert: {
          corrida_id: string
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          precisao_m?: number | null
          registrado_em?: string
          sequencia?: number
          velocidade_kmh?: number | null
        }
        Update: {
          corrida_id?: string
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          precisao_m?: number | null
          registrado_em?: string
          sequencia?: number
          velocidade_kmh?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trajetos_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
        ]
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
      veiculos: {
        Row: {
          ano: number
          assentos: number
          carga_util_kg: number
          categoria: string
          chassi: string | null
          cor: string | null
          created_at: string
          crlv_exercicio: number | null
          crlv_situacao: string | null
          id: string
          marca: string
          modelo: string
          placa: string
          renavam: string | null
          status_verificacao: Database["public"]["Enums"]["status_verificacao"]
          updated_at: string
          user_id: string
          volume_bagageiro_l: number
        }
        Insert: {
          ano?: number
          assentos?: number
          carga_util_kg?: number
          categoria?: string
          chassi?: string | null
          cor?: string | null
          created_at?: string
          crlv_exercicio?: number | null
          crlv_situacao?: string | null
          id?: string
          marca?: string
          modelo?: string
          placa: string
          renavam?: string | null
          status_verificacao?: Database["public"]["Enums"]["status_verificacao"]
          updated_at?: string
          user_id: string
          volume_bagageiro_l?: number
        }
        Update: {
          ano?: number
          assentos?: number
          carga_util_kg?: number
          categoria?: string
          chassi?: string | null
          cor?: string | null
          created_at?: string
          crlv_exercicio?: number | null
          crlv_situacao?: string | null
          id?: string
          marca?: string
          modelo?: string
          placa?: string
          renavam?: string | null
          status_verificacao?: Database["public"]["Enums"]["status_verificacao"]
          updated_at?: string
          user_id?: string
          volume_bagageiro_l?: number
        }
        Relationships: []
      }
      verificacoes_idoneidade: {
        Row: {
          alvo: Database["public"]["Enums"]["alvo_verificacao"]
          consultado_em: string | null
          created_at: string
          documento: string
          expira_em: string | null
          id: string
          nome_conferido: string | null
          pendencias: Json
          pontuacao: number | null
          provedor: string
          resultado: Json
          status: Database["public"]["Enums"]["status_verificacao"]
          updated_at: string
          user_id: string
          veiculo_id: string | null
        }
        Insert: {
          alvo: Database["public"]["Enums"]["alvo_verificacao"]
          consultado_em?: string | null
          created_at?: string
          documento?: string
          expira_em?: string | null
          id?: string
          nome_conferido?: string | null
          pendencias?: Json
          pontuacao?: number | null
          provedor?: string
          resultado?: Json
          status?: Database["public"]["Enums"]["status_verificacao"]
          updated_at?: string
          user_id: string
          veiculo_id?: string | null
        }
        Update: {
          alvo?: Database["public"]["Enums"]["alvo_verificacao"]
          consultado_em?: string | null
          created_at?: string
          documento?: string
          expira_em?: string | null
          id?: string
          nome_conferido?: string | null
          pendencias?: Json
          pontuacao?: number | null
          provedor?: string
          resultado?: Json
          status?: Database["public"]["Enums"]["status_verificacao"]
          updated_at?: string
          user_id?: string
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "verificacoes_idoneidade_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
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
      saldo_carteira: {
        Args: { _env?: string; _user_id: string }
        Returns: number
      }
      tem_plano_ativo: {
        Args: { _env?: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      alvo_verificacao: "passageiro" | "motorista" | "veiculo"
      app_role: "passageiro" | "motorista" | "admin"
      forma_pagamento: "pix" | "credito" | "debito" | "dinheiro"
      status_estorno:
        | "solicitado"
        | "processando"
        | "concluido"
        | "falhou"
        | "cancelado"
      status_pagamento: "pendente" | "pago" | "estornado" | "cancelado"
      status_verificacao:
        | "pendente"
        | "em_analise"
        | "aprovado"
        | "reprovado"
        | "expirado"
      tipo_lancamento:
        | "receita_bruta"
        | "taxa_plataforma"
        | "taxa_gateway"
        | "repasse_motorista"
        | "estorno"
        | "custo_terceiro"
        | "ajuste"
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
      alvo_verificacao: ["passageiro", "motorista", "veiculo"],
      app_role: ["passageiro", "motorista", "admin"],
      forma_pagamento: ["pix", "credito", "debito", "dinheiro"],
      status_estorno: [
        "solicitado",
        "processando",
        "concluido",
        "falhou",
        "cancelado",
      ],
      status_pagamento: ["pendente", "pago", "estornado", "cancelado"],
      status_verificacao: [
        "pendente",
        "em_analise",
        "aprovado",
        "reprovado",
        "expirado",
      ],
      tipo_lancamento: [
        "receita_bruta",
        "taxa_plataforma",
        "taxa_gateway",
        "repasse_motorista",
        "estorno",
        "custo_terceiro",
        "ajuste",
      ],
    },
  },
} as const
