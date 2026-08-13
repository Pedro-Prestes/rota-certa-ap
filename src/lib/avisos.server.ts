/**
 * Avisos multicanal do RotaCerta.
 *
 * Um mesmo aviso é entregue por todos os meios disponíveis: notificação no
 * app, SMS, WhatsApp (canal Twilio, quando configurado) e e-mail (Resend,
 * quando configurado). Nenhuma falha de canal interrompe o fluxo — o aviso no
 * app é sempre gravado e os demais canais são melhor-esforço.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface Aviso {
  userId: string;
  titulo: string;
  mensagem: string;
  tipo?: "info" | "sucesso" | "alerta" | "erro";
  /** Link absoluto ou caminho interno para a ação (pagar, ver saída). */
  link?: string | undefined;
}

const GATEWAY_TWILIO = "https://connector-gateway.lovable.dev/twilio";

async function contato(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("nome_completo, telefone")
    .eq("id", userId)
    .maybeSingle();
  let email: string | null = null;
  try {
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(userId);
    email = u.user?.email ?? null;
  } catch (e) {
    console.error("[avisos] não foi possível obter o e-mail do usuário:", e);
  }
  return { nome: data?.nome_completo ?? null, telefone: data?.telefone ?? null, email };
}

async function porSms(telefone: string, texto: string) {
  try {
    const { enviarSms, normalizarTelefone } = await import("./sms.server");
    const numero = normalizarTelefone(telefone);
    if (!numero) return false;
    await enviarSms(numero, texto);
    return true;
  } catch (e) {
    console.error("[avisos] SMS não enviado:", e);
    return false;
  }
}

async function porWhatsapp(telefone: string, texto: string) {
  const lovable = process.env["LOVABLE_API_KEY"];
  const twilio = process.env["TWILIO_API_KEY"] ?? process.env["TWILIO_AUTH_TOKEN"];
  const from = process.env["TWILIO_WHATSAPP_FROM"];
  if (!lovable || !twilio || !from) return false;
  try {
    const { normalizarTelefone } = await import("./sms.server");
    const numero = normalizarTelefone(telefone);
    if (!numero) return false;
    const res = await fetch(`${GATEWAY_TWILIO}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovable}`,
        "X-Connection-Api-Key": twilio,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: `whatsapp:${numero}`,
        From: from.startsWith("whatsapp:") ? from : `whatsapp:${from}`,
        Body: texto,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("[avisos] WhatsApp não enviado:", e);
    return false;
  }
}

async function porEmail(email: string, titulo: string, texto: string) {
  const chave = process.env["RESEND_API_KEY"];
  if (!chave) return false;
  const remetente =
    process.env["EMAIL_REMETENTE"] ?? "RotaCerta Brasil <rotacertabrasil@rotacertabrasil.com.br>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: remetente,
        to: [email],
        subject: titulo,
        text: texto,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("[avisos] e-mail não enviado:", e);
    return false;
  }
}

/** Entrega o aviso em todos os canais disponíveis e devolve o que foi usado. */
export async function avisarTodosOsCanais(aviso: Aviso) {
  const canais: string[] = [];

  const { error } = await supabaseAdmin.from("notificacoes").insert({
    user_id: aviso.userId,
    titulo: aviso.titulo,
    mensagem: aviso.link ? `${aviso.mensagem}\n${aviso.link}` : aviso.mensagem,
    tipo: aviso.tipo ?? "info",
  });
  if (error) console.error("[avisos] notificação no app falhou:", error.message);
  else canais.push("app");

  const { telefone, email } = await contato(aviso.userId);
  const texto = `${aviso.titulo}\n${aviso.mensagem}${aviso.link ? `\n${aviso.link}` : ""}`;

  const [sms, zap, mail] = await Promise.all([
    telefone ? porSms(telefone, texto) : Promise.resolve(false),
    telefone ? porWhatsapp(telefone, texto) : Promise.resolve(false),
    email ? porEmail(email, aviso.titulo, texto) : Promise.resolve(false),
  ]);
  if (sms) canais.push("sms");
  if (zap) canais.push("whatsapp");
  if (mail) canais.push("email");

  return { canais };
}
