import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { UFS } from "@/lib/ufs";

const BASE_URL = "https://rotacertabrasil.com.br";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const entries: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/passageiro", changefreq: "daily", priority: "0.9" },
  { path: "/motorista", changefreq: "weekly", priority: "0.9" },
  { path: "/sou-frotista", changefreq: "weekly", priority: "0.8" },
  { path: "/cadastro", changefreq: "monthly", priority: "0.6" },
  { path: "/area-administrativa", changefreq: "monthly", priority: "0.4" },
  // Recrutamento de motoristas nas 27 unidades federativas.
  ...UFS.map((u) => ({
    path: `/seja-motorista/${u.sigla.toLowerCase()}`,
    changefreq: "weekly" as const,
    priority: "0.8",
  })),
];


export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
