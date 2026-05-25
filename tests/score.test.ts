import { describe, it, expect } from 'vitest';

const CRITERIA: Record<string, { status: string; minScore: number | null; maxScore: number | null; description: string }> = {
  cumprida: { status: 'cumprida', minScore: 80, maxScore: 100, description: 'Ação concluída' },
  parcialmente_cumprida: { status: 'parcialmente_cumprida', minScore: 40, maxScore: 79, description: 'Ação com progresso' },
  em_andamento: { status: 'em_andamento', minScore: 20, maxScore: 39, description: 'Ação iniciada' },
  nao_iniciada: { status: 'nao_iniciada', minScore: 0, maxScore: 19, description: 'Nenhuma ação' },
  descumprida: { status: 'descumprida', minScore: 0, maxScore: 0, description: 'Ação oposta' },
  nao_classificada: { status: 'nao_classificada', minScore: null, maxScore: null, description: 'Vaga demais' },
  sem_evidencia: { status: 'nao_classificada', minScore: 0, maxScore: 0, description: 'Sem evidência' },
};

function clampScore(score: number, status: string): number {
  const criteria = CRITERIA[status];
  if (!criteria || criteria.minScore === null || criteria.maxScore === null) return score;
  return Math.max(criteria.minScore, Math.min(criteria.maxScore, score));
}

function getCriteria(status: string) {
  return CRITERIA[status] || null;
}

describe('scoreService', () => {
  describe('clampScore', () => {
    it('nao permite score > 100 para cumprida', () => {
      expect(clampScore(120, 'cumprida')).toBe(100);
    });

    it('nao permite score < 0', () => {
      expect(clampScore(-10, 'cumprida')).toBe(80);
    });

    it('clampa score 95 para cumprida entre 80-100', () => {
      expect(clampScore(95, 'cumprida')).toBe(95);
    });

    it('clampa score 10 para nao_iniciada entre 0-19', () => {
      expect(clampScore(10, 'nao_iniciada')).toBe(10);
    });

    it('clampa score 50 para descumprida em 0', () => {
      expect(clampScore(50, 'descumprida')).toBe(0);
    });

    it('retorna score original para nao_classificada (null ranges)', () => {
      expect(clampScore(30, 'nao_classificada')).toBe(30);
    });
  });

  describe('getCriteria', () => {
    it('retorna criterio para cumprida', () => {
      const c = getCriteria('cumprida');
      expect(c).not.toBeNull();
      expect(c!.minScore).toBe(80);
      expect(c!.maxScore).toBe(100);
    });

    it('retorna criterio para cada status', () => {
      const statuses = ['cumprida', 'parcialmente_cumprida', 'em_andamento', 'nao_iniciada', 'descumprida', 'nao_classificada', 'sem_evidencia'];
      for (const s of statuses) {
        expect(getCriteria(s)).not.toBeNull();
      }
    });

    it('retorna null para status desconhecido', () => {
      expect(getCriteria('invalido')).toBeNull();
    });
  });
});
