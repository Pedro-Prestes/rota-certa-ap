// Server-only helpers for phone (SMS) one-time codes via Twilio connector gateway.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
const VALIDADE_MINUTOS = 10;
const MAX_TENTATIVAS = 5;

export const OTP_VALIDADE_MINUTOS = VALIDADE_MINUTOS;
export const OTP_MAX_TENTATIVAS = MAX_TENTATIVAS;

/** Normaliza um telefone brasileiro para o formato E.164 (+55...). */
export function normalizarTelefone(bruto: string): string | null {
  const digitos = (bruto || "").replace(/\D/g, "");
  if (!digitos) return null;
  let n = digitos;
  if (n.startsWith("0")) n = n.replace(/^0+/, "");
  if (!n.startsWith("55")) n = `55${n}`;
  // 55 + DDD(2) + numero(8 ou 9)
  if (n.length < 12 || n.length > 13) return null;
  return `+${n}`;
}

export function gerarCodigo(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + ((bytes[0] ?? 0) % 900000));
}

export async function hashCodigo(telefone: string, codigo: string): Promise<string> {
  const dados = new TextEncoder().encode(`${telefone}:${codigo}:rotaviva`);
  const digest = await crypto.subtle.digest("SHA-256", dados);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function credenciais() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const twilioKey = process.env["TWILIO_API_KEY"];
  if (!lovableKey || !twilioKey) {
    throw new Error("Serviço de SMS indisponível no momento.");
  }
  return { lovableKey, twilioKey };
}

let remetenteCache: string | null = null;

async function obterRemetente(): Promise<string> {
  const configurado = process.env["TWILIO_FROM_NUMBER"];
  if (configurado) return configurado;
  if (remetenteCache) return remetenteCache;

  const { lovableKey, twilioKey } = credenciais();
  const resposta = await fetch(`${GATEWAY_URL}/IncomingPhoneNumbers.json?PageSize=1`, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": twilioKey,
    },
  });
  const corpo = await resposta.text();
  if (!resposta.ok) {
    console.error(`[twilio] falha ao listar números [${resposta.status}]: ${corpo}`);
    throw new Error("Não foi possível identificar o número remetente de SMS.");
  }
  const json = JSON.parse(corpo) as { incoming_phone_numbers?: { phone_number: string }[] };
  const numero = json.incoming_phone_numbers?.[0]?.phone_number;
  if (!numero) throw new Error("Nenhum número de SMS disponível na conta Twilio.");
  remetenteCache = numero;
  return numero;
}

export async function enviarSms(para: string, texto: string): Promise<void> {
  const { lovableKey, twilioKey } = credenciais();
  const from = await obterRemetente();

  const resposta = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": twilioKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: para, From: from, Body: texto }),
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    console.error(`[twilio] falha ao enviar SMS [${resposta.status}]: ${corpo}`);
    throw new Error("Não foi possível enviar o SMS. Confira o número e tente novamente.");
  }
}
