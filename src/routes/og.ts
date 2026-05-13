import { Router, Request, Response } from "express";

const router = Router();

router.get("/og", async (req: Request, res: Response) => {
  try {
    const { 
      politician = "Político",
      promise = "Promessa",
      score = "50",
      status = "nao_classificada",
      color = "6b7280"
    } = req.query as Record<string, string>;

    const statusLabels: Record<string, string> = {
      cumprida: "CUMPRIDA",
      parcialmente_cumprida: "PARCIAL",
      em_andamento: "EM ANDAMENTO",
      nao_iniciada: "PENDENTE",
      pendente: "PENDENTE",
      descumprida: "DESCUMPRIDA",
      nao_classificada: "NAO CLASSIFICADA"
    };

    const statusColor = status === "cumprida" ? "22c55e" : 
                        status === "descumprida" ? "ef4444" : 
                        status === "em_andamento" ? "eab308" : color;

    const truncatedPolitician = String(politician).substring(0, 40);
    const truncatedPromise = String(promise).substring(0, 50);

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a0f"/>
      <stop offset="100%" style="stop-color:#1a1a2e"/>
    </linearGradient>
  </defs>
  
  <rect width="1200" height="630" fill="url(#bg)"/>
  
  <rect x="40" y="40" width="100" height="100" rx="20" fill="#a855f7"/>
  <text x="90" y="95" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="white" text-anchor="middle">
    P
  </text>
  
  <text x="160" y="85" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white">
    Promessometro
  </text>
  <text x="160" y="115" font-family="Arial, sans-serif" font-size="16" fill="#9ca3af">
    promessometro-brasil.vercel.app
  </text>
  
  <line x1="40" y1="150" x2="1160" y2="150" stroke="#374151" stroke-width="1"/>
  
  <text x="600" y="220" font-family="Arial, sans-serif" font-size="24" fill="#9ca3af" text-anchor="middle">
    ${truncatedPolitician}
  </text>
  
  <text x="600" y="300" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">
    "${truncatedPromise}"
  </text>
  
  <rect x="400" y="350" width="400" height="120" rx="20" fill="#1f2937" stroke="#374151" stroke-width="2"/>
  
  <text x="600" y="390" font-family="Arial, sans-serif" font-size="20" fill="#9ca3af" text-anchor="middle">
    Score de Cumprimento
  </text>
  
  <text x="600" y="450" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="#${statusColor}" text-anchor="middle">
    ${score}/100
  </text>
  
  <rect x="450" y="510" width="300" height="50" rx="25" fill="#${statusColor}22" stroke="#${statusColor}" stroke-width="2"/>
  <text x="600" y="545" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#${statusColor}" text-anchor="middle">
    ${statusLabels[status] || status.toUpperCase()}
  </text>
  
  <text x="600" y="610" font-family="Arial, sans-serif" font-size="14" fill="#6b7280" text-anchor="middle">
    Transparencia politica para o Brasil
  </text>
</svg>`;

    res.set("Content-Type", "image/svg+xml");
    res.set("Cache-Control", "public, max-age=86400, s-maxage=86400");
    res.set("Vary", "Accept-Encoding");
    res.send(svg);
  } catch (err) {
    console.error("[OG Image] Error:", err);
    res.status(500).send("Error generating image");
  }
});

export default router;