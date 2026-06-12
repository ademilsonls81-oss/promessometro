import { describe, it, expect } from 'vitest';

function sanitizeInput(obj: any): any {  // any-ok
  if (typeof obj === 'string') {
    return obj.replace(/<[^>]*>/g, '');
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeInput);
  }
  if (obj && typeof obj === 'object') {
    const result: any = {};  // any-ok
    for (const [key, value] of Object.entries(obj)) {
      result[key] = sanitizeInput(value);
    }
    return result;
  }
  return obj;
}

describe('sanitizeInput', () => {
  it('strip tags de strings HTML', () => {
    const result = sanitizeInput("<script>alert('xss')</script>");
    expect(result).toBe("alert('xss')");
  });

  it('recursa em objetos aninhados', () => {
    const input = {
      name: '<b>Nome</b>',
      nested: {
        desc: '<script>hack</script>'
      }
    };
    const result = sanitizeInput(input);
    expect(result.name).toBe('Nome');
    expect(result.nested.desc).toBe('hack');
  });

  it('recursa em arrays', () => {
    const input = ['<p>item1</p>', '<a href="x">item2</a>'];
    const result = sanitizeInput(input);
    expect(result[0]).toBe('item1');
    expect(result[1]).toBe('item2');
  });

  it('retorna valores nao-string como estao', () => {
    expect(sanitizeInput(42)).toBe(42);
    expect(sanitizeInput(null)).toBe(null);
    expect(sanitizeInput(true)).toBe(true);
  });
});
