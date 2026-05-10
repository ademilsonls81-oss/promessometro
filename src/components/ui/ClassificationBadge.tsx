import React from "react";

interface ClassificationBadgeProps {
  classificacao_ia?: {
    tipo_primario: string;
    tipos_secundarios: string[];
    esfera: string;
    grau_confianca: number;
  };
}

const tipoConfig: Record<string, { label: string; color: string; bg: string }> = {
  objetiva: { label: "Objetiva", color: "text-green-400", bg: "bg-green-500/10" },
  subjetiva: { label: "Subjetiva", color: "text-purple-400", bg: "bg-purple-500/10" },
  mensuravel: { label: "Mensurável", color: "text-blue-400", bg: "bg-blue-500/10" },
  simbolica: { label: "Simbólica", color: "text-yellow-400", bg: "bg-yellow-500/10" },
  dependente_congresso: { label: "Dep. Congresso", color: "text-orange-400", bg: "bg-orange-500/10" },
  dependente_orcamento: { label: "Dep. Orçamento", color: "text-pink-400", bg: "bg-pink-500/10" },
};

const esferaConfig: Record<string, { label: string; color: string }> = {
  federal: { label: "Federal", color: "text-neon-cyan" },
  estadual: { label: "Estadual", color: "text-neon-purple" },
  municipal: { label: "Municipal", color: "text-neon-green" },
};

export function ClassificationBadge({ classificacao_ia }: ClassificationBadgeProps) {
  if (!classificacao_ia) {
    return (
      <span className="text-xs bg-gray-500/20 text-gray-400 px-2 py-0.5 rounded">
        Não classificada
      </span>
    );
  }

  const { tipo_primario, tipos_secundarios, esfera, grau_confianca } = classificacao_ia;
  const config = tipoConfig[tipo_primario] || tipoConfig.subjetiva;
  const esferaInfo = esferaConfig[esfera] || esferaConfig.federal;

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      <span className={`text-xs px-2 py-0.5 rounded ${config.bg} ${config.color}`}>
        {config.label}
      </span>
      
      {esfera && (
        <span className={`text-xs px-2 py-0.5 rounded bg-white/10 ${esferaInfo.color}`}>
          {esferaInfo.label}
        </span>
      )}
      
      {grau_confianca && (
        <span className="text-xs text-gray-500">
          {grau_confianca}%
        </span>
      )}
      
      {tipos_secundarios && tipos_secundarios.length > 0 && (
        <div className="flex gap-1">
          {tipos_secundarios.slice(0, 2).map((tipo, idx) => {
            const subConfig = tipoConfig[tipo];
            if (!subConfig) return null;
            return (
              <span key={idx} className={`text-xs px-1.5 py-0.5 rounded ${subConfig.bg} ${subConfig.color}`}>
                {subConfig.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ClassificationBadge;