import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";

import {
  createLovableAiGatewayRunIdFetch,
  createLovableResponsesProvider,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";
import { PROMPT_ROTABOT, ferramentasRotaBot } from "@/lib/rotabot.server";

type CorpoChat = { messages?: unknown };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { messages } = (await request.json()) as CorpoChat;
        if (!Array.isArray(messages)) {
          return new Response("Mensagens obrigatórias", { status: 400 });
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
              return erro instanceof Error ? erro.message : "Falha ao responder.";
            },
          }),
          runIdFetch,
        );

      },
    },
  },
});
