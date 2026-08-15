/**
 * Liberação manual do credenciamento do motorista pelo administrador master.
 *
 * Permite autorizar a operação de um motorista mesmo com as fases 1, 2 e 3
 * (idoneidade/biometria, CNH e veículo) irregulares. Toda decisão é auditada
 * na cadeia de blocos.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { registrarEvento } from "./blockchain.server";

export interface FasesLiberadas {
  fase1: boolean;
  fase2: boolean;
  fase3: boolean;
}

export interface MotoristaLiberacao {
  user_id: string;
  nome: string;
  email: string;
  liberacao: (FasesLiberadas & { motivo: string; created_at: string }) | null;
}

async function exigirMaster(userId: string) {
  const { data } = await supabaseAdmin.rpc("eh_admin_master", { _user_id: userId });
  if (!data) throw new Error("Apenas o administrador master pode liberar o credenciamento.");
}

async function emails(ids: string[]) {
  const mapa = new Map<string, string>();
  const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  for (const u of data?.users ?? []) {
    if (ids.includes(u.id)) mapa.set(u.id, u.email ?? "");
  }
  return mapa;
}

/** Motoristas cadastrados com a situação da liberação manual. */
export async function listarMotoristasLiberacao(
  adminId: string,
  termo?: string,
): Promise<MotoristaLiberacao[]> {
  await exigirMaster(adminId);

  const { data: papeis } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .in("role", ["motorista", "frotista"]);
  const ids = [...new Set((papeis ?? []).map((p) => p.user_id))];
  if (!ids.length) return [];

  const [perfis, liberacoes, mapaEmails] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, nome_completo").in("id", ids),
    supabaseAdmin
      .from("credenciamento_liberacoes")
      .select("user_id, fase1, fase2, fase3, motivo, created_at, revogado_em")
      .in("user_id", ids)
      .is("revogado_em", null),
    emails(ids),
  ]);

  const nome = new Map((perfis.data ?? []).map((p) => [p.id, p.nome_completo || ""]));
  const lib = new Map((liberacoes.data ?? []).map((l) => [l.user_id, l]));
  const busca = (termo ?? "").trim().toLowerCase();

  return ids
    .map((id) => {
      const l = lib.get(id);
      return {
        user_id: id,
        nome: nome.get(id) || "Motorista",
        email: mapaEmails.get(id) ?? "",
        liberacao: l
          ? {
              fase1: !!l.fase1,
              fase2: !!l.fase2,
              fase3: !!l.fase3,
              motivo: l.motivo,
              created_at: l.created_at,
            }
          : null,
      };
    })
    .filter(
      (m) =>
        !busca ||
        m.nome.toLowerCase().includes(busca) ||
        m.email.toLowerCase().includes(busca),
    )
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Ativa o credenciamento do motorista nas fases escolhidas. */
export async function liberarCredenciamento(params: {
  adminId: string;
  userId: string;
  fases: FasesLiberadas;
  motivo: string;
}) {
  await exigirMaster(params.adminId);
  const motivo = params.motivo.trim();
  if (motivo.length < 10) throw new Error("Descreva o motivo da liberação (mínimo 10 caracteres).");
  if (!params.fases.fase1 && !params.fases.fase2 && !params.fases.fase3) {
    throw new Error("Selecione ao menos uma fase para liberar.");
  }

  const { error } = await supabaseAdmin.from("credenciamento_liberacoes").upsert(
    {
      user_id: params.userId,
      fase1: params.fases.fase1,
      fase2: params.fases.fase2,
      fase3: params.fases.fase3,
      motivo,
      liberado_por: params.adminId,
      revogado_em: null,
      revogado_por: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(error.message);

  await registrarEvento({
    evento: "liberacao_credenciamento_master",
    registradoPor: params.adminId,
    dados: { motorista: params.userId, ...params.fases, motivo },
  });

  return { ok: true };
}

/** Revoga a liberação manual, voltando às regras normais das 3 fases. */
export async function revogarLiberacao(params: { adminId: string; userId: string }) {
  await exigirMaster(params.adminId);

  const { error } = await supabaseAdmin
    .from("credenciamento_liberacoes")
    .update({
      revogado_em: new Date().toISOString(),
      revogado_por: params.adminId,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId)
    .is("revogado_em", null);
  if (error) throw new Error(error.message);

  await registrarEvento({
    evento: "revogacao_liberacao_credenciamento",
    registradoPor: params.adminId,
    dados: { motorista: params.userId },
  });

  return { ok: true };
}
