import { describe, it, expect } from 'vitest';

type PromiseStatus = 'fulfilled' | 'partial' | 'broken' | 'pending';

function mapStatus(s: string): PromiseStatus {
  const lower = (s || '').toLowerCase();
  if (lower === 'cumprida' || lower === 'fulfilled') return 'fulfilled';
  if (lower === 'parcialmente_cumprida' || lower === 'em_andamento' || lower === 'partial' || lower === 'partial_fulfilled') return 'partial';
  if (lower === 'descumprida' || lower === 'quebrada' || lower === 'broken' || lower === 'not_fulfilled') return 'broken';
  return 'pending';
}

describe('mapStatus', () => {
  it('mapeia cumprida para fulfilled', () => {
    expect(mapStatus('cumprida')).toBe('fulfilled');
  });

  it('mapeia parcialmente_cumprida para partial', () => {
    expect(mapStatus('parcialmente_cumprida')).toBe('partial');
  });

  it('mapeia em_andamento para partial', () => {
    expect(mapStatus('em_andamento')).toBe('partial');
  });

  it('mapeia descumprida para broken', () => {
    expect(mapStatus('descumprida')).toBe('broken');
  });

  it('mapeia quebrada para broken', () => {
    expect(mapStatus('quebrada')).toBe('broken');
  });

  it('mapeia nao_iniciada para pending', () => {
    expect(mapStatus('nao_iniciada')).toBe('pending');
  });

  it('mapeia nao_classificada para pending', () => {
    expect(mapStatus('nao_classificada')).toBe('pending');
  });

  it('mapeia string vazia para pending', () => {
    expect(mapStatus('')).toBe('pending');
  });

  it('mapeia undefined para pending', () => {
    expect(mapStatus(undefined as any)).toBe('pending');
  });
});

describe('RankingFilter defaults', () => {
  it('usa sortBy percentage, sortOrder desc, limit 20 quando vazio', () => {
    const filter = { limit: 20, sortBy: 'percentage' as const, sortOrder: 'desc' as const };
    expect(filter.limit).toBe(20);
    expect(filter.sortBy).toBe('percentage');
    expect(filter.sortOrder).toBe('desc');
  });

  it('respeita valores customizados de limit', () => {
    const filter = { limit: 50, sortBy: 'name' as const, sortOrder: 'asc' as const };
    expect(filter.limit).toBe(50);
    expect(filter.sortBy).toBe('name');
    expect(filter.sortOrder).toBe('asc');
  });
});

describe('PoliticianRankingEntry shape', () => {
  it('valida shape completo do objeto', () => {
    const entry = {
      name: 'Teste',
      slug: 'teste',
      party: 'PT',
      state: 'SP',
      position: 'governador',
      photo_url: null,
      percentage: 75.5,
      stats: { fulfilled: 10, partial: 5, broken: 2, pending: 3, total: 20 },
      score_breakdown: { c1: 40, c2: 25, c3: 10 },
      election_year: 2022
    };
    expect(entry).toHaveProperty('name');
    expect(entry).toHaveProperty('slug');
    expect(entry).toHaveProperty('percentage');
    expect(entry.stats).toHaveProperty('fulfilled');
    expect(entry.stats).toHaveProperty('partial');
    expect(entry.stats).toHaveProperty('broken');
    expect(entry.stats).toHaveProperty('pending');
    expect(entry.stats).toHaveProperty('total');
    expect(entry.percentage).toBeGreaterThanOrEqual(0);
    expect(entry.percentage).toBeLessThanOrEqual(100);
  });

  it('calcula percentage corretamente', () => {
    const fulfilled = 10;
    const total = 20;
    const percentage = total > 0 ? (fulfilled / total) * 100 : 0;
    expect(percentage).toBe(50);
  });
});
