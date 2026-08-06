import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const enviarSchema = z.object({ telefone: z.string().min(8).max(24) });
const verificarSchema = z.object({
  telefone: z.string().min(8).max(24),
  codigo: z.string().regex(/^\d{6}$/, "Código inválido"),
});

/** Envia um código de 6 dígitos por SMS para o telefone cadastrado no perfil. */
export const enviarCodigoSms = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => enviarSchema.parse(data))
  .handler(async ({ data }) => {
    const {
      normalizarTelefone,
      gerarCodigo,
      hashCodigo,
      enviarSms,
      OTP_VALIDADE_MINUTOS,
    } = await import("@/lib/sms.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const telefone = normalizarTelefone(data.telefone);
    if (!telefone) throw new Error("Telefone inválido. Use DDD + número.");

    const { data: perfis } = await supabaseAdmin
      .from("profiles")
      .select("id, telefone");
    const encontrado = (perfis ?? []).find(
      (p) => p.telefone && normalizarTelefone(p.telefone) === telefone,
    );
    // Resposta neutra: não revelamos se o número existe.
    if (!encontrado) return { enviado: true };

    // Limite simples: no máximo 3 códigos por telefone a cada 15 minutos.
    const desde = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await supabaseAdmin
      .from("codigos_sms")
      .select("id", { count: "exact", head: true })
      .eq("telefone", telefone)
      .gte("created_at", desde);
    if ((count ?? 0) >= 3) {
      throw new Error("Muitos códigos solicitados. Aguarde alguns minutos.");
    }

    const codigo = gerarCodigo();
    await supabaseAdmin.from("codigos_sms").insert({
      telefone,
      codigo_hash: await hashCodigo(telefone, codigo),
      expira_em: new Date(Date.now() + OTP_VALIDADE_MINUTOS * 60 * 1000).toISOString(),
    });

    await enviarSms(
      telefone,
      `RotaCerta: seu código de acesso é ${codigo}. Válido por ${OTP_VALIDADE_MINUTOS} minutos.`,
    );

    return { enviado: true };
  });

/** Valida o código e devolve um token de sessão de uso único. */
export const verificarCodigoSms = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => verificarSchema.parse(data))
  .handler(async ({ data }) => {
    const { normalizarTelefone, hashCodigo, OTP_MAX_TENTATIVAS } = await import(
      "@/lib/sms.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const telefone = normalizarTelefone(data.telefone);
    if (!telefone) throw new Error("Telefone inválido.");

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

    const esperado = await hashCodigo(telefone, data.codigo);
    if (esperado !== registro.codigo_hash) {
      await supabaseAdmin
        .from("codigos_sms")
        .update({ tentativas: registro.tentativas + 1 })
        .eq("id", registro.id);
      throw new Error("Código incorreto.");
    }

    await supabaseAdmin.from("codigos_sms").update({ usado: true }).eq("id", registro.id);

    const { data: perfis } = await supabaseAdmin.from("profiles").select("id, telefone");
    const perfil = (perfis ?? []).find(
      (p) => p.telefone && normalizarTelefone(p.telefone) === telefone,
    );
    if (!perfil) throw new Error("Nenhuma conta encontrada para este telefone.");

    const { data: usuario } = await supabaseAdmin.auth.admin.getUserById(perfil.id);
    const email = usuario.user?.email;
    if (!email) throw new Error("Conta sem e-mail associado.");

    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (error || !link.properties?.hashed_token) {
      console.error("[sms] falha ao gerar sessão", error);
      throw new Error("Não foi possível concluir o acesso.");
    }

    return { tokenHash: link.properties.hashed_token, email };
  });

const cadastroEnvioSchema = z.object({ telefone: z.string().min(8).max(24) });
const cadastroSchema = z.object({
  telefone: z.string().min(8).max(24),
  codigo: z.string().regex(/^\d{6}$/, "Código inválido"),
  nome: z.string().trim().min(3).max(120),
  municipio: z.string().trim().max(120).optional().default(""),
  perfil: z.enum(["passageiro", "motorista", "frotista"]),
  email: z.string().trim().email().max(255).optional(),
});

/** Envia o código de verificação para um novo cadastro por telefone. */
export const enviarCodigoCadastro = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => cadastroEnvioSchema.parse(data))
  .handler(async ({ data }) => {
    const { normalizarTelefone } = await import("@/lib/sms.server");
    const { telefoneJaCadastrado, emitirCodigo } = await import("@/lib/cadastro-telefone.server");

    const telefone = normalizarTelefone(data.telefone);
    if (!telefone) throw new Error("Telefone inválido. Use DDD + número.");
    if (await telefoneJaCadastrado(telefone)) {
      throw new Error("Este telefone já tem conta. Use “Entrar com código por SMS”.");
    }
    await emitirCodigo(telefone);
    return { enviado: true };
  });

/** Cria a conta (passageiro, motorista ou frotista) após validar o código do SMS. */
export const criarContaPorTelefone = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => cadastroSchema.parse(data))
  .handler(async ({ data }) => {
    const { normalizarTelefone } = await import("@/lib/sms.server");
    const { telefoneJaCadastrado, consumirCodigo, criarContaVerificada } = await import(
      "@/lib/cadastro-telefone.server"
    );

    const telefone = normalizarTelefone(data.telefone);
    if (!telefone) throw new Error("Telefone inválido.");
    if (await telefoneJaCadastrado(telefone)) {
      throw new Error("Este telefone já tem conta. Use “Entrar com código por SMS”.");
    }
    await consumirCodigo(telefone, data.codigo);
    return await criarContaVerificada({
      telefone,
      nome: data.nome,
      municipio: data.municipio ?? "",
      perfil: data.perfil,
      ...(data.email ? { email: data.email } : {}),
    });
  });
