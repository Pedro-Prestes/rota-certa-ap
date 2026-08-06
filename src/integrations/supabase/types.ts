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
          proxima_cobranca?: string
          status?: string
          tentativas?: number
          updated_at?: string
          user_id?: string
          valor_mensal?: number
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
          cnpj: string
          created_at: string
          email_contato: string | null
          id: string
          municipio: string | null
          nome_fantasia: string | null
          razao_social: string
          responsavel_nome: string
          status: string
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cnpj: string
          created_at?: string
          email_contato?: string | null
          id?: string
          municipio?: string | null
          nome_fantasia?: string | null
          razao_social: string
          responsavel_nome: string
          status?: string
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cnpj?: string
          created_at?: string
          email_contato?: string | null
          id?: string
          municipio?: string | null
          nome_fantasia?: string | null
          razao_social?: string
          responsavel_nome?: string
          status?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      biometria_aprovada: { Args: { user_uuid: string }; Returns: boolean }
      eh_admin_master: { Args: { _user_id: string }; Returns: boolean }
      eh_colaborador: { Args: { _user_id: string }; Returns: boolean }
      eh_frotista_da_rota: {
        Args: { _rota_id: string; _user_id: string }
        Returns: boolean
      }
      eh_gestao: { Args: { _user_id: string }; Returns: boolean }
      frotista_id_do_usuario: { Args: { _user_id: string }; Returns: string }
      frotista_liberado: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      pode_ver_viagem: {
        Args: { _user_id: string; _viagem_id: string }
        Returns: boolean
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
      app_role: [
        "passageiro",
        "motorista",
        "admin",
        "frotista",
        "admin_secundario",
        "gerente",
        "operacional",
      ],
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
