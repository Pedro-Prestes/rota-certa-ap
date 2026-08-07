import { useId, useMemo, useState } from "react";
import { Check, Eye, EyeOff, X } from "lucide-react";

type Nivel = "fraca" | "moderada" | "forte";

export type ForcaSenha = {
  pontos: number;
  nivel: Nivel;
  requisitos: { rotulo: string; ok: boolean }[];
};

const ESPECIAIS = /[^A-Za-z0-9]/;

export function avaliarSenha(senha: string): ForcaSenha {
  const requisitos = [
    { rotulo: "Pelo menos 8 caracteres", ok: senha.length >= 8 },
    { rotulo: "Uma letra maiúscula (A-Z)", ok: /[A-Z]/.test(senha) },
    { rotulo: "Uma letra minúscula (a-z)", ok: /[a-z]/.test(senha) },
    { rotulo: "Um número (0-9)", ok: /[0-9]/.test(senha) },
    { rotulo: "Um caractere especial (! @ # $ % & * ?)", ok: ESPECIAIS.test(senha) },
  ];
  const pontos = requisitos.filter((r) => r.ok).length + (senha.length >= 12 ? 1 : 0);
  const nivel: Nivel = pontos >= 5 ? "forte" : pontos >= 3 ? "moderada" : "fraca";
  return { pontos, nivel, requisitos };
}

const CORES: Record<Nivel, { barra: string; texto: string }> = {
  fraca: { barra: "bg-destructive", texto: "text-destructive" },
  moderada: { barra: "bg-amber-500", texto: "text-amber-500" },
  forte: { barra: "bg-emerald-500", texto: "text-emerald-500" },
};

type Props = {
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  className?: string;
  minLength?: number;
  required?: boolean;
  autoComplete?: string;
  /** Mostra a barra de progresso e as sugestões (use no cadastro / nova senha). */
  mostrarForca?: boolean;
  id?: string;
};

export function CampoSenha({
  value,
  onChange,
  placeholder = "Senha",
  className,
  minLength,
  required,
  autoComplete,
  mostrarForca = false,
  id,
}: Props) {
  const [visivel, setVisivel] = useState(false);
  const gerado = useId();
  const campoId = id ?? gerado;
  const forca = useMemo(() => avaliarSenha(value), [value]);
  const cor = CORES[forca.nivel];
  const percentual = Math.min(100, Math.round((forca.pontos / 6) * 100));

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          id={campoId}
          className={`${className ?? ""} pr-12`}
          type={visivel ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          {...(minLength !== undefined ? { minLength } : {})}
          {...(required ? { required: true } : {})}
          {...(autoComplete ? { autoComplete } : {})}
        />
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visivel}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          {visivel ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      {mostrarForca && value.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Força da senha</span>
            <span className={`font-semibold capitalize ${cor.texto}`}>{forca.nivel}</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percentual}
            aria-label={`Força da senha: ${forca.nivel}`}
          >
            <div
              className={`h-full rounded-full transition-all ${cor.barra}`}
              style={{ width: `${Math.max(8, percentual)}%` }}
            />
          </div>
          <ul className="space-y-1">
            {forca.requisitos.map((r) => (
              <li
                key={r.rotulo}
                className={`flex items-center gap-2 text-xs ${
                  r.ok ? "text-emerald-500" : "text-muted-foreground"
                }`}
              >
                {r.ok ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                {r.rotulo}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
