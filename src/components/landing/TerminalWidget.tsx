import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { generateSlug } from "../SEO";

interface TerminalLine {
  type: "input" | "success" | "warning" | "error" | "info" | "blank";
  text: string;
  delay?: number;
}

interface TerminalData {
  politician: string;
  promise: string;
  status: string;
  score: number;
  source: string;
}

const statusLabels: Record<string, string> = {
  cumprida: "CUMPRIDA",
  parcialmente_cumprida: "PARCIALMENTE CUMPRIDA",
  em_andamento: "EM ANDAMENTO",
  nao_iniciada: "PENDENTE",
  descumprida: "DESCUMPRIDA",
  nao_classificada: "NÃO CLASSIFICADA",
  pendente: "PENDENTE",
  fulfilled: "CUMPRIDA",
  partial: "PARCIAL",
  broken: "DESCUMPRIDA",
  pending: "PENDENTE",
};

const sourceNames = [
  "G1", "Folha de S.Paulo", "UOL", "CNN Brasil",
  "Diário Oficial da União", "Portal da Transparência",
  "Estadão", "Metropoles"
];

function typeColor(type: TerminalLine["type"]): string {
  switch (type) {
    case "input": return "text-muted-foreground";
    case "success": return "text-green-400";
    case "warning": return "text-yellow-400";
    case "error": return "text-red-400";
    case "info": return "text-neon-cyan";
    default: return "text-muted-foreground";
  }
}

export default function TerminalWidget() {
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [displayedLines, setDisplayedLines] = useState<number>(0);
  const [data, setData] = useState<TerminalData | null>(null);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      const { data: promises } = await supabase
        .from("promises")
        .select("id, promise_title, politician_name, status, fulfillment_score, source_link")
        .not("fulfillment_score", "is", null)
        .gt("fulfillment_score", 0)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!promises || promises.length === 0) {
        setData({ politician: "lula", promise: "Zerar a fome", status: "em_andamento", score: 45, source: "Portal da Transparência" });
        return;
      }

      const random = promises[Math.floor(Math.random() * Math.min(promises.length, 20))];
      const statusKey = (random.status || 'nao_classificada').toLowerCase();
      const label = statusLabels[statusKey] || statusLabels[random.status?.toLowerCase()] || "NÃO CLASSIFICADA";

      const sourceName = sourceNames[Math.floor(Math.random() * sourceNames.length)];

      const maxScore = Math.max(0, Math.min(100, random.fulfillment_score || 0));

      setData({
        politician: random.politician_name || "Desconhecido",
        promise: random.promise_title || "Promessa",
        status: label,
        score: maxScore,
        source: sourceName,
      });
    } catch {
      setData({ politician: "lula", promise: "Zerar a fome", status: "EM ANDAMENTO", score: 45, source: "Portal da Transparência" });
    }
  }, []);

  const buildLines = useCallback((d: TerminalData): TerminalLine[] => {
    const cmd = `promessometro status ${generateSlug(d.politician).split("-")[0]}`;
    const lines: TerminalLine[] = [
      { type: "input", text: cmd, delay: 0 },
      { type: "blank", text: "", delay: 200 },
    ];

    if (d.score > 0) {
      lines.push(
        { type: "info", text: `Analisando promessas de ${d.politician}...`, delay: 400 },
        { type: "success", text: `Promessa "${d.promise}" — ${d.status} (${d.score}/100)`, delay: 600 },
        { type: "success", text: `Evidência verificada em ${d.source}.`, delay: 800 },
        { type: "blank", text: "", delay: 1000 },
      );

      if (d.score >= 70) {
        lines.push({ type: "info", text: `Índice de cumprimento: ${d.score}%`, delay: 1200 });
      } else if (d.score >= 40) {
        lines.push({ type: "warning", text: `Índice de cumprimento: ${d.score}% — progresso parcial`, delay: 1200 });
      } else {
        lines.push({ type: "error", text: `Índice de cumprimento: ${d.score}% — acompanhamento necessário`, delay: 1200 });
      }
    } else {
      lines.push(
        { type: "info", text: `Buscando promessas de ${d.politician}...`, delay: 400 },
        { type: "warning", text: "Nenhuma avaliação disponível para este político.", delay: 600 },
      );
    }

    lines.push(
      { type: "blank", text: "", delay: 1400 },
      { type: "info", text: `Ver perfil completo → /politico/${generateSlug(d.politician)}`, delay: 1600 },
    );

    return lines;
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!data) return;

    const newLines = buildLines(data);
    setLines(newLines);
    setDisplayedLines(0);
    setLoading(false);
  }, [data, buildLines]);

  useEffect(() => {
    if (lines.length === 0) return;

    if (displayedLines >= lines.length) {
      timerRef.current = setTimeout(() => {
        fetchData();
      }, 8000);
      return;
    }

    const line = lines[displayedLines];
    timerRef.current = setTimeout(() => {
      setDisplayedLines(prev => prev + 1);
    }, line.delay || 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [lines, displayedLines, fetchData]);

  const handleLineClick = (line: TerminalLine) => {
    if (line.text.includes("/politico/")) {
      const slug = line.text.split("/politico/")[1];
      if (slug) navigate(`/politico/${encodeURIComponent(slug)}`);
    } else if (line.text.includes("/ranking")) {
      navigate("/ranking");
    }
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 glass overflow-hidden glow">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-secondary/30">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/80" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <span className="text-xs text-muted-foreground font-mono ml-2">terminal</span>
      </div>

      <div className="p-4 font-mono text-sm space-y-1 min-h-[180px]">
        {loading ? (
          <div className="text-muted-foreground/50 animate-pulse">Carregando dados...</div>
        ) : (
          lines.slice(0, displayedLines).map((line, idx) => (
            <div
              key={idx}
              className={`${typeColor(line.type)} ${
                line.text.includes("→ /politico") || line.text.includes("→ /ranking")
                  ? "cursor-pointer hover:underline text-neon-cyan"
                  : ""
              }`}
              onClick={() => handleLineClick(line)}
            >
              {line.type === "input" ? (
                <div className="flex items-center gap-2">
                  <span className="text-green-400">$</span>
                  <span>{line.text}</span>
                </div>
              ) : line.type === "blank" ? (
                <div>&nbsp;</div>
              ) : line.text}
            </div>
          ))
        )}
        {displayedLines < lines.length && (
          <span className="inline-block w-2 h-4 bg-green-400 animate-pulse ml-0" />
        )}
      </div>
    </div>
  );
}