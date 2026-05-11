import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";

interface SEOPageData {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article" | "profile";
  image?: string;
  noindex?: boolean;
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  tags?: string[];
}

interface SEOProps extends SEOPageData {}

const BASE_URL = import.meta.env.VITE_APP_URL || "https://promessometro-brasil.vercel.app";
const SITE_NAME = "Promessômetro";
const DEFAULT_IMAGE = `${BASE_URL}/og-default.png`;

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 60);
}

export function useSEOMetadata(data: SEOPageData) {
  const location = useLocation();
  // Always use the ACTUAL current path from the router — never a hardcoded one.
  // This guarantees canonical / og:url reflect the real page URL.
  const currentPath = location.pathname;
  const canonical = `${BASE_URL}${currentPath}`;
  const ogImage = data.image || DEFAULT_IMAGE;
  // Build the full title; if the caller already appended the site name, don't duplicate it.
  const fullTitle = data.title.includes(SITE_NAME)
    ? data.title
    : `${data.title} | ${SITE_NAME}`;

  useEffect(() => {
    const updateMeta = (name: string, content: string, property?: boolean) => {
      let meta = document.querySelector(property ? `meta[property="${name}"]` : `meta[name="${name}"]`);
      if (!meta) {
        meta = document.createElement("meta");
        if (property) meta.setAttribute("property", name);
        else meta.setAttribute("name", name);
        document.head.appendChild(meta);
      }
      meta.setAttribute("content", content);
    };

    document.title = fullTitle;
    updateMeta("description", data.description);
    // og:title and twitter:title use the FULL title (with site name suffix)
    updateMeta("og:title", fullTitle, true);
    updateMeta("og:description", data.description, true);
    // og:url / canonical always reflect the ACTUAL current URL
    updateMeta("og:url", canonical, true);
    updateMeta("og:type", data.type || "website", true);
    updateMeta("og:image", ogImage, true);
    updateMeta("og:image:width", "1200", true);
    updateMeta("og:image:height", "630", true);
    updateMeta("og:site_name", SITE_NAME, true);
    updateMeta("twitter:card", "summary_large_image");
    updateMeta("twitter:title", fullTitle, true);
    updateMeta("twitter:description", data.description, true);
    updateMeta("twitter:image", ogImage, true);
    updateMeta("twitter:site", "@promessometro");
    updateMeta("article:publisher", "https://promessometro-brasil.vercel.app", true);

    if (data.noindex) {
      updateMeta("robots", "noindex, nofollow");
    } else {
      updateMeta("robots", "index, follow, max-snippet:-1, max-image-preview:large");
    }

    if (data.author) updateMeta("article:author", data.author, true);
    if (data.publishedTime) updateMeta("article:published_time", data.publishedTime, true);
    if (data.modifiedTime) updateMeta("article:modified_time", data.modifiedTime, true);

    let link = document.querySelector("link[rel='canonical']") as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement("link") as HTMLLinkElement;
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", canonical);

    return () => {
      document.title = SITE_NAME;
    };
  // Re-run whenever the actual URL path changes, or data changes
  }, [location.pathname, JSON.stringify(data)]);
}

export function generatePoliticianSEO(politician: {
  name: string;
  party?: string | null;
  state?: string | null;
  photo_url?: string | null;
  stats?: { percentage: number; total: number };
}): SEOPageData {
  const slug = generateSlug(politician.name);
  const title = `${politician.name} — ${politician.party || ""} | Promessômetro`;
  const description = politician.stats 
    ? `${politician.name} tem ${politician.stats.percentage}% de suas promessas cumpridas. Acompanhe o histórico completo de ${politician.stats.total} promessas rastreadas.`
    : `Acompanhe as promessas de ${politician.name} e veja o score de cumprimento.`;

  return {
    title,
    description,
    path: `/politico/${slug}`,
    type: "profile",
    image: politician.photo_url || undefined
  };
}

export function generatePromiseSEO(promise: {
  title: string;
  description?: string | null;
  status: string;
  fulfillment_score: number;
  politician_name: string;
  category?: string | null;
  created_at?: string;
}): SEOPageData {
  const slug = generateSlug(promise.title);
  const statusLabels: Record<string, string> = {
    cumprida: "Cumprida",
    parcialmente_cumprida: "Parcialmente Cumprida",
    em_andamento: "Em Andamento",
    nao_iniciada: "Não Iniciada",
    descumprida: "Descumprida",
    nao_classificada: "Não Classificada"
  };
  
  const statusText = statusLabels[promise.status] || promise.status;
  const title = `${promise.title} — ${promise.politician_name} | Promessômetro`;
  const description = `${promise.politician_name}: ${statusText} (${promise.fulfillment_score}/100). ${promise.description || "Acompanhe a avaliação completa desta promessa."}`;
  
  return {
    title,
    description,
    path: `/promessa/${slug}`,
    type: "article",
    publishedTime: promise.created_at,
    tags: [promise.category, promise.status].filter(Boolean) as string[]
  };
}

export function generateOGImageUrl(politician: string, promise: string, score: number, status: string): string {
  const statusColor = status === "cumprida" ? "22c55e" : 
                      status === "descumprida" ? "ef4444" : 
                      status === "em_andamento" ? "eab308" : "6b7280";
  
  const params = new URLSearchParams({
    politician,
    promise,
    score: score.toString(),
    status,
    color: statusColor
  });
  
  return `${BASE_URL}/api/og?${params.toString()}`;
}

export { generateSlug };

export default function SEO({ title, description, path, type, image, noindex, author, publishedTime, modifiedTime, tags }: SEOProps) {
  useSEOMetadata({ title, description, path, type, image, noindex, author, publishedTime, modifiedTime, tags });
  return null;
}