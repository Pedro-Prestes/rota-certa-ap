import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Loader2, ScanFace, X } from "lucide-react";
import { LIMITES, type ProvaVida } from "@/lib/biometria";

type Etapa = "preparo" | "piscada" | "movimento" | "captura" | "enviando";

const INSTRUCOES: Record<Etapa, string> = {
  preparo: "Centralize o rosto no círculo, sem óculos escuros, boné ou máscara.",
  piscada: "Olhe para a câmera e pisque algumas vezes.",
  movimento: "Vire o rosto lentamente para a esquerda e para a direita.",
  captura: "Fique parado — capturando a selfie final.",
  enviando: "Enviando para verificação…",
};

const L = 160;
const A = 120;

function cinza(d: Uint8ClampedArray) {
  const g = new Float32Array(L * A);
  for (let i = 0; i < g.length; i++) {
    g[i] = 0.299 * (d[i * 4] ?? 0) + 0.587 * (d[i * 4 + 1] ?? 0) + 0.114 * (d[i * 4 + 2] ?? 0);
  }
  return g;
}

function media(g: Float32Array) {
  let s = 0;
  for (let i = 0; i < g.length; i++) s += g[i] ?? 0;
  return s / g.length;
}

function nitidez(g: Float32Array) {
  let s = 0;
  let n = 0;
  for (let y = 1; y < A - 1; y++) {
    for (let x = 1; x < L - 1; x++) {
      const i = y * L + x;
      const lap =
        4 * (g[i] ?? 0) - (g[i - 1] ?? 0) - (g[i + 1] ?? 0) - (g[i - L] ?? 0) - (g[i + L] ?? 0);
      s += Math.abs(lap);
      n++;
    }
  }
  return s / Math.max(1, n);
}

function difRegiao(a: Float32Array, b: Float32Array, região: [number, number, number, number]) {
  const [x0, y0, x1, y1] = região;
  let s = 0;
  let n = 0;
  for (let y = Math.floor(y0 * A); y < Math.floor(y1 * A); y++) {
    for (let x = Math.floor(x0 * L); x < Math.floor(x1 * L); x++) {
      const i = y * L + x;
      s += Math.abs((a[i] ?? 0) - (b[i] ?? 0));
      n++;
    }
  }
  return s / Math.max(1, n);
}

export function CapturaFacial({
  perfil,
  onEnviar,
  onFechar,
}: {
  perfil: "passageiro" | "motorista";
  onEnviar: (imagem: string, provaVida: ProvaVida) => Promise<void>;
  onFechar: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("preparo");
  const [erro, setErro] = useState<string | null>(null);
  const [progresso, setProgresso] = useState(0);
  const dados = useRef<ProvaVida>({
    rostoDetectado: false,
    piscada: 0,
    movimento: 0,
    nitidez: 0,
    luminosidade: 0,
    quadros: 0,
  });

  const capturarQuadro = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, L, A);
    return cinza(ctx.getImageData(0, 0, L, A).data);
  }, []);

  const selfieFinal = useCallback(() => {
    const video = videoRef.current;
    if (!video) return null;
    const largura = 640;
    const altura = Math.round((video.videoHeight / (video.videoWidth || 1)) * largura) || 480;
    const c = document.createElement("canvas");
    c.width = largura;
    c.height = altura;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, largura, altura);
    return c.toDataURL("image/jpeg", 0.86);
  }, []);

  useEffect(() => {
    let parado = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function detectarRosto(): Promise<boolean> {
      const Detector = (window as unknown as { FaceDetector?: new () => { detect: (v: unknown) => Promise<unknown[]> } })
        .FaceDetector;
      if (!Detector || !videoRef.current) return false;
      try {
        const rostos = await new Detector().detect(videoRef.current);
        return rostos.length > 0;
      } catch {
        return false;
      }
    }

    async function fluxo() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 } },
          audio: false,
        });
      } catch {
        setErro("Não foi possível acessar a câmera. Autorize o uso e tente novamente.");
        return;
      }
      if (parado) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      await new Promise((r) => setTimeout(r, 1200));
      dados.current.rostoDetectado = await detectarRosto();

      const desafios: { etapa: Etapa; regiao: [number, number, number, number]; campo: "piscada" | "movimento" }[] = [
        { etapa: "piscada", regiao: [0.28, 0.22, 0.72, 0.48], campo: "piscada" },
        { etapa: "movimento", regiao: [0.1, 0.1, 0.9, 0.9], campo: "movimento" },
      ];

      for (const desafio of desafios) {
        if (parado) return;
        setEtapa(desafio.etapa);
        setProgresso(0);
        let anterior = capturarQuadro();
        let maior = 0;
        const inicio = Date.now();
        await new Promise<void>((resolve) => {
          timer = setInterval(() => {
            if (parado) return resolve();
            const atual = capturarQuadro();
            if (atual) {
              dados.current.quadros += 1;
              if (anterior) maior = Math.max(maior, difRegiao(anterior, atual, desafio.regiao));
              anterior = atual;
            }
            const decorrido = Date.now() - inicio;
            setProgresso(Math.min(100, Math.round((decorrido / 5000) * 100)));
            if (decorrido >= 5000) {
              if (timer) clearInterval(timer);
              resolve();
            }
          }, 120);
        });
        dados.current[desafio.campo] = Number(maior.toFixed(2));
      }

      if (parado) return;
      setEtapa("captura");
      await new Promise((r) => setTimeout(r, 700));
      const quadro = capturarQuadro();
      if (quadro) {
        dados.current.nitidez = Number(nitidez(quadro).toFixed(2));
        dados.current.luminosidade = Number(media(quadro).toFixed(2));
      }
      if (!dados.current.rostoDetectado) dados.current.rostoDetectado = await detectarRosto();
      const imagem = selfieFinal();
      if (!imagem) {
        setErro("Não conseguimos capturar a imagem. Tente novamente.");
        return;
      }
      setEtapa("enviando");
      await onEnviar(imagem, { ...dados.current });
    }

    void fluxo();
    return () => {
      parado = true;
      if (timer) clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-foreground/60 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-2xl border border-border bg-background p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ScanFace className="size-4" />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold">
              Biometria facial — {perfil === "motorista" ? "motorista" : "passageiro"}
            </h2>
            <p className="text-xs text-muted-foreground">
              Prova de vida com piscada e movimento. A imagem fica em armazenamento privado.
            </p>
          </div>
          <button
            onClick={onFechar}
            className="ml-auto rounded-full border border-border p-2"
            aria-label="Cancelar biometria"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="relative mt-5 overflow-hidden rounded-2xl bg-secondary">
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-[4/3] w-full scale-x-[-1] object-cover"
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="aspect-square h-[78%] rounded-full border-4 border-primary/70" />
          </div>
        </div>
        <canvas ref={canvasRef} width={L} height={A} className="hidden" />

        {erro ? (
          <p className="mt-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{erro}</p>
        ) : (
          <>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold">
              {etapa === "enviando" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : etapa === "captura" ? (
                <CheckCircle2 className="size-4 text-success" />
              ) : (
                <Camera className="size-4" />
              )}
              {INSTRUCOES[etapa]}
            </p>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${etapa === "preparo" ? 5 : progresso}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              São necessários pelo menos {LIMITES.quadrosMin} quadros válidos, boa iluminação e os
              dois desafios concluídos para aprovação automática.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
