import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Compass, X } from "lucide-react";
import { useAcesso } from "@/hooks/use-auth";
import { EVENTO_ABRIR_TOUR, chaveTour, roteiroPara, type PassoTour } from "@/lib/tour";

interface Caixa {
  top: number;
  left: number;
  width: number;
  height: number;
}

const MARGEM = 10;
const LARGURA_BALAO = 340;

/** Tour guiado de acesso: destaca elementos reais da tela conforme o perfil. */
export function TourGuiado() {
  const { user, perfis, carregando } = useAcesso();
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });

  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(0);
  const [alvo, setAlvo] = useState<Caixa | null>(null);
  const balaoRef = useRef<HTMLDivElement>(null);

  const roteiro = roteiroPara(!!user, perfis);
  const passos = roteiro.passos;
  const passo: PassoTour | undefined = passos[indice];

  // Concluir ou pular marca o tour como visto — não reaparece sozinho.
  const encerrar = useCallback(() => {
    setAberto(false);
    setIndice(0);
    try {
      window.localStorage.setItem(chaveTour(roteiro.chave), "1");
    } catch {
      /* armazenamento indisponível: apenas não memoriza */
    }
  }, [roteiro.chave]);

  // Primeira exibição automática (uma vez por perfil).
  useEffect(() => {
    if (carregando) return;
    let visto = "1";
    try {
      visto = window.localStorage.getItem(chaveTour(roteiro.chave)) ?? "";
    } catch {
      visto = "1";
    }
    if (!visto) {
      setIndice(0);
      setAberto(true);
    }
  }, [carregando, roteiro.chave]);

  // Reabertura manual.
  useEffect(() => {
    const abrir = () => {
      setIndice(0);
      setAberto(true);
    };
    window.addEventListener(EVENTO_ABRIR_TOUR, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR_TOUR, abrir);
  }, []);

  // Navega até a rota do passo atual.
  useEffect(() => {
    if (!aberto || !passo?.rota || passo.rota === path) return;
    navigate({ to: passo.rota });
  }, [aberto, passo?.rota, path, navigate]);

  // Mede o elemento destacado.
  useLayoutEffect(() => {
    if (!aberto) return;
    let ativo = true;
    const medir = () => {
      if (!ativo) return;
      if (!passo?.alvo) {
        setAlvo(null);
        return;
      }
      const el = document.querySelector(passo.alvo) as HTMLElement | null;
      if (!el) {
        setAlvo(null);
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        setAlvo(null);
        return;
      }
      setAlvo({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    medir();
    const t = window.setTimeout(medir, 250);
    window.addEventListener("resize", medir);
    window.addEventListener("scroll", medir, true);
    return () => {
      ativo = false;
      window.clearTimeout(t);
      window.removeEventListener("resize", medir);
      window.removeEventListener("scroll", medir, true);
    };
  }, [aberto, indice, passo?.alvo, path]);

  useEffect(() => {
    if (!aberto) return;
    balaoRef.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") encerrar(false);
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [aberto, indice, encerrar]);

  if (!aberto || !passo) return null;

  const ultimo = indice === passos.length - 1;
  const larguraJanela = typeof window === "undefined" ? 1024 : window.innerWidth;
  const alturaJanela = typeof window === "undefined" ? 768 : window.innerHeight;
  const largura = Math.min(LARGURA_BALAO, larguraJanela - 2 * MARGEM);

  let estiloBalao: React.CSSProperties = {
    width: largura,
    left: (larguraJanela - largura) / 2,
    top: Math.max(MARGEM, alturaJanela / 2 - 140),
  };

  if (alvo) {
    const abaixo = alvo.top + alvo.height + 220 < alturaJanela;
    const top = abaixo ? alvo.top + alvo.height + 14 : Math.max(MARGEM, alvo.top - 234);
    const left = Math.min(
      Math.max(MARGEM, alvo.left + alvo.width / 2 - largura / 2),
      larguraJanela - largura - MARGEM,
    );
    estiloBalao = { width: largura, left, top };
  }

  return (
    <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label={roteiro.titulo}>
      {alvo ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary transition-all duration-200"
          style={{
            top: alvo.top - 6,
            left: alvo.left - 6,
            width: alvo.width + 12,
            height: alvo.height + 12,
            boxShadow: "0 0 0 9999px oklch(0.2 0.02 250 / 0.62)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-foreground/60" onClick={() => encerrar(false)} />
      )}

      <div
        ref={balaoRef}
        tabIndex={-1}
        className="absolute animate-scale-in rounded-2xl border border-border bg-card p-5 shadow-xl outline-none"
        style={estiloBalao}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
            <Compass className="size-3.5" /> {roteiro.titulo} · {indice + 1}/{passos.length}
          </span>
          <button
            type="button"
            onClick={() => encerrar(false)}
            aria-label="Fechar tour"
            className="rounded-full p-1 text-muted-foreground hover:bg-secondary"
          >
            <X className="size-4" />
          </button>
        </div>

        <h2 className="mt-3 font-display text-lg font-bold leading-tight">{passo.titulo}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">{passo.texto}</p>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => encerrar(false)}
            className="rounded-full px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-secondary"
          >
            Pular tour
          </button>
          <div className="flex items-center gap-2">
            {indice > 0 && (
              <button
                type="button"
                onClick={() => setIndice((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-semibold"
              >
                <ArrowLeft className="size-3.5" /> Voltar
              </button>
            )}
            <button
              type="button"
              onClick={() => (ultimo ? encerrar(true) : setIndice((i) => i + 1))}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground"
            >
              {ultimo ? "Concluir" : "Próximo"} <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
