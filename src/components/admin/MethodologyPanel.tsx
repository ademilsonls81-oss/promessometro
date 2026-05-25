import { useState, useMemo } from "react";

type Grade = "A" | "B" | "C" | "D" | "F";

const GRADE_RANGES: { grade: Grade; min: number; max: number }[] = [
  { grade: "A", min: 80, max: 100 },
  { grade: "B", min: 60, max: 79 },
  { grade: "C", min: 40, max: 59 },
  { grade: "D", min: 20, max: 39 },
  { grade: "F", min: 0, max: 19 },
];

function calculateGrade(score: number): Grade {
  for (const r of GRADE_RANGES) {
    if (score >= r.min && score <= r.max) return r.grade;
  }
  return "F";
}

const GRADE_COLORS: Record<Grade, string> = {
  A: "text-green-400 bg-green-500/10 border-green-500/30",
  B: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  C: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  D: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  F: "text-red-400 bg-red-500/10 border-red-500/30",
};

interface ScoreInputs {
  c1: number;
  c2: number;
  c3: number;
  weightC1: number;
  weightC2: number;
  weightC3: number;
}

interface MethodologyPanelProps {
  politicians?: { id: string; name: string; role: string; state: string; party: string }[];
}

export default function MethodologyPanel({ politicians = [] }: MethodologyPanelProps) {
  const [selectedPol, setSelectedPol] = useState("");
  const [inputs, setInputs] = useState<ScoreInputs>({
    c1: 0, c2: 0, c3: 0,
    weightC1: 0.40, weightC2: 0.35, weightC3: 0.25,
  });

  const finalScore = useMemo(() => {
    return Math.round(
      inputs.c1 * inputs.weightC1 +
      inputs.c2 * inputs.weightC2 +
      inputs.c3 * inputs.weightC3
    );
  }, [inputs]);

  const grade = useMemo(() => calculateGrade(finalScore), [finalScore]);

  const update = (field: keyof ScoreInputs, value: number) => {
    setInputs(prev => ({ ...prev, [field]: Math.max(0, Math.min(100, value)) }));
  };

  return (
    <div className="space-y-4">
      {politicians.length > 0 && (
        <div>
          <label className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 block">
            Selecionar Político
          </label>
          <select
            value={selectedPol}
            onChange={e => setSelectedPol(e.target.value)}
            className="w-full px-4 py-2.5 bg-black/30 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-neon-cyan/50"
          >
            <option value="">Simular scores manualmente</option>
            {politicians.map(p => (
              <option key={p.id} value={p.id}>{p.name} — {p.role} ({p.state})</option>
            ))}
          </select>
        </div>
      )}

      <div className="p-4 bg-black/30 rounded-2xl border border-white/10">
        <h3 className="text-sm font-bold text-white mb-3">Fórmula da Nota Final</h3>
        <div className="text-center text-lg font-mono text-neon-cyan mb-4 p-3 bg-dark-card rounded-xl border border-white/5">
          Final = C1 × {inputs.weightC1} + C2 × {inputs.weightC2} + C3 × {inputs.weightC3}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          {(["c1", "c2", "c3"] as const).map((key) => {
            const labels: Record<string, string> = { c1: "C1 — Promessas (40%)", c2: "C2 — Indicadores (35%)", c3: "C3 — Fatos Jurídicos (25%)" };
            const colors: Record<string, string> = { c1: "border-neon-cyan/30 text-neon-cyan", c2: "border-purple-500/30 text-purple-400", c3: "border-yellow-500/30 text-yellow-400" };
            const weight = inputs[`weight${key.toUpperCase()}` as keyof ScoreInputs] as number;
            return (
              <div key={key} className="p-3 bg-dark-card rounded-xl border border-white/5">
                <label className={`text-xs font-bold ${colors[key]} mb-2 block`}>{labels[key]}</label>
                <input
                  type="number" min={0} max={100}
                  value={inputs[key]}
                  onChange={e => update(key, parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-white text-sm text-center focus:outline-none focus:border-neon-cyan/50"
                />
                <div className="mt-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${colors[key].split(" ")[0]}`} style={{ width: `${inputs[key]}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between p-4 bg-dark-card rounded-xl border border-white/5">
          <div>
            <span className="text-xs text-gray-400 mb-1 block">Nota Final</span>
            <span className="text-3xl font-bold text-white">{finalScore}%</span>
          </div>
          <div className={`px-5 py-3 rounded-2xl border text-4xl font-black ${GRADE_COLORS[grade]}`}>
            {grade}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-1">
          {GRADE_RANGES.map(r => (
            <div key={r.grade} className={`text-center p-1.5 rounded-lg text-xs font-bold ${grade === r.grade ? GRADE_COLORS[r.grade] : "text-gray-600 bg-white/5"}`}>
              {r.grade} ({r.min}-{r.max})
            </div>
          ))}
        </div>
      </div>

      <div className="text-xs text-gray-500 p-3 bg-dark-card rounded-xl border border-white/5">
        <strong className="text-gray-400">Critérios:</strong> C1 (40%) — nível de cumprimento das promessas; C2 (35%) — indicadores externos;
        C3 (25%) — fatos jurídicos (ações, condenações, fichas-limpa).
        Grade: A({GRADE_RANGES[0].min}-{GRADE_RANGES[0].max}) B({GRADE_RANGES[1].min}-{GRADE_RANGES[1].max}) C({GRADE_RANGES[2].min}-{GRADE_RANGES[2].max}) D({GRADE_RANGES[3].min}-{GRADE_RANGES[3].max}) F({GRADE_RANGES[4].min}-{GRADE_RANGES[4].max})
      </div>
    </div>
  );
}
