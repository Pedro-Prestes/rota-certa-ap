import { Star } from "lucide-react";

/**
 * Selo com o nome do motorista e sua avaliação na escala de 1 a 5 estrelas,
 * no mesmo padrão adotado por 99 e Uber (média com uma casa decimal e o total
 * de avaliações). Motoristas ainda sem avaliação aparecem como "Novo".
 */
export interface ResumoMotorista {
  motorista_nome: string;
  media: number;
  total: number;
}

const CLASSIFICACAO: Array<{ min: number; rotulo: string }> = [
  { min: 4.9, rotulo: "Excelência" },
  { min: 4.7, rotulo: "Muito bem avaliado" },
  { min: 4.5, rotulo: "Bem avaliado" },
  { min: 4.0, rotulo: "Boa avaliação" },
];

export function rotuloAvaliacao(media: number, total: number) {
  if (total === 0) return "Novo na plataforma";
  return CLASSIFICACAO.find((c) => media >= c.min)?.rotulo ?? "Em observação";
}

export function AvaliacaoMotorista({
  resumo,
  compacto = false,
}: {
  resumo: ResumoMotorista | undefined;
  compacto?: boolean;
}) {
  if (!resumo) return null;
  const media = Number(resumo.media) || 0;
  const total = Number(resumo.total) || 0;
  const nota = media.toFixed(1).replace(".", ",");

  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <span className="font-semibold text-foreground">{resumo.motorista_nome}</span>
      {total > 0 ? (
        <>
          <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 font-semibold text-foreground">
            <Star className="size-3 fill-current text-accent" aria-hidden />
            {nota}
          </span>
          {!compacto && (
            <span className="text-muted-foreground">
              {total} avaliação{total === 1 ? "" : "ões"} · {rotuloAvaliacao(media, total)}
            </span>
          )}
        </>
      ) : (
        <span className="rounded-full border border-dashed border-border px-2 py-0.5 text-muted-foreground">
          Novo · sem avaliações
        </span>
      )}
    </span>
  );
}
