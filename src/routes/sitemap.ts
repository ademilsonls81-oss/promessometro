import { Router, Request, Response } from "express";
import { supabase } from "../lib/supabase.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
const BASE_URL = process.env.APP_URL || "https://promessometro-brasil.vercel.app";

router.get("/", asyncHandler(async (req: Request, res: Response) => {
  try {
    const staticRoutes = [
      { url: "/", changefreq: "weekly", priority: "1.0" },
      { url: "/promessas", changefreq: "daily", priority: "0.9" },
      { url: "/ranking", changefreq: "daily", priority: "0.9" },
      { url: "/metodologia", changefreq: "monthly", priority: "0.5" },
      { url: "/fontes", changefreq: "monthly", priority: "0.5" },
      { url: "/quem-somos", changefreq: "monthly", priority: "0.5" },
      { url: "/como-funciona", changefreq: "monthly", priority: "0.5" },
      { url: "/privacidade", changefreq: "yearly", priority: "0.3" },
      { url: "/termos", changefreq: "yearly", priority: "0.3" },
      { url: "/correcoes", changefreq: "monthly", priority: "0.6" },
    ];

    const politicians = await supabase
      .from("promises")
      .select("politician_name, updated_at")
      .limit(500);

    const politicianUrls: Array<{ url: string; changefreq: string; priority: string; lastmod?: string }> = [];
    const seenPoliticians = new Set<string>();

    politicians.data?.forEach((p: any) => {
      const name = p.politician_name;
      if (name && !seenPoliticians.has(name)) {
        seenPoliticians.add(name);
        const slug = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
        politicianUrls.push({
          url: `/politico/${slug}`,
          changefreq: "weekly",
          priority: "0.8",
          lastmod: p.updated_at ? new Date(p.updated_at).toISOString().split("T")[0] : undefined
        });
      }
    });

    const promises = await supabase
      .from("promises")
      .select("promise_title, title, updated_at")
      .limit(1000);

    const promiseUrls: Array<{ url: string; changefreq: string; priority: string; lastmod?: string }> = [];
    const seenPromises = new Set<string>();

    promises.data?.forEach((p: any) => {
      const title = p.promise_title || p.title;
      if (title && !seenPromises.has(title)) {
        seenPromises.add(title);
        const slug = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").substring(0, 60);
        promiseUrls.push({
          url: `/promessa/${slug}`,
          changefreq: "weekly",
          priority: "0.7",
          lastmod: p.updated_at ? new Date(p.updated_at).toISOString().split("T")[0] : undefined
        });
      }
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${staticRoutes.map(r => `  <url>
    <loc>${BASE_URL}${r.url}</loc>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`).join("\n")}
${politicianUrls.map(p => `  <url>
    <loc>${BASE_URL}${p.url}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>${p.lastmod ? `\n    <lastmod>${p.lastmod}</lastmod>` : ""}
  </url>`).join("\n")}
${promiseUrls.map(p => `  <url>
    <loc>${BASE_URL}${p.url}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>${p.lastmod ? `\n    <lastmod>${p.lastmod}</lastmod>` : ""}
  </url>`).join("\n")}
</urlset>`;

    res.set("Content-Type", "text/xml");
    res.set("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.send(xml);
  } catch (err: any) {
    console.error("[Sitemap] Error:", err);
    res.status(500).send("Error generating sitemap");
  }
}));

export default router;