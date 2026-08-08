import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  OTP_MAX_TENTATIVAS,
  OTP_VALIDADE_MINUTOS,
  enviarSms,
  gerarCodigo,
  hashCodigo,
  normalizarTelefone,
} from "./sms.server";

export type PerfilCadastro = "passageiro" | "motorista" | "frotista";

/** Telefone já vinculado a alguma conta? */
export async function telefoneJaCadastrado(telefone: string) {
  const { data } = await supabaseAdmin.from("profiles").select("id, telefone");
  return (data ?? []).some((p) => p.telefone && normalizarTelefone(p.telefone) === telefone);
}

/** Gera, guarda e envia um código de 6 dígitos, com limite por telefone. */
export async function emitirCodigo(telefone: string) {
  const desde = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("codigos_sms")
    .select("id", { count: "exact", head: true })
    .eq("telefone", telefone)
    .gte("created_at", desde);
  if ((count ?? 0) >= 3) throw new Error("Muitos códigos solicitados. Aguarde alguns minutos.");

  const codigo = gerarCodigo();
  await supabaseAdmin.from("codigos_sms").insert({
    telefone,
    codigo_hash: await hashCodigo(telefone, codigo),
    expira_em: new Date(Date.now() + OTP_VALIDADE_MINUTOS * 60 * 1000).toISOString(),
  });
  await enviarSms(
    telefone,
    `RotaCerta: seu código de cadastro é ${codigo}. Válido por ${OTP_VALIDADE_MINUTOS} minutos.`,
  );
}

/** Valida o último código emitido para o telefone e o marca como usado. */
export async function consumirCodigo(telefone: string, codigo: string) {
  const { data: registro } = await supabaseAdmin
    .from("codigos_sms")
    .select("id, codigo_hash, expira_em, tentativas, usado")
    .eq("telefone", telefone)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!registro || registro.usado) throw new Error("Solicite um novo código.");
  if (new Date(registro.expira_em).getTime() < Date.now()) {
    throw new Error("Código expirado. Solicite um novo.");
  }
  if (registro.tentativas >= OTP_MAX_TENTATIVAS) {
    throw new Error("Muitas tentativas. Solicite um novo código.");
  }
  const esperado = await hashCodigo(telefone, codigo);
  if (esperado !== registro.codigo_hash) {
    await supabaseAdmin
      .from("codigos_sms")
      .update({ tentativas: registro.tentativas + 1 })
      .eq("id", registro.id);
    throw new Error("Código incorreto.");
  }
  await supabaseAdmin.from("codigos_sms").update({ usado: true }).eq("id", registro.id);
}

/**
 * Cria a conta com o telefone já verificado. O e-mail é opcional: sem ele
 * usamos um endereço técnico derivado do número, que o usuário pode trocar
 * depois na área da conta.
 */
export async function criarContaVerificada(params: {
  telefone: string;
  nome: string;
  municipio: string;
  uf?: string | null;
  perfil: PerfilCadastro;
  email?: string;
}) {
  const email =
    params.email?.trim().toLowerCase() ||
    `tel${params.telefone.replace(/\D/g, "")}@telefone.rotacerta.app`;

  const { data: criado, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    phone: params.telefone,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: {
      nome_completo: params.nome,
      telefone: params.telefone,
      municipio: params.municipio,
      uf: params.uf ?? null,
      perfil: params.perfil,
    },
  });
  if (error || !criado.user) {
    throw new Error(
      /already/i.test(error?.message ?? "")
        ? "Já existe uma conta com este e-mail ou telefone."
        : (error?.message ?? "Não foi possível criar a conta."),
    );
  }

  const { data: link, error: erroLink } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (erroLink || !link.properties?.hashed_token) {
    console.error("[cadastro-telefone] falha ao gerar sessão", erroLink);
    throw new Error("Conta criada, mas o acesso automático falhou. Entre com código por SMS.");
  }
  return { tokenHash: link.properties.hashed_token, email };
}
