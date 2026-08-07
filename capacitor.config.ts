import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Empacotamento Android do RotaCerta.
 *
 * O app é renderizado no servidor (SSR + funções de servidor), portanto o
 * aplicativo nativo carrega o site publicado dentro da WebView em vez de
 * empacotar arquivos estáticos. Assim pagamentos, webhooks e banco continuam
 * funcionando exatamente como na web.
 */
const config: CapacitorConfig = {
  appId: "app.rotacerta.twa",
  appName: "RotaCerta",
  webDir: "public",
  server: {
    url: "https://rota-certa-ap.lovable.app",
    cleartext: false,
    androidScheme: "https",
    allowNavigation: [
      "rota-certa-ap.lovable.app",
      "*.lovable.app",
      "*.stripe.com",
      "*.mercadopago.com",
      "*.mercadopago.com.br",
      "*.supabase.co",
      "accounts.google.com",
    ],
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
