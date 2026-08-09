import { useMemo, useState, type ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { useAcesso } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const WHATSAPP_NUMERO = "5596984095871";

export const TIPOS_PROBLEMA = [
  "Dúvida sobre a plataforma",
  "Pagamento ou Pix",
  "Assinatura e créditos",
  "Cadastro e biometria",
  "Reserva de assento / embarque",
  "Rota do motorista",
  "Frotista (PJ)",
  "Problema técnico / erro no app",
  "Outro assunto",
] as const;

function IconeWhatsApp({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      className={`${className} shrink-0 fill-current`}
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.134 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function montarMensagem(dados: {
  nome: string;
  idConta: string;
  perfil: string;
  tipo: string;
  detalhe: string;
}) {
  const linhas = [
    "Olá! Sou usuário da plataforma Rota Certa Brasil e preciso de ajuda.",
    "",
    `*Nome:* ${dados.nome || "(não informado)"}`,
    `*ID da conta:* ${dados.idConta || "(não identificado)"}`,
  ];
  if (dados.perfil) linhas.push(`*Perfil:* ${dados.perfil}`);
  linhas.push(`*Tipo de problema:* ${dados.tipo}`);
  if (dados.detalhe.trim()) linhas.push("", `*Detalhes:* ${dados.detalhe.trim()}`);
  return linhas.join("\n");
}

function linkWhatsApp(mensagem: string) {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`;
}

/** Formulário que personaliza a mensagem antes de abrir o WhatsApp do suporte. */
function DialogoSuporte({ children }: { children: ReactNode }) {
  const { user, perfis } = useAcesso();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [idConta, setIdConta] = useState("");
  const [tipo, setTipo] = useState<string>(TIPOS_PROBLEMA[0]);
  const [detalhe, setDetalhe] = useState("");

  const nomePadrao = useMemo(() => {
    const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
    return (
      (typeof meta.nome === "string" && meta.nome) ||
      (typeof meta.full_name === "string" && meta.full_name) ||
      (typeof meta.name === "string" && meta.name) ||
      user?.email?.split("@")[0] ||
      ""
    );
  }, [user]);

  const idPadrao = user?.id ? user.id.slice(0, 8).toUpperCase() : "";
  const perfil = perfis.length > 0 ? perfis.join(", ") : "";

  function abrir(estado: boolean) {
    if (estado) {
      setNome((atual) => atual || nomePadrao);
      setIdConta((atual) => atual || idPadrao);
    }
    setAberto(estado);
  }

  const mensagem = montarMensagem({
    nome: nome || nomePadrao,
    idConta: idConta || idPadrao,
    perfil,
    tipo,
    detalhe,
  });

  return (
    <Dialog open={aberto} onOpenChange={abrir}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Falar com o suporte no WhatsApp</DialogTitle>
          <DialogDescription>
            Confirme seus dados para agilizarmos o atendimento. A mensagem já vai preenchida.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="suporte-nome">Seu nome</Label>
            <Input
              id="suporte-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Como podemos te chamar?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="suporte-id">ID da conta</Label>
            <Input
              id="suporte-id"
              value={idConta}
              onChange={(e) => setIdConta(e.target.value)}
              placeholder="Ex.: A1B2C3D4"
            />
            <p className="text-xs text-muted-foreground">
              {user ? "Preenchido automaticamente pela sua conta." : "Entre na sua conta para preencher automaticamente."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="suporte-tipo">Tipo de problema</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger id="suporte-tipo">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_PROBLEMA.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="suporte-detalhe">Detalhes (opcional)</Label>
            <Textarea
              id="suporte-detalhe"
              value={detalhe}
              onChange={(e) => setDetalhe(e.target.value)}
              placeholder="Descreva rapidamente o que aconteceu"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button asChild className="w-full bg-[#25D366] text-white hover:bg-[#1fb757]">
            <a
              href={linkWhatsApp(mensagem)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setAberto(false)}
            >
              <IconeWhatsApp className="size-4" />
              Abrir WhatsApp
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Botão flutuante de WhatsApp fixo no canto inferior direito. */
export function WhatsAppFloatButton() {
  return (
    <DialogoSuporte>
      <button
        type="button"
        aria-label="Falar com o suporte pelo WhatsApp"
        className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgba(37,211,102,0.55)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-6px_rgba(37,211,102,0.65)] focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2 focus:ring-offset-background"
      >
        <IconeWhatsApp />
        <span className="hidden sm:inline">Falar no WhatsApp</span>
      </button>
    </DialogoSuporte>
  );
}

/** Link de WhatsApp para menus e listas de apoio. */
export function WhatsAppLink({
  className = "",
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  return (
    <DialogoSuporte>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-2 text-left ${className}`}
      >
        <MessageCircle className="size-4 shrink-0" />
        <span className="truncate">WhatsApp: +55 96 98409-5871</span>
      </button>
    </DialogoSuporte>
  );
}
