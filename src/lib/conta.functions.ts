import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Garante que a conta autenticada tenha perfil (profiles) e papéis (user_roles).
 * Necessário porque o gatilho no schema de autenticação não está disponível:
 * o provisionamento acontece no primeiro acesso, a partir dos metadados da conta.
 */
export const provisionarConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    const { data: usuario } = await supabaseAdmin.auth.admin.getUserById(userId);
    const meta = (usuario.user?.user_metadata ?? {}) as Record<string, unknown>;
    const email = usuario.user?.email ?? "";
    const texto = (chave: string) => {
      const valor = meta[chave];
      return typeof valor === "string" && valor.trim() ? valor.trim() : null;
    };

    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        nome_completo: texto("nome_completo") ?? texto("full_name") ?? texto("name") ?? "",
        telefone: texto("telefone"),
        municipio: texto("municipio"),
      },
      { onConflict: "id", ignoreDuplicates: true },
    );

    const perfil = texto("perfil") ?? "passageiro";
    const papeis: string[] = ["passageiro"];
    if (perfil === "motorista") papeis.push("motorista");
    if (perfil === "frotista") papeis.push("motorista", "frotista");

    const { data: master } = await supabaseAdmin
      .from("admins_master")
      .select("email")
      .ilike("email", email);
    if ((master ?? []).length > 0) papeis.push("admin");

    await supabaseAdmin
      .from("user_roles")
      .upsert(
        [...new Set(papeis)].map((role) => ({ user_id: userId, role: role as never })),
        { onConflict: "user_id,role", ignoreDuplicates: true },
      );

    const { data: atuais } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    return { perfis: (atuais ?? []).map((r) => r.role as string) };
  });
