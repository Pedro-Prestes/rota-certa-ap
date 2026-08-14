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
      assinaturas_carteira: {
        Row: {
          cancelar_no_fim: boolean
          created_at: string
          environment: string
          id: string
          periodo_fim: string
          periodo_inicio: string
          price_id: string
          promocional: boolean
          proxima_cobranca: string
          status: string
          tentativas: number
          updated_at: string
          user_id: string
          valor_mensal: number
        }
        Insert: {
          cancelar_no_fim?: boolean
          created_at?: string
          environment?: string
          id?: string
          periodo_fim: string
          periodo_inicio?: string
          price_id: string
          promocional?: boolean
          proxima_cobranca: string
          status?: string
          tentativas?: number
          updated_at?: string
          user_id: string
          valor_mensal: number
        }
        Update: {
          cancelar_no_fim?: boolean
          created_at?: string
          environment?: string
          id?: string
          periodo_fim?: string
          periodo_inicio?: string
          price_id?: string
          promocional?: boolean
          proxima_cobranca?: string
          status?: string
          tentativas?: number
          updated_at?: string
          user_id?: string
          valor_mensal?: number
        }
        Relationships: []
      }
      avaliacoes_motorista: {
        Row: {
          comentario: string | null
          corrida_urbana_id: string | null
          created_at: string
          id: string
          motorista_id: string
          nota: number
          passageiro_id: string
          rota_id: string | null
          updated_at: string
        }
        Insert: {
          comentario?: string | null
          corrida_urbana_id?: string | null
          created_at?: string
          id?: string
          motorista_id: string
          nota: number
          passageiro_id: string
          rota_id?: string | null
          updated_at?: string
        }
        Update: {
          comentario?: string | null
          corrida_urbana_id?: string | null
          created_at?: string
          id?: string
          motorista_id?: string
          nota?: number
          passageiro_id?: string
          rota_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_motorista_corrida_urbana_id_fkey"
            columns: ["corrida_urbana_id"]
            isOneToOne: false
            referencedRelation: "corridas_urbanas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avaliacoes_motorista_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
        ]
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
      coberturas_seguro: {
        Row: {
          assentos: number
          created_at: string
          data_viagem: string | null
          environment: string
          id: string
          modalidade: string
          price_id: string
          rota_id: string | null
          status: string
          updated_at: string
          user_id: string
          valor: number
          vigencia_fim: string
          vigencia_inicio: string
        }
        Insert: {
          assentos?: number
          created_at?: string
          data_viagem?: string | null
          environment?: string
          id?: string
          modalidade: string
          price_id: string
          rota_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          valor: number
          vigencia_fim: string
          vigencia_inicio?: string
        }
        Update: {
          assentos?: number
          created_at?: string
          data_viagem?: string | null
          environment?: string
          id?: string
          modalidade?: string
          price_id?: string
          rota_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          valor?: number
          vigencia_fim?: string
          vigencia_inicio?: string
        }
        Relationships: [
          {
            foreignKeyName: "coberturas_seguro_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
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
      cooperativa_carteira: {
        Row: {
          cooperativa_id: string
          created_at: string
          moeda: string
          saldo_disponivel: number
          saldo_repassado: number
          updated_at: string
        }
        Insert: {
          cooperativa_id: string
          created_at?: string
          moeda?: string
          saldo_disponivel?: number
          saldo_repassado?: number
          updated_at?: string
        }
        Update: {
          cooperativa_id?: string
          created_at?: string
          moeda?: string
          saldo_disponivel?: number
          saldo_repassado?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cooperativa_carteira_cooperativa_id_fkey"
            columns: ["cooperativa_id"]
            isOneToOne: true
            referencedRelation: "cooperativas"
            referencedColumns: ["id"]
          },
        ]
      }
      cooperativa_motoristas: {
        Row: {
          cooperativa_id: string
          created_at: string
          id: string
          motorista_id: string
          status: string
          updated_at: string
        }
        Insert: {
          cooperativa_id: string
          created_at?: string
          id?: string
          motorista_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cooperativa_id?: string
          created_at?: string
          id?: string
          motorista_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cooperativa_motoristas_cooperativa_id_fkey"
            columns: ["cooperativa_id"]
            isOneToOne: false
            referencedRelation: "cooperativas"
            referencedColumns: ["id"]
          },
        ]
      }
      cooperativa_repasses: {
        Row: {
          cooperativa_id: string
          created_at: string
          id: string
          liquido: number
          metodo: string
          modo: string
          motivo_falha: string | null
          processado_em: string | null
          provedor: string | null
          provedor_ref: string | null
          solicitado_em: string
          status: string
          taxa: number
          updated_at: string
          valor: number
        }
        Insert: {
          cooperativa_id: string
          created_at?: string
          id?: string
          liquido: number
          metodo?: string
          modo?: string
          motivo_falha?: string | null
          processado_em?: string | null
          provedor?: string | null
          provedor_ref?: string | null
          solicitado_em?: string
          status?: string
          taxa?: number
          updated_at?: string
          valor: number
        }
        Update: {
          cooperativa_id?: string
          created_at?: string
          id?: string
          liquido?: number
          metodo?: string
          modo?: string
          motivo_falha?: string | null
          processado_em?: string | null
          provedor?: string | null
          provedor_ref?: string | null
          solicitado_em?: string
          status?: string
          taxa?: number
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cooperativa_repasses_cooperativa_id_fkey"
            columns: ["cooperativa_id"]
            isOneToOne: false
            referencedRelation: "cooperativas"
            referencedColumns: ["id"]
          },
        ]
      }
      cooperativa_transacoes: {
        Row: {
          cooperativa_id: string
          corrida_id: string | null
          corrida_urbana_id: string | null
          created_at: string
          descricao: string
          environment: string
          id: string
          motorista_id: string | null
          pagamento_id: string | null
          referencia_externa: string | null
          tipo: string
          valor: number
        }
        Insert: {
          cooperativa_id: string
          corrida_id?: string | null
          corrida_urbana_id?: string | null
          created_at?: string
          descricao: string
          environment?: string
          id?: string
          motorista_id?: string | null
          pagamento_id?: string | null
          referencia_externa?: string | null
          tipo: string
          valor: number
        }
        Update: {
          cooperativa_id?: string
          corrida_id?: string | null
          corrida_urbana_id?: string | null
          created_at?: string
          descricao?: string
          environment?: string
          id?: string
          motorista_id?: string | null
          pagamento_id?: string | null
          referencia_externa?: string | null
          tipo?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cooperativa_transacoes_cooperativa_id_fkey"
            columns: ["cooperativa_id"]
            isOneToOne: false
            referencedRelation: "cooperativas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cooperativa_transacoes_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cooperativa_transacoes_corrida_urbana_fkey"
            columns: ["corrida_urbana_id"]
            isOneToOne: false
            referencedRelation: "corridas_urbanas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cooperativa_transacoes_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      cooperativas: {
        Row: {
          agencia: string | null
          avaliada_em: string | null
          banco_codigo: string | null
          banco_nome: string | null
          cnpj: string
          conta: string | null
          created_at: string
          email_contato: string | null
          fase_atual: number
          id: string
          municipio: string | null
          nome_fantasia: string | null
          pix_chave: string | null
          pix_tipo: string | null
          razao_social: string
          responsavel_nome: string
          score_conformidade: number
          status: string
          telefone: string | null
          tipo_conta: string | null
          titular_documento: string
          titular_nome: string
          uf: string | null
          updated_at: string
          user_id: string
          verificada: boolean
        }
        Insert: {
          agencia?: string | null
          avaliada_em?: string | null
          banco_codigo?: string | null
          banco_nome?: string | null
          cnpj: string
          conta?: string | null
          created_at?: string
          email_contato?: string | null
          fase_atual?: number
          id?: string
          municipio?: string | null
          nome_fantasia?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          razao_social: string
          responsavel_nome: string
          score_conformidade?: number
          status?: string
          telefone?: string | null
          tipo_conta?: string | null
          titular_documento: string
          titular_nome: string
          uf?: string | null
          updated_at?: string
          user_id: string
          verificada?: boolean
        }
        Update: {
          agencia?: string | null
          avaliada_em?: string | null
          banco_codigo?: string | null
          banco_nome?: string | null
          cnpj?: string
          conta?: string | null
          created_at?: string
          email_contato?: string | null
          fase_atual?: number
          id?: string
          municipio?: string | null
          nome_fantasia?: string | null
          pix_chave?: string | null
          pix_tipo?: string | null
          razao_social?: string
          responsavel_nome?: string
          score_conformidade?: number
          status?: string
          telefone?: string | null
          tipo_conta?: string | null
          titular_documento?: string
          titular_nome?: string
          uf?: string | null
          updated_at?: string
          user_id?: string
          verificada?: boolean
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
      corridas_urbanas: {
        Row: {
          aceita_em: string | null
          agendada_para: string | null
          avaliacao_motorista: number | null
          avaliacao_passageiro: number | null
          bandeirada: number
          base: number
          cancelada_por: string | null
          concluida_em: string | null
          cooperativa_id: string | null
          created_at: string
          destino_endereco: string
          destino_latitude: number
          destino_longitude: number
          distancia_km: number
          duracao_min: number
          fator_pico: number
          forma_pagamento: string
          id: string
          iniciada_em: string | null
          modo: string
          motivo_cancelamento: string | null
          motorista_id: string | null
          municipio: string
          origem_endereco: string
          origem_latitude: number
          origem_longitude: number
          pagamento_id: string | null
          parcela_cooperativa: number
          parcela_plataforma: number
          passageiro_id: string
          status: string
          taxa_administrativa: number
          taxa_cancelamento: number
          total: number
          uf: string
          updated_at: string
          valor_km: number
          valor_minuto: number
        }
        Insert: {
          aceita_em?: string | null
          agendada_para?: string | null
          avaliacao_motorista?: number | null
          avaliacao_passageiro?: number | null
          bandeirada?: number
          base?: number
          cancelada_por?: string | null
          concluida_em?: string | null
          cooperativa_id?: string | null
          created_at?: string
          destino_endereco: string
          destino_latitude: number
          destino_longitude: number
          distancia_km?: number
          duracao_min?: number
          fator_pico?: number
          forma_pagamento?: string
          id?: string
          iniciada_em?: string | null
          modo?: string
          motivo_cancelamento?: string | null
          motorista_id?: string | null
          municipio: string
          origem_endereco: string
          origem_latitude: number
          origem_longitude: number
          pagamento_id?: string | null
          parcela_cooperativa?: number
          parcela_plataforma?: number
          passageiro_id: string
          status?: string
          taxa_administrativa?: number
          taxa_cancelamento?: number
          total?: number
          uf: string
          updated_at?: string
          valor_km?: number
          valor_minuto?: number
        }
        Update: {
          aceita_em?: string | null
          agendada_para?: string | null
          avaliacao_motorista?: number | null
          avaliacao_passageiro?: number | null
          bandeirada?: number
          base?: number
          cancelada_por?: string | null
          concluida_em?: string | null
          cooperativa_id?: string | null
          created_at?: string
          destino_endereco?: string
          destino_latitude?: number
          destino_longitude?: number
          distancia_km?: number
          duracao_min?: number
          fator_pico?: number
          forma_pagamento?: string
          id?: string
          iniciada_em?: string | null
          modo?: string
          motivo_cancelamento?: string | null
          motorista_id?: string | null
          municipio?: string
          origem_endereco?: string
          origem_latitude?: number
          origem_longitude?: number
          pagamento_id?: string | null
          parcela_cooperativa?: number
          parcela_plataforma?: number
          passageiro_id?: string
          status?: string
          taxa_administrativa?: number
          taxa_cancelamento?: number
          total?: number
          uf?: string
          updated_at?: string
          valor_km?: number
          valor_minuto?: number
        }
        Relationships: [
          {
            foreignKeyName: "corridas_urbanas_cooperativa_id_fkey"
            columns: ["cooperativa_id"]
            isOneToOne: false
            referencedRelation: "cooperativas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "corridas_urbanas_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "pagamentos"
            referencedColumns: ["id"]
          },
        ]
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
      driver_bank_accounts: {
        Row: {
          account_number: string | null
          account_type:
            | Database["public"]["Enums"]["driver_account_type"]
            | null
          agency_number: string | null
          bank_code: string | null
          bank_name: string | null
          created_at: string
          driver_id: string
          gateway_recipient_id: string | null
          holder_document: string
          holder_name: string
          id: string
          is_primary: boolean
          is_verified: boolean
          pix_key: string | null
          pix_key_type:
            | Database["public"]["Enums"]["driver_pix_key_type"]
            | null
          updated_at: string
        }
        Insert: {
          account_number?: string | null
          account_type?:
            | Database["public"]["Enums"]["driver_account_type"]
            | null
          agency_number?: string | null
          bank_code?: string | null
          bank_name?: string | null
          created_at?: string
          driver_id: string
          gateway_recipient_id?: string | null
          holder_document: string
          holder_name: string
          id?: string
          is_primary?: boolean
          is_verified?: boolean
          pix_key?: string | null
          pix_key_type?:
            | Database["public"]["Enums"]["driver_pix_key_type"]
            | null
          updated_at?: string
        }
        Update: {
          account_number?: string | null
          account_type?:
            | Database["public"]["Enums"]["driver_account_type"]
            | null
          agency_number?: string | null
          bank_code?: string | null
          bank_name?: string | null
          created_at?: string
          driver_id?: string
          gateway_recipient_id?: string | null
          holder_document?: string
          holder_name?: string
          id?: string
          is_primary?: boolean
          is_verified?: boolean
          pix_key?: string | null
          pix_key_type?:
            | Database["public"]["Enums"]["driver_pix_key_type"]
            | null
          updated_at?: string
        }
        Relationships: []
      }
      driver_payouts: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string
          driver_id: string
          failure_reason: string | null
          fee: number
          id: string
          mode: string
          net_amount: number
          payout_method: string
          processed_at: string | null
          provider: string | null
          provider_reference: string | null
          requested_at: string
          status: Database["public"]["Enums"]["driver_payout_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string
          driver_id: string
          failure_reason?: string | null
          fee?: number
          id?: string
          mode?: string
          net_amount: number
          payout_method?: string
          processed_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["driver_payout_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string
          driver_id?: string
          failure_reason?: string | null
          fee?: number
          id?: string
          mode?: string
          net_amount?: number
          payout_method?: string
          processed_at?: string | null
          provider?: string | null
          provider_reference?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["driver_payout_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_payouts_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "driver_bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_routes: {
        Row: {
          base_distance_km: number
          base_seat_price: number
          created_at: string
          destination_border_neighborhood: string | null
          destination_city: string
          destination_uf: string
          driver_id: string
          id: string
          origin_border_neighborhood: string | null
          origin_city: string
          origin_uf: string
          status: string
          total_seats: number
          updated_at: string
        }
        Insert: {
          base_distance_km: number
          base_seat_price: number
          created_at?: string
          destination_border_neighborhood?: string | null
          destination_city: string
          destination_uf?: string
          driver_id: string
          id?: string
          origin_border_neighborhood?: string | null
          origin_city: string
          origin_uf?: string
          status?: string
          total_seats: number
          updated_at?: string
        }
        Update: {
          base_distance_km?: number
          base_seat_price?: number
          created_at?: string
          destination_border_neighborhood?: string | null
          destination_city?: string
          destination_uf?: string
          driver_id?: string
          id?: string
          origin_border_neighborhood?: string | null
          origin_city?: string
          origin_uf?: string
          status?: string
          total_seats?: number
          updated_at?: string
        }
        Relationships: []
      }
      driver_wallet: {
        Row: {
          balance_available: number
          balance_pending: number
          created_at: string
          currency: string
          driver_id: string
          updated_at: string
        }
        Insert: {
          balance_available?: number
          balance_pending?: number
          created_at?: string
          currency?: string
          driver_id: string
          updated_at?: string
        }
        Update: {
          balance_available?: number
          balance_pending?: number
          created_at?: string
          currency?: string
          driver_id?: string
          updated_at?: string
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
      fechamentos_saida: {
        Row: {
          assentos_confirmados: number
          assentos_prereservados: number
          capacidade: number
          created_at: string
          data_viagem: string
          fator_aplicado: number
          fechada_em: string
          id: string
          km_desvio_total: number
          minutos_desvio_total: number
          observacoes: string | null
          ocupacao: number
          partida_prevista: string | null
          receita_confirmada: number
          rota_id: string
          status: string
          updated_at: string
        }
        Insert: {
          assentos_confirmados?: number
          assentos_prereservados?: number
          capacidade?: number
          created_at?: string
          data_viagem: string
          fator_aplicado?: number
          fechada_em?: string
          id?: string
          km_desvio_total?: number
          minutos_desvio_total?: number
          observacoes?: string | null
          ocupacao?: number
          partida_prevista?: string | null
          receita_confirmada?: number
          rota_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          assentos_confirmados?: number
          assentos_prereservados?: number
          capacidade?: number
          created_at?: string
          data_viagem?: string
          fator_aplicado?: number
          fechada_em?: string
          id?: string
          km_desvio_total?: number
          minutos_desvio_total?: number
          observacoes?: string | null
          ocupacao?: number
          partida_prevista?: string | null
          receita_confirmada?: number
          rota_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fechamentos_saida_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
        ]
      }
      frotista_motoristas: {
        Row: {
          cnh: string | null
          cpf: string
          created_at: string
          frotista_id: string
          id: string
          nome: string
          status: string
          telefone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cnh?: string | null
          cpf: string
          created_at?: string
          frotista_id: string
          id?: string
          nome: string
          status?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cnh?: string | null
          cpf?: string
          created_at?: string
          frotista_id?: string
          id?: string
          nome?: string
          status?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "frotista_motoristas_frotista_id_fkey"
            columns: ["frotista_id"]
            isOneToOne: false
            referencedRelation: "frotistas"
            referencedColumns: ["id"]
          },
        ]
      }
      frotistas: {
        Row: {
          avaliada_em: string | null
          cnpj: string
          created_at: string
          email_contato: string | null
          fase_atual: number
          id: string
          municipio: string | null
          nome_fantasia: string | null
          razao_social: string
          responsavel_nome: string
          score_conformidade: number
          status: string
          telefone: string | null
          uf: string | null
          updated_at: string
          user_id: string
          verificada: boolean
        }
        Insert: {
          avaliada_em?: string | null
          cnpj: string
          created_at?: string
          email_contato?: string | null
          fase_atual?: number
          id?: string
          municipio?: string | null
          nome_fantasia?: string | null
          razao_social: string
          responsavel_nome: string
          score_conformidade?: number
          status?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          user_id: string
          verificada?: boolean
        }
        Update: {
          avaliada_em?: string | null
          cnpj?: string
          created_at?: string
          email_contato?: string | null
          fase_atual?: number
          id?: string
          municipio?: string | null
          nome_fantasia?: string | null
          razao_social?: string
          responsavel_nome?: string
          score_conformidade?: number
          status?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          user_id?: string
          verificada?: boolean
        }
        Relationships: []
      }
      habilitacoes_motorista: {
        Row: {
          categoria: string
          created_at: string
          ear: boolean
          id: string
          numero: string
          pendencias: Json
          primeira_habilitacao: string | null
          status: Database["public"]["Enums"]["status_verificacao"]
          updated_at: string
          user_id: string
          validade: string | null
        }
        Insert: {
          categoria: string
          created_at?: string
          ear?: boolean
          id?: string
          numero: string
          pendencias?: Json
          primeira_habilitacao?: string | null
          status?: Database["public"]["Enums"]["status_verificacao"]
          updated_at?: string
          user_id: string
          validade?: string | null
        }
        Update: {
          categoria?: string
          created_at?: string
          ear?: boolean
          id?: string
          numero?: string
          pendencias?: Json
          primeira_habilitacao?: string | null
          status?: Database["public"]["Enums"]["status_verificacao"]
          updated_at?: string
          user_id?: string
          validade?: string | null
        }
        Relationships: []
      }
      lancamentos_contabeis: {
        Row: {
          competencia: string
          cooperativa_id: string | null
          corrida_id: string | null
          corrida_urbana_id: string | null
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
          cooperativa_id?: string | null
          corrida_id?: string | null
          corrida_urbana_id?: string | null
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
          cooperativa_id?: string | null
          corrida_id?: string | null
          corrida_urbana_id?: string | null
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
            foreignKeyName: "lancamentos_contabeis_cooperativa_id_fkey"
            columns: ["cooperativa_id"]
            isOneToOne: false
            referencedRelation: "cooperativas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_contabeis_corrida_urbana_id_fkey"
            columns: ["corrida_urbana_id"]
            isOneToOne: false
            referencedRelation: "corridas_urbanas"
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
      motoristas_urbanos: {
        Row: {
          ativo: boolean
          created_at: string
          municipio: string | null
          online: boolean
          uf: string | null
          ultima_latitude: number | null
          ultima_longitude: number | null
          ultima_posicao_em: string | null
          updated_at: string
          user_id: string
          veiculo_id: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          municipio?: string | null
          online?: boolean
          uf?: string | null
          ultima_latitude?: number | null
          ultima_longitude?: number | null
          ultima_posicao_em?: string | null
          updated_at?: string
          user_id: string
          veiculo_id?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          municipio?: string | null
          online?: boolean
          uf?: string | null
          ultima_latitude?: number | null
          ultima_longitude?: number | null
          ultima_posicao_em?: string | null
          updated_at?: string
          user_id?: string
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "motoristas_urbanos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      neighborhoods: {
        Row: {
          created_at: string
          geom: unknown
          id: string
          municipio: string | null
          name: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          geom: unknown
          id?: string
          municipio?: string | null
          name: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          geom?: unknown
          id?: string
          municipio?: string | null
          name?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
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
      oficinas: {
        Row: {
          created_at: string
          endereco: string
          id: string
          nome: string
          preferida: boolean
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          endereco: string
          id?: string
          nome: string
          preferida?: boolean
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          endereco?: string
          id?: string
          nome?: string
          preferida?: boolean
          telefone?: string | null
          updated_at?: string
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
      pagamentos_pix: {
        Row: {
          created_at: string
          creditado_em: string | null
          creditos: number
          descricao: string
          environment: string
          expira_em: string | null
          finalidade: string
          id: string
          price_id: string
          provedor: string
          provedor_payment_id: string | null
          qr_code: string | null
          qr_code_base64: string | null
          status: string
          taxa_admin: number
          taxa_fixa: number
          taxa_percentual: number
          ticket_url: string | null
          updated_at: string
          user_id: string
          valor_base: number
          valor_total: number
        }
        Insert: {
          created_at?: string
          creditado_em?: string | null
          creditos?: number
          descricao: string
          environment?: string
          expira_em?: string | null
          finalidade?: string
          id?: string
          price_id: string
          provedor?: string
          provedor_payment_id?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          status?: string
          taxa_admin?: number
          taxa_fixa?: number
          taxa_percentual?: number
          ticket_url?: string | null
          updated_at?: string
          user_id: string
          valor_base: number
          valor_total: number
        }
        Update: {
          created_at?: string
          creditado_em?: string | null
          creditos?: number
          descricao?: string
          environment?: string
          expira_em?: string | null
          finalidade?: string
          id?: string
          price_id?: string
          provedor?: string
          provedor_payment_id?: string | null
          qr_code?: string | null
          qr_code_base64?: string | null
          status?: string
          taxa_admin?: number
          taxa_fixa?: number
          taxa_percentual?: number
          ticket_url?: string | null
          updated_at?: string
          user_id?: string
          valor_base?: number
          valor_total?: number
        }
        Relationships: []
      }
      parcerias_interacoes: {
        Row: {
          autor_id: string
          created_at: string
          id: string
          lead_id: string
          resumo: string
          tipo: string
        }
        Insert: {
          autor_id?: string
          created_at?: string
          id?: string
          lead_id: string
          resumo: string
          tipo: string
        }
        Update: {
          autor_id?: string
          created_at?: string
          id?: string
          lead_id?: string
          resumo?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "parcerias_interacoes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "parcerias_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      parcerias_leads: {
        Row: {
          associados: number
          cargo: string
          cnpj: string | null
          consentimento_contato: boolean
          created_at: string
          dificuldade: string
          email: string
          entidade: string
          etapa: string
          id: string
          interesse_piloto: boolean
          motivo_perda: string | null
          municipio: string
          observacoes: string | null
          origem: string
          proxima_acao_em: string | null
          responsavel: string
          rotas_atuais: number
          segmento: string
          telefone: string
          uf: string
          updated_at: string
          veiculos: number
        }
        Insert: {
          associados: number
          cargo: string
          cnpj?: string | null
          consentimento_contato: boolean
          created_at?: string
          dificuldade: string
          email: string
          entidade: string
          etapa?: string
          id?: string
          interesse_piloto?: boolean
          motivo_perda?: string | null
          municipio: string
          observacoes?: string | null
          origem?: string
          proxima_acao_em?: string | null
          responsavel: string
          rotas_atuais?: number
          segmento?: string
          telefone: string
          uf: string
          updated_at?: string
          veiculos: number
        }
        Update: {
          associados?: number
          cargo?: string
          cnpj?: string | null
          consentimento_contato?: boolean
          created_at?: string
          dificuldade?: string
          email?: string
          entidade?: string
          etapa?: string
          id?: string
          interesse_piloto?: boolean
          motivo_perda?: string | null
          municipio?: string
          observacoes?: string | null
          origem?: string
          proxima_acao_em?: string | null
          responsavel?: string
          rotas_atuais?: number
          segmento?: string
          telefone?: string
          uf?: string
          updated_at?: string
          veiculos?: number
        }
        Relationships: []
      }
      pj_conformidade: {
        Row: {
          created_at: string
          entidade_id: string
          id: string
          numero: string | null
          observacao: string | null
          orgao_emissor: string | null
          pendencias: Json
          status: Database["public"]["Enums"]["status_verificacao"]
          tipo_documento: string
          tipo_entidade: string
          updated_at: string
          user_id: string
          validade: string | null
        }
        Insert: {
          created_at?: string
          entidade_id: string
          id?: string
          numero?: string | null
          observacao?: string | null
          orgao_emissor?: string | null
          pendencias?: Json
          status?: Database["public"]["Enums"]["status_verificacao"]
          tipo_documento: string
          tipo_entidade: string
          updated_at?: string
          user_id: string
          validade?: string | null
        }
        Update: {
          created_at?: string
          entidade_id?: string
          id?: string
          numero?: string | null
          observacao?: string | null
          orgao_emissor?: string | null
          pendencias?: Json
          status?: Database["public"]["Enums"]["status_verificacao"]
          tipo_documento?: string
          tipo_entidade?: string
          updated_at?: string
          user_id?: string
          validade?: string | null
        }
        Relationships: []
      }
      planos_embarque: {
        Row: {
          created_at: string
          custo_busca: number
          data_viagem: string
          distancia_busca_km: number
          duracao_busca_min: number
          id: string
          partida_garantida: string | null
          provedor: string
          rota_id: string
          saida_motorista: string | null
          sequencia: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          custo_busca?: number
          data_viagem: string
          distancia_busca_km?: number
          duracao_busca_min?: number
          id?: string
          partida_garantida?: string | null
          provedor?: string
          rota_id: string
          saida_motorista?: string | null
          sequencia?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          custo_busca?: number
          data_viagem?: string
          distancia_busca_km?: number
          duracao_busca_min?: number
          id?: string
          partida_garantida?: string | null
          provedor?: string
          rota_id?: string
          saida_motorista?: string | null
          sequencia?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planos_embarque_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
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
          rateio_cooperativa_percentual: number
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
          rateio_cooperativa_percentual?: number
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
          rateio_cooperativa_percentual?: number
          repasse_motorista_percentual?: number
          taxa_fixa?: number
          taxa_percentual?: number
          updated_at?: string
          vigente_desde?: string
        }
        Relationships: []
      }
      pontos_embarque: {
        Row: {
          assentos: number
          contra_endereco: string | null
          contra_latitude: number | null
          contra_longitude: number | null
          created_at: string
          data_viagem: string
          endereco: string
          eta_ponto: string | null
          id: string
          latitude: number
          longitude: number
          motivo: string | null
          ordem: number | null
          passageiro_id: string
          passageiro_nome: string
          referencia: string | null
          rota_id: string
          saida_motorista: string | null
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          assentos?: number
          contra_endereco?: string | null
          contra_latitude?: number | null
          contra_longitude?: number | null
          created_at?: string
          data_viagem: string
          endereco: string
          eta_ponto?: string | null
          id?: string
          latitude: number
          longitude: number
          motivo?: string | null
          ordem?: number | null
          passageiro_id: string
          passageiro_nome?: string
          referencia?: string | null
          rota_id: string
          saida_motorista?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          assentos?: number
          contra_endereco?: string | null
          contra_latitude?: number | null
          contra_longitude?: number | null
          created_at?: string
          data_viagem?: string
          endereco?: string
          eta_ponto?: string | null
          id?: string
          latitude?: number
          longitude?: number
          motivo?: string | null
          ordem?: number | null
          passageiro_id?: string
          passageiro_nome?: string
          referencia?: string | null
          rota_id?: string
          saida_motorista?: string | null
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pontos_embarque_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
        ]
      }
      pre_reservas: {
        Row: {
          assentos: number
          assentos_bagagem: number
          bagagem_kg: number
          corrida_id: string | null
          created_at: string
          data_viagem: string
          endereco: string
          exclusiva: boolean
          fator_ocupacao: number | null
          id: string
          km_desvio: number | null
          latitude: number | null
          longitude: number | null
          minutos_desvio: number | null
          oferta_enviada_em: string | null
          oferta_expira_em: string | null
          passageiro_id: string
          prioridade: number
          referencia: string | null
          rota_id: string
          status: string
          taxa_desvio: number | null
          updated_at: string
          valor_base: number | null
          valor_ofertado: number | null
        }
        Insert: {
          assentos?: number
          assentos_bagagem?: number
          bagagem_kg?: number
          corrida_id?: string | null
          created_at?: string
          data_viagem: string
          endereco: string
          exclusiva?: boolean
          fator_ocupacao?: number | null
          id?: string
          km_desvio?: number | null
          latitude?: number | null
          longitude?: number | null
          minutos_desvio?: number | null
          oferta_enviada_em?: string | null
          oferta_expira_em?: string | null
          passageiro_id: string
          prioridade?: number
          referencia?: string | null
          rota_id: string
          status?: string
          taxa_desvio?: number | null
          updated_at?: string
          valor_base?: number | null
          valor_ofertado?: number | null
        }
        Update: {
          assentos?: number
          assentos_bagagem?: number
          bagagem_kg?: number
          corrida_id?: string | null
          created_at?: string
          data_viagem?: string
          endereco?: string
          exclusiva?: boolean
          fator_ocupacao?: number | null
          id?: string
          km_desvio?: number | null
          latitude?: number | null
          longitude?: number | null
          minutos_desvio?: number | null
          oferta_enviada_em?: string | null
          oferta_expira_em?: string | null
          passageiro_id?: string
          prioridade?: number
          referencia?: string | null
          rota_id?: string
          status?: string
          taxa_desvio?: number | null
          updated_at?: string
          valor_base?: number | null
          valor_ofertado?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pre_reservas_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pre_reservas_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
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
          uf: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          municipio?: string | null
          nome_completo?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          municipio?: string | null
          nome_completo?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      promo_config: {
        Row: {
          ativa: boolean
          chave: string
          created_at: string
          dias: number
          id: string
          price_id: string
          updated_at: string
          vagas_por_uf: number
          vigencia_fim: string | null
          vigencia_inicio: string
        }
        Insert: {
          ativa?: boolean
          chave: string
          created_at?: string
          dias?: number
          id?: string
          price_id?: string
          updated_at?: string
          vagas_por_uf?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Update: {
          ativa?: boolean
          chave?: string
          created_at?: string
          dias?: number
          id?: string
          price_id?: string
          updated_at?: string
          vagas_por_uf?: number
          vigencia_fim?: string | null
          vigencia_inicio?: string
        }
        Relationships: []
      }
      promo_lancamento: {
        Row: {
          assinatura_id: string | null
          concedida_em: string
          created_at: string
          environment: string
          expira_em: string
          id: string
          posicao: number
          rota_id: string | null
          status: string
          uf: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assinatura_id?: string | null
          concedida_em?: string
          created_at?: string
          environment?: string
          expira_em: string
          id?: string
          posicao: number
          rota_id?: string | null
          status?: string
          uf: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assinatura_id?: string | null
          concedida_em?: string
          created_at?: string
          environment?: string
          expira_em?: string
          id?: string
          posicao?: number
          rota_id?: string | null
          status?: string
          uf?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_lancamento_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "assinaturas_carteira"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_lancamento_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
        ]
      }
      rota_veiculos: {
        Row: {
          created_at: string
          id: string
          rota_id: string
          veiculo_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rota_id: string
          veiculo_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rota_id?: string
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rota_veiculos_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rota_veiculos_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      rotas: {
        Row: {
          assentos: number
          chegada_ida: string | null
          chegada_retorno: string | null
          created_at: string
          destino: string
          dificuldade_via: number
          distancia_km: number
          frotista_id: string | null
          id: string
          observacoes: string | null
          origem: string
          preco_assento: number
          saida_ida: string | null
          saida_retorno: string | null
          status: string
          travessias: number
          uf_destino: string
          uf_origem: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assentos?: number
          chegada_ida?: string | null
          chegada_retorno?: string | null
          created_at?: string
          destino: string
          dificuldade_via?: number
          distancia_km?: number
          frotista_id?: string | null
          id?: string
          observacoes?: string | null
          origem: string
          preco_assento?: number
          saida_ida?: string | null
          saida_retorno?: string | null
          status?: string
          travessias?: number
          uf_destino?: string
          uf_origem?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assentos?: number
          chegada_ida?: string | null
          chegada_retorno?: string | null
          created_at?: string
          destino?: string
          dificuldade_via?: number
          distancia_km?: number
          frotista_id?: string | null
          id?: string
          observacoes?: string | null
          origem?: string
          preco_assento?: number
          saida_ida?: string | null
          saida_retorno?: string | null
          status?: string
          travessias?: number
          uf_destino?: string
          uf_origem?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rotas_frotista_id_fkey"
            columns: ["frotista_id"]
            isOneToOne: false
            referencedRelation: "frotistas"
            referencedColumns: ["id"]
          },
        ]
      }
      seat_reservations: {
        Row: {
          calculated_detour_fee: number | null
          calculated_detour_km: number | null
          created_at: string
          final_seat_price: number
          id: string
          passenger_id: string
          pickup_location: unknown
          pickup_type: string
          route_id: string
          status: string
          updated_at: string
        }
        Insert: {
          calculated_detour_fee?: number | null
          calculated_detour_km?: number | null
          created_at?: string
          final_seat_price: number
          id?: string
          passenger_id: string
          pickup_location: unknown
          pickup_type: string
          route_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          calculated_detour_fee?: number | null
          calculated_detour_km?: number | null
          created_at?: string
          final_seat_price?: number
          id?: string
          passenger_id?: string
          pickup_location?: unknown
          pickup_type?: string
          route_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seat_reservations_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "driver_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      sinistros: {
        Row: {
          cobertura_id: string | null
          concluido_em: string | null
          created_at: string
          descricao: string | null
          despachado_em: string | null
          id: string
          latitude: number | null
          longitude: number | null
          motorista_id: string
          oficina_id: string | null
          passageiros_afetados: number
          reboque_em: string | null
          status: string
          substituto_eta: string | null
          substituto_motorista: string | null
          substituto_placa: string | null
          tipo_pane: string
          updated_at: string
          veiculo_id: string | null
          viagem_id: string
        }
        Insert: {
          cobertura_id?: string | null
          concluido_em?: string | null
          created_at?: string
          descricao?: string | null
          despachado_em?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          motorista_id: string
          oficina_id?: string | null
          passageiros_afetados?: number
          reboque_em?: string | null
          status?: string
          substituto_eta?: string | null
          substituto_motorista?: string | null
          substituto_placa?: string | null
          tipo_pane: string
          updated_at?: string
          veiculo_id?: string | null
          viagem_id: string
        }
        Update: {
          cobertura_id?: string | null
          concluido_em?: string | null
          created_at?: string
          descricao?: string | null
          despachado_em?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          motorista_id?: string
          oficina_id?: string | null
          passageiros_afetados?: number
          reboque_em?: string | null
          status?: string
          substituto_eta?: string | null
          substituto_motorista?: string | null
          substituto_placa?: string | null
          tipo_pane?: string
          updated_at?: string
          veiculo_id?: string | null
          viagem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sinistros_cobertura_id_fkey"
            columns: ["cobertura_id"]
            isOneToOne: false
            referencedRelation: "coberturas_seguro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_oficina_id_fkey"
            columns: ["oficina_id"]
            isOneToOne: false
            referencedRelation: "oficinas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sinistros_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "viagens"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_admin: {
        Row: {
          created_at: string
          decidido_em: string | null
          decidido_por: string | null
          email: string
          id: string
          justificativa: string
          motivo: string | null
          nome: string
          perfil_solicitado: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          email: string
          id?: string
          justificativa: string
          motivo?: string | null
          nome: string
          perfil_solicitado?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decidido_em?: string | null
          decidido_por?: string | null
          email?: string
          id?: string
          justificativa?: string
          motivo?: string | null
          nome?: string
          perfil_solicitado?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id?: string
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
      tarifas_urbanas: {
        Row: {
          ativa: boolean
          bandeirada: number
          created_at: string
          fator_pico: number
          id: string
          minimo: number
          municipio: string
          taxa_cancelamento: number
          uf: string
          updated_at: string
          valor_km: number
          valor_minuto: number
        }
        Insert: {
          ativa?: boolean
          bandeirada?: number
          created_at?: string
          fator_pico?: number
          id?: string
          minimo?: number
          municipio: string
          taxa_cancelamento?: number
          uf: string
          updated_at?: string
          valor_km?: number
          valor_minuto?: number
        }
        Update: {
          ativa?: boolean
          bandeirada?: number
          created_at?: string
          fator_pico?: number
          id?: string
          minimo?: number
          municipio?: string
          taxa_cancelamento?: number
          uf?: string
          updated_at?: string
          valor_km?: number
          valor_minuto?: number
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
      veiculo_indisponibilidades: {
        Row: {
          created_at: string
          id: string
          inicio: string
          mensagem: string | null
          motivo: string
          resolvido_em: string | null
          retorno_previsto: string | null
          rota_id: string | null
          updated_at: string
          user_id: string
          veiculo_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inicio?: string
          mensagem?: string | null
          motivo: string
          resolvido_em?: string | null
          retorno_previsto?: string | null
          rota_id?: string | null
          updated_at?: string
          user_id: string
          veiculo_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inicio?: string
          mensagem?: string | null
          motivo?: string
          resolvido_em?: string | null
          retorno_previsto?: string | null
          rota_id?: string | null
          updated_at?: string
          user_id?: string
          veiculo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "veiculo_indisponibilidades_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "veiculo_indisponibilidades_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
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
          frotista_id: string | null
          id: string
          marca: string
          modelo: string
          placa: string
          renavam: string | null
          status_operacional: string
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
          frotista_id?: string | null
          id?: string
          marca?: string
          modelo?: string
          placa: string
          renavam?: string | null
          status_operacional?: string
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
          frotista_id?: string | null
          id?: string
          marca?: string
          modelo?: string
          placa?: string
          renavam?: string | null
          status_operacional?: string
          status_verificacao?: Database["public"]["Enums"]["status_verificacao"]
          updated_at?: string
          user_id?: string
          volume_bagageiro_l?: number
        }
        Relationships: [
          {
            foreignKeyName: "veiculos_frotista_id_fkey"
            columns: ["frotista_id"]
            isOneToOne: false
            referencedRelation: "frotistas"
            referencedColumns: ["id"]
          },
        ]
      }
      verificacoes_biometricas: {
        Row: {
          concluido_em: string | null
          created_at: string
          id: string
          imagem_hash: string | null
          imagem_path: string | null
          motivo: string | null
          pendencias: string[]
          perfil: string
          prova_vida: Json
          qualidade: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          concluido_em?: string | null
          created_at?: string
          id?: string
          imagem_hash?: string | null
          imagem_path?: string | null
          motivo?: string | null
          pendencias?: string[]
          perfil?: string
          prova_vida?: Json
          qualidade?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          concluido_em?: string | null
          created_at?: string
          id?: string
          imagem_hash?: string | null
          imagem_path?: string | null
          motivo?: string | null
          pendencias?: string[]
          perfil?: string
          prova_vida?: Json
          qualidade?: number
          status?: string
          updated_at?: string
          user_id?: string
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
      viagem_posicoes: {
        Row: {
          created_at: string
          id: string
          latitude: number
          longitude: number
          precisao_m: number | null
          registrado_em: string
          sequencia: number
          velocidade_kmh: number | null
          viagem_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          precisao_m?: number | null
          registrado_em?: string
          sequencia: number
          velocidade_kmh?: number | null
          viagem_id: string
        }
        Update: {
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          precisao_m?: number | null
          registrado_em?: string
          sequencia?: number
          velocidade_kmh?: number | null
          viagem_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viagem_posicoes_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "viagens"
            referencedColumns: ["id"]
          },
        ]
      }
      viagens: {
        Row: {
          concluida_em: string | null
          created_at: string
          data_viagem: string
          distancia_percorrida_km: number
          id: string
          iniciada_em: string | null
          motorista_id: string
          observacoes: string | null
          rota_id: string
          status: string
          ultima_latitude: number | null
          ultima_longitude: number | null
          ultima_posicao_em: string | null
          ultima_velocidade_kmh: number | null
          updated_at: string
          veiculo_id: string | null
          veiculo_substituto_placa: string | null
        }
        Insert: {
          concluida_em?: string | null
          created_at?: string
          data_viagem: string
          distancia_percorrida_km?: number
          id?: string
          iniciada_em?: string | null
          motorista_id: string
          observacoes?: string | null
          rota_id: string
          status?: string
          ultima_latitude?: number | null
          ultima_longitude?: number | null
          ultima_posicao_em?: string | null
          ultima_velocidade_kmh?: number | null
          updated_at?: string
          veiculo_id?: string | null
          veiculo_substituto_placa?: string | null
        }
        Update: {
          concluida_em?: string | null
          created_at?: string
          data_viagem?: string
          distancia_percorrida_km?: number
          id?: string
          iniciada_em?: string | null
          motorista_id?: string
          observacoes?: string | null
          rota_id?: string
          status?: string
          ultima_latitude?: number | null
          ultima_longitude?: number | null
          ultima_posicao_em?: string | null
          ultima_velocidade_kmh?: number | null
          updated_at?: string
          veiculo_id?: string | null
          veiculo_substituto_placa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "viagens_rota_id_fkey"
            columns: ["rota_id"]
            isOneToOne: false
            referencedRelation: "rotas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viagens_veiculo_id_fkey"
            columns: ["veiculo_id"]
            isOneToOne: false
            referencedRelation: "veiculos"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          corrida_id: string | null
          created_at: string
          description: string
          driver_id: string
          id: string
          payout_id: string | null
          status: Database["public"]["Enums"]["wallet_transaction_status"]
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          updated_at: string
          viagem_id: string | null
        }
        Insert: {
          amount: number
          corrida_id?: string | null
          created_at?: string
          description?: string
          driver_id: string
          id?: string
          payout_id?: string | null
          status?: Database["public"]["Enums"]["wallet_transaction_status"]
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          updated_at?: string
          viagem_id?: string | null
        }
        Update: {
          amount?: number
          corrida_id?: string | null
          created_at?: string
          description?: string
          driver_id?: string
          id?: string
          payout_id?: string | null
          status?: Database["public"]["Enums"]["wallet_transaction_status"]
          type?: Database["public"]["Enums"]["wallet_transaction_type"]
          updated_at?: string
          viagem_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_corrida_id_fkey"
            columns: ["corrida_id"]
            isOneToOne: false
            referencedRelation: "corridas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_payout_id_fkey"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "driver_payouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_viagem_id_fkey"
            columns: ["viagem_id"]
            isOneToOne: false
            referencedRelation: "viagens"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_eventos: {
        Row: {
          created_at: string
          evento_id: string
          id: string
          payload: Json
          provedor: string
          tipo: string | null
        }
        Insert: {
          created_at?: string
          evento_id: string
          id?: string
          payload?: Json
          provedor: string
          tipo?: string | null
        }
        Update: {
          created_at?: string
          evento_id?: string
          id?: string
          payload?: Json
          provedor?: string
          tipo?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      biometria_aprovada: { Args: { user_uuid: string }; Returns: boolean }
      calculate_default_trunk_route: {
        Args: { city_a_geom: unknown; city_b_geom: unknown }
        Returns: {
          destination_border_point: unknown
          destination_neighborhood: string
          distance_km: number
          origin_border_point: unknown
          origin_neighborhood: string
        }[]
      }
      cooperativa_do_motorista: { Args: { _user_id: string }; Returns: string }
      eh_admin_master: { Args: { _user_id: string }; Returns: boolean }
      eh_colaborador: { Args: { _user_id: string }; Returns: boolean }
      eh_frotista_da_rota: {
        Args: { _rota_id: string; _user_id: string }
        Returns: boolean
      }
      eh_gestao: { Args: { _user_id: string }; Returns: boolean }
      eh_responsavel_cooperativa: {
        Args: { _cooperativa_id: string; _user_id: string }
        Returns: boolean
      }
      frotista_id_do_usuario: { Args: { _user_id: string }; Returns: string }
      frotista_liberado: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      motorista_fase_liberada: {
        Args: { _fase: number; _user_id: string }
        Returns: boolean
      }
      motoristas_das_rotas: {
        Args: { _rota_ids: string[] }
        Returns: {
          media: number
          motorista_nome: string
          rota_id: string
          total: number
        }[]
      }
      pj_documento_ok: {
        Args: {
          _entidade_id: string
          _tipo_documento: string
          _tipo_entidade: string
        }
        Returns: boolean
      }
      pj_fase_liberada: {
        Args: { _entidade_id: string; _fase: number; _tipo_entidade: string }
        Returns: boolean
      }
      pode_ver_viagem: {
        Args: { _user_id: string; _viagem_id: string }
        Returns: boolean
      }
      promo_vagas_restantes: {
        Args: never
        Returns: {
          restantes: number
          uf: string
          usadas: number
        }[]
      }
      saida_protegida: {
        Args: { _data_viagem: string; _motorista_id: string; _rota_id: string }
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
      tem_plano_carteira_ativo: {
        Args: { _env?: string; _user_id: string }
        Returns: boolean
      }
      uf_valida: { Args: { _uf: string }; Returns: boolean }
    }
    Enums: {
      alvo_verificacao: "passageiro" | "motorista" | "veiculo"
      app_role:
        | "passageiro"
        | "motorista"
        | "admin"
        | "frotista"
        | "admin_secundario"
        | "gerente"
        | "operacional"
        | "cooperativa"
      driver_account_type: "CHECKING" | "SAVINGS"
      driver_payout_status:
        | "REQUESTED"
        | "PROCESSING"
        | "PAID"
        | "FAILED"
        | "CANCELED"
      driver_pix_key_type: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "RANDOM"
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
      wallet_transaction_status: "PENDING" | "COMPLETED" | "FAILED"
      wallet_transaction_type:
        | "RIDE_EARNING"
        | "PLATFORM_FEE"
        | "PAYOUT"
        | "BONUS"
        | "ADJUSTMENT"
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
      app_role: [
        "passageiro",
        "motorista",
        "admin",
        "frotista",
        "admin_secundario",
        "gerente",
        "operacional",
        "cooperativa",
      ],
      driver_account_type: ["CHECKING", "SAVINGS"],
      driver_payout_status: [
        "REQUESTED",
        "PROCESSING",
        "PAID",
        "FAILED",
        "CANCELED",
      ],
      driver_pix_key_type: ["CPF", "CNPJ", "EMAIL", "PHONE", "RANDOM"],
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
      wallet_transaction_status: ["PENDING", "COMPLETED", "FAILED"],
      wallet_transaction_type: [
        "RIDE_EARNING",
        "PLATFORM_FEE",
        "PAYOUT",
        "BONUS",
        "ADJUSTMENT",
      ],
    },
  },
} as const
