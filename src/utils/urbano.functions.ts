import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Situação do modo urbano do motorista e ofertas disponíveis no município. */
export const painelUrbanoMotorista = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { ofertasDoMotorista } = await import("@/lib/urbano.server");
    return ofertasDoMotorista(context.userId);
  });

/** Liga/desliga a chave de conversão para o modo urbano. */
export const converterModoUrbano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { ativo: boolean; municipio?: string; uf?: string }) => {
    if (data.ativo && (!data.municipio || !/^[A-Za-z]{2}$/.test(data.uf ?? ""))) {
      throw new Error("Escolha o município-base e a UF para operar no modo urbano.");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { converterModoUrbano: converter } = await import("@/lib/urbano.server");
    try {
      const estado = await converter({
        userId: context.userId,
        ativo: !!data.ativo,
        municipio: data.municipio ?? null,
        uf: data.uf ?? null,
      });
      return { estado };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível alterar o modo urbano." };
    }
  });

/** Fica online/offline para receber ofertas imediatas. */
export const definirDisponibilidadeUrbana = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { online: boolean; latitude?: number; longitude?: number }) => data)
  .handler(async ({ data, context }) => {
    const { definirDisponibilidade } = await import("@/lib/urbano.server");
    try {
      const estado = await definirDisponibilidade({
        userId: context.userId,
        online: !!data.online,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
      });
      return { estado };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível atualizar a situação." };
    }
  });

/** Preço da corrida urbana antes do pedido (bandeirada + km + minuto). */
export const estimarCorridaUrbana = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { municipio: string; uf: string; origem: string; destino: string }) => {
    if (!data.municipio || !/^[A-Za-z]{2}$/.test(data.uf ?? "")) {
      throw new Error("Informe o município e a UF da corrida.");
    }
    if ((data.origem ?? "").trim().length < 5 || (data.destino ?? "").trim().length < 5) {
      throw new Error("Informe o endereço de origem e o de destino.");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { estimarCorridaUrbana: estimar } = await import("@/lib/urbano.server");
    try {
      return await estimar({ ...data, uf: data.uf.toUpperCase(), userId: context.userId });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível calcular o preço." };
    }
  });

/** Cria o pedido imediato ou o agendamento da corrida urbana. */
export const solicitarCorridaUrbana = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      municipio: string;
      uf: string;
      origem: string;
      destino: string;
      modo: "imediato" | "agendado";
      agendadaPara?: string;
      formaPagamento: "pix" | "credito" | "debito" | "dinheiro";
    }) => {
      if (!data.municipio || !/^[A-Za-z]{2}$/.test(data.uf ?? "")) {
        throw new Error("Informe o município e a UF da corrida.");
      }
      if ((data.origem ?? "").trim().length < 5 || (data.destino ?? "").trim().length < 5) {
        throw new Error("Informe o endereço de origem e o de destino.");
      }
      if (data.modo !== "imediato" && data.modo !== "agendado") {
        throw new Error("Modo de corrida inválido.");
      }
      if (data.modo === "agendado" && !data.agendadaPara) {
        throw new Error("Informe a data e a hora do agendamento.");
      }
      if (!["pix", "credito", "debito", "dinheiro"].includes(data.formaPagamento)) {
        throw new Error("Forma de pagamento inválida.");
      }
      return data;
    },
  )
  .handler(async ({ data, context }) => {
    const { solicitarCorridaUrbana: solicitar } = await import("@/lib/urbano.server");
    try {
      return await solicitar({
        userId: context.userId,
        municipio: data.municipio,
        uf: data.uf.toUpperCase(),
        origem: data.origem,
        destino: data.destino,
        modo: data.modo,
        agendadaPara: data.agendadaPara ?? null,
        formaPagamento: data.formaPagamento,
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível pedir a corrida." };
    }
  });

/** Aceita a oferta (o primeiro motorista a aceitar leva a corrida). */
export const aceitarCorridaUrbana = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { corridaId: string }) => {
    if (!/^[0-9a-fA-F-]{36}$/.test(data.corridaId)) throw new Error("Corrida inválida.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { aceitarCorridaUrbana: aceitar } = await import("@/lib/urbano.server");
    try {
      return { corrida: await aceitar({ userId: context.userId, corridaId: data.corridaId }) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível aceitar a corrida." };
    }
  });

/** Avança as etapas: a caminho → no local → em viagem → concluída. */
export const avancarEtapaUrbana = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { corridaId: string }) => {
    if (!/^[0-9a-fA-F-]{36}$/.test(data.corridaId)) throw new Error("Corrida inválida.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { avancarEtapaUrbana: avancar } = await import("@/lib/urbano.server");
    try {
      return { corrida: await avancar({ userId: context.userId, corridaId: data.corridaId }) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível avançar a etapa." };
    }
  });

/** Cancelamento com a regra de taxa após o motorista já estar a caminho. */
export const cancelarCorridaUrbana = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { corridaId: string; motivo?: string }) => {
    if (!/^[0-9a-fA-F-]{36}$/.test(data.corridaId)) throw new Error("Corrida inválida.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { cancelarCorridaUrbana: cancelar } = await import("@/lib/urbano.server");
    try {
      return await cancelar({
        userId: context.userId,
        corridaId: data.corridaId,
        motivo: data.motivo ?? "",
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível cancelar a corrida." };
    }
  });

/** Avaliação de 1 a 5 estrelas ao final da corrida. */
export const avaliarCorridaUrbana = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { corridaId: string; nota: number }) => {
    if (!/^[0-9a-fA-F-]{36}$/.test(data.corridaId)) throw new Error("Corrida inválida.");
    if (!(Number(data.nota) >= 1 && Number(data.nota) <= 5)) throw new Error("Nota inválida.");
    return data;
  })
  .handler(async ({ data, context }) => {
    const { avaliarCorridaUrbana: avaliar } = await import("@/lib/urbano.server");
    try {
      return await avaliar({
        userId: context.userId,
        corridaId: data.corridaId,
        nota: Number(data.nota),
      });
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Não foi possível avaliar." };
    }
  });

/** Corridas urbanas do passageiro (em andamento e histórico). */
export const minhasCorridasUrbanas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { corridasDoPassageiro } = await import("@/lib/urbano.server");
    return { corridas: await corridasDoPassageiro(context.userId) };
  });
