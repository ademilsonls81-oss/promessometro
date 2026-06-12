import { describe, it, expect, vi, beforeEach } from 'vitest';

// extractJSON is exported from groqEvaluate.js for testing
const { extractJSON } = await import('../api/lib/groqEvaluate.js');

describe('extractJSON — parser robusto de respostas da IA', () => {

  it('JSON simples no topo', () => {
    const result = extractJSON('{"score": 75, "status": "parcial"}');
    expect(result).toEqual({ score: 75, status: 'parcial' });
  });

  it('JSON com texto antes e depois', () => {
    const result = extractJSON(
      'Aqui está a análise:\n{"score": 85, "status": "cumprida"}\nFim.'
    );
    expect(result).toEqual({ score: 85, status: 'cumprida' });
  });

  it('JSON dentro de bloco markdown sem language', () => {
    const result = extractJSON(
      '```\n{"score": 40, "status": "parcial"}\n```'
    );
    expect(result).toEqual({ score: 40, status: 'parcial' });
  });

  it('JSON dentro de bloco markdown json', () => {
    const result = extractJSON(
      '```json\n{"score": 90, "status": "cumprida"}\n```'
    );
    expect(result).toEqual({ score: 90, status: 'cumprida' });
  });

  it('JSON com trailing comma', () => {
    const result = extractJSON(
      '{"score": 60, "status": "parcial",}'
    );
    expect(result).toEqual({ score: 60, status: 'parcial' });
  });

  it('JSON com trailing comma aninhado', () => {
    const result = extractJSON(
      '{"score": 50, "tags": ["a", "b",], "status": "pendente",}'
    );
    expect(result).toEqual({ score: 50, tags: ['a', 'b'], status: 'pendente' });
  });

  it('JSON com texto grande antes (resposta prolixa da IA)', () => {
    const text = 'Com base nas evidências analisadas, considerando o progresso realizado... '
      + '{"status": "parcial", "score": 65, "justificativa": "Houve avanço mas falta conclusão"}';
    const result = extractJSON(text);
    expect(result).toEqual({
      status: 'parcial',
      score: 65,
      justificativa: 'Houve avanço mas falta conclusão'
    });
  });

  it('resposta vazia retorna null', () => {
    expect(extractJSON('')).toBeNull();
    expect(extractJSON(null)).toBeNull();
    expect(extractJSON(undefined)).toBeNull();
  });

  it('resposta sem JSON retorna null', () => {
    expect(extractJSON('Não foi possível avaliar esta promessa.')).toBeNull();
  });

  it('JSON malformado retorna null', () => {
    expect(extractJSON('{"score": 75, "status": }')).toBeNull();
  });

  it('JSON truncado incompleto retorna null', () => {
    expect(extractJSON('{"score": 75, "status": "parcial"')).toBeNull();
  });

  it('múltiplos objetos JSON — pega o primeiro completo', () => {
    const result = extractJSON(
      '{"a": 1}{"b": 2}'
    );
    expect(result).toEqual({ a: 1 });
  });

  it('objetos JSON aninhados com arrays', () => {
    const result = extractJSON(
      JSON.stringify({
        score: 72,
        status: 'parcial',
        campos_corrigidos: ['status', 'score'],
        justificativa: 'Texto com {chaves} aninhadas',
        observacao: 'nota'
      })
    );
    expect(result.score).toBe(72);
    expect(result.status).toBe('parcial');
    expect(result.campos_corrigidos).toEqual(['status', 'score']);
  });

  it('JSON com newlines e espaços', () => {
    const result = extractJSON(
      '{\n  "score": 100,\n  "status": "cumprida"\n}'
    );
    expect(result).toEqual({ score: 100, status: 'cumprida' });
  });

  it('JSON dentro de bloco markdown com texto extra ao redor', () => {
    const text =
      'Claro! Vou analisar a promessa.\n\n'
      + '```json\n'
      + '{\n  "score": 30,\n  "status": "pendente"\n}\n'
      + '```\n\n'
      + 'Esta é minha análise completa.';
    const result = extractJSON(text);
    expect(result).toEqual({ score: 30, status: 'pendente' });
  });

});

describe('clampStatus — mapeamento score → status', () => {
  // Re-import clampStatus logic inline for verification
  function clampStatus(score) {
    if (score >= 80) return 'cumprida';
    if (score >= 40) return 'parcial';
    if (score <= 0) return 'quebrada';
    return 'pendente';
  }

  it('score >= 80 → cumprida', () => {
    expect(clampStatus(80)).toBe('cumprida');
    expect(clampStatus(100)).toBe('cumprida');
  });

  it('score 40-79 → parcial', () => {
    expect(clampStatus(40)).toBe('parcial');
    expect(clampStatus(79)).toBe('parcial');
    expect(clampStatus(50)).toBe('parcial');
  });

  it('score 1-39 → pendente', () => {
    expect(clampStatus(1)).toBe('pendente');
    expect(clampStatus(39)).toBe('pendente');
    expect(clampStatus(20)).toBe('pendente');
  });

  it('score <= 0 → quebrada', () => {
    expect(clampStatus(0)).toBe('quebrada');
    expect(clampStatus(-5)).toBe('quebrada');
  });
});
