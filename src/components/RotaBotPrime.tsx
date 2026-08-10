import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import { Bot, Loader2, Send, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const SUGESTOES = [
  "Quais rotas saem hoje do Amapá?",
  "Quanto custa um assento de 300 km?",
  "Minha mala de 60x40x30 cabe na franquia?",
  "Como funciona a assinatura pelo Pix?",
];

const ROTULO_FERRAMENTA: Record<string, string> = {
  buscar_rotas: "Consultando rotas ofertadas",
  consultar_planos: "Verificando planos e taxas",
  estimar_tarifa: "Calculando a tarifa do trecho",
  avaliar_bagagem: "Medindo o volume da bagagem",
  falar_com_atendente: "Preparando o transbordo humano",
};

function Bolha({ minha, children }: { minha: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex", minha ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          minha
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-secondary text-foreground",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function RotaBotPrime() {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const fim = useRef<HTMLDivElement>(null);

  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat" }), []);
  const { messages, sendMessage, status, error } = useChat({ transport });

  const carregando = status === "submitted" || status === "streaming";

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const enviar = (valor: string) => {
    const limpo = valor.trim();
    if (!limpo || carregando) return;
    setTexto("");
    void sendMessage({ text: limpo });
  };

  return (
    <>
      {!aberto && (
        <button
          type="button"
          onClick={() => setAberto(true)}
          aria-label="Abrir o RotaBot Prime, assistente de IA"
          className="fixed bottom-24 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105 sm:bottom-6 sm:right-24"
        >
          <Sparkles className="size-5" />
          <span className="hidden sm:inline">RotaBot Prime</span>
        </button>
      )}

      {aberto && (
        <div className="fixed inset-x-2 bottom-2 z-50 flex h-[80vh] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:h-[600px] sm:w-[400px]">
          <header className="flex items-center gap-3 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary-foreground/15">
              <Bot className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">RotaBot Prime</p>
              <p className="truncate text-xs opacity-80">IA oficial da Rota Certa Brasil</p>
            </div>
            <button type="button" onClick={() => setAberto(false)} aria-label="Fechar o chat">
              <X className="size-5" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <Bolha minha={false}>
                  Olá! 👋 Sou o **RotaBot Prime**. Consulto rotas ofertadas, calculo tarifa e bagagem
                  e explico planos e pagamentos. Como posso ajudar?
                </Bolha>
                <div className="flex flex-wrap gap-2">
                  {SUGESTOES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => enviar(s)}
                      className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m) => {
              const minha = m.role === "user";
              const textos = m.parts
                .filter((p) => p.type === "text")
                .map((p) => ("text" in p ? p.text : ""))
                .join("");
              const raciocinio = m.parts
                .filter((p) => p.type === "reasoning")
                .map((p) => ("text" in p ? p.text : ""))
                .join(" ")
                .trim();
              const ferramentas = m.parts
                .filter((p) => p.type.startsWith("tool-"))
                .map((p) => p.type.replace("tool-", ""));

              return (
                <div key={m.id} className="space-y-1.5">
                  {!minha && ferramentas.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {ferramentas.map((f, i) => (
                        <span
                          key={`${f}-${i}`}
                          className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent-foreground"
                        >
                          {ROTULO_FERRAMENTA[f] ?? f}
                        </span>
                      ))}
                    </div>
                  )}
                  {!minha && !textos && raciocinio && (
                    <p className="px-1 text-[11px] italic text-muted-foreground">{raciocinio}</p>
                  )}
                  {textos && (
                    <Bolha minha={minha}>
                      {minha ? (
                        textos
                      ) : (
                        <div className="space-y-2 [&_a]:underline [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold">
                          <ReactMarkdown>{textos}</ReactMarkdown>
                        </div>
                      )}
                    </Bolha>
                  )}
                </div>
              );
            })}

            {carregando && (
              <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> RotaBot está pensando…
              </div>
            )}

            {error && (
              <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error.message || "Não consegui responder agora. Tente novamente em instantes."}
              </p>
            )}


            <div ref={fim} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar(texto);
            }}
            className="flex items-center gap-2 border-t border-border px-3 py-3"
          >
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder="Pergunte sobre rotas, preços ou planos…"
              className="h-10"
            />
            <Button type="submit" size="icon" className="size-10 shrink-0" disabled={carregando || !texto.trim()}>
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
