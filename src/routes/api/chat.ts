import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";

import {
  createLovableAiGatewayRunIdFetch,
  createLovableResponsesProvider,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";
import { PROMPT_ROTABOT, ferramentasRotaBot } from "@/lib/rotabot.server";

type CorpoChat = { messages?: unknown };

/** Só usuários autenticados consomem o gateway de IA (evita abuso de créditos). */
async function usuarioAutenticado(request: Request): Promise<string | null> {
  const cabecalho = request.headers.get("Authorization") ?? "";
  const token = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7).trim() : "";
  if (!token) return null;

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;

  const supabase = createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!(await usuarioAutenticado(request))) {
          return new Response("Entre na sua conta para conversar com o RotaBot.", { status: 401 });
        }

        const { messages } = (await request.json()) as CorpoChat;
        if (!Array.isArray(messages)) {
          return new Response("Mensagens obrigatórias", { status: 400 });
        }
        if (messages.length > 40) {
          return new Response("Conversa muito longa. Comece um novo atendimento.", { status: 413 });
        }

        const chave = process.env["LOVABLE_API_KEY"];
        if (!chave) {
          return new Response("Serviço de IA não configurado", { status: 500 });
        }


        const runIdInicial = getLovableAiGatewayRunId(request);
        const runIdFetch = createLovableAiGatewayRunIdFetch(runIdInicial);
        const gateway = createLovableResponsesProvider(chave, runIdFetch);

        const resultado = streamText({
          model: gateway.responses("openai/gpt-5.6-sol"),
          system: PROMPT_ROTABOT,
          messages: await convertToModelMessages(messages as UIMessage[]),
          tools: ferramentasRotaBot(),
          stopWhen: stepCountIs(50),
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        return withLovableAiGatewayRunIdHeader(
          resultado.toUIMessageStreamResponse({
            originalMessages: messages as UIMessage[],
            sendReasoning: true,
            onError: (erro) => {
              console.error("[rotabot] falha no stream", erro);
              const texto = erro instanceof Error ? erro.message : String(erro ?? "");
              if (/payment required|402/i.test(texto)) {
                return "Os créditos de IA da plataforma acabaram. Avise o administrador para recarregar — enquanto isso, fale com o suporte no WhatsApp.";
              }
              if (/rate limit|429/i.test(texto)) {
                return "Muitas conversas ao mesmo tempo. Tente novamente em alguns instantes.";
              }
              return "Não consegui responder agora. Tente novamente em instantes.";
            },

          }),
          runIdFetch,
        );

      },
    },
  },
});
