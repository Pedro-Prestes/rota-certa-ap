import { createFileRoute } from "@tanstack/react-router";
import { Car } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { BotaoVoltar } from "@/components/BotaoVoltar";
import { GuardaPerfil } from "@/components/GuardaPerfil";
import { PainelUrbanoMotorista } from "@/components/urbano/PainelUrbanoMotorista";
import { PedirCorridaUrbana } from "@/components/urbano/PedirCorridaUrbana";
import { useAcesso } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/urbano")({
  head: () => ({
    meta: [
      { title: "Modo urbano | Corridas na cidade com a RotaCerta" },
      {
        name: "description",
        content:
          "Corridas urbanas na região metropolitana, distritos e vilarejos: preço calculado antes do pedido, despacho imediato ou agendado e acompanhamento em tempo real.",
      },
      { property: "og:title", content: "Modo urbano | RotaCerta" },
      {
        property: "og:description",
        content:
          "O motorista liga a chave de conversão e recebe corridas urbanas; o passageiro vê bandeirada, km, tempo e taxa antes de pedir.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UrbanoProtegido,
});

function UrbanoProtegido() {
  return (
    <GuardaPerfil perfis={["passageiro", "motorista", "frotista"]}>
      <Urbano />
    </GuardaPerfil>
  );
}

function Urbano() {
  const { perfis } = useAcesso();
  const dirige = perfis.includes("motorista") || perfis.includes("frotista");

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-4xl px-5 py-10">
        <BotaoVoltar />
        <header className="mt-4">
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold sm:text-3xl">
            <Car className="size-6 text-primary" /> Modo urbano
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Corridas dentro da cidade metropolitana, seus distritos e vilarejos, com tarifação por
            bandeirada, distância e tempo — e taxa administrativa demonstrada.
          </p>
        </header>

        <div className="mt-8 space-y-10">
          {dirige && <PainelUrbanoMotorista />}
          <PedirCorridaUrbana />
        </div>
      </main>
    </div>
  );
}
