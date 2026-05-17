const NIVEL_1 = new Set([
  'www12.senado.leg.br', 'www.camara.leg.br', 'www.planalto.gov.br',
  'portaldatransparencia.gov.br', 'www.imprensaoficial.rj.gov.br',
  'imprensaoficial.rj.gov.br', 'diariooficial.com.br', 'diariooficial.rj.gov.br',
  'dje.tse.jus.br', 'tse.jus.br', 'tce.rj.gov.br', 'tce.sp.gov.br',
  'jusbrasil.com.br', 'leisestaduais.com.br'
]);

function getUrlDomain(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace('www.', '').toLowerCase();
  } catch {
    return null;
  }
}

function classifySource(url) {
  const domain = getUrlDomain(url);
  if (!domain) return 5;

  if (NIVEL_1.has(domain)) return 1;

  if (domain.endsWith('.gov.br') || domain.endsWith('.leg.br') ||
      domain.includes('diariooficial') || domain.includes('transparencia')) {
    if (domain === 'gov.br' || domain.endsWith('.gov.br')) return 2;
    return 1;
  }

  if (domain.endsWith('.gov')) return 2;

  const dadosAbertos = ['ibge.gov.br', 'ipea.gov.br', 'datasus.gov.br',
    'caged.gov.br', 'rais.gov.br', 'sidra.ibge.gov.br'];
  if (dadosAbertos.some(d => domain === d || domain.endsWith('.' + d))) return 2;

  const reportagem = ['g1.globo.com', 'oglobo.globo.com', 'folha.uol.com.br',
    'uol.com.br', 'estadao.com.br', 'metropoles.com', 'cnnbrasil.com.br',
    'agenciabrasil.ebc.com.br', 'veja.abril.com.br', 'noticias.r7.com',
    'congressoemfoco.uol.com.br', 'correiobraziliense.com.br',
    'diariodorio.com', 'ofluminense.com.br', 'zmnoticias.com.br',
    'jornalhorah.com.br', 'mancheterj.com.br', 'politicarj.com.br',
    'folhadoleste.com.br', 'extra.globo.com', 'estradas.com.br',
    'correiodamanha.com.br', 'noticiasaominuto.com.br', 'tupi.fm',
    'brasildefato.com.br'];
  if (reportagem.some(d => domain === d || domain.endsWith('.' + d))) return 3;

  if (domain.includes('tvprefeito') || domain.includes('youtube.com') ||
      domain.includes('facebook.com') || domain.includes('instagram.com') ||
      domain.includes('tiktok.com') || domain.includes('twitter.com') ||
      domain.includes('x.com')) return 4;

  return 5;
}

function getLevelLabel(level) {
  const labels = {
    1: 'Nível 1 — Documento oficial (DO, TSE, TCE)',
    2: 'Nível 2 — Dado governamental aberto (IBGE, IPEA)',
    3: 'Nível 3 — Reportagem jornalística com registro',
    4: 'Nível 4 — Declaração pública em vídeo/áudio',
    5: 'Nível 5 — Relato de terceiro (exige corroboração)'
  };
  return labels[level] || 'Nível 5 — Relato de terceiro (exige corroboração)';
}

function sortByLevel(evidencias) {
  return [...evidencias].sort((a, b) => {
    const levelA = classifySource(a.url);
    const levelB = classifySource(b.url);
    return levelA - levelB;
  });
}

function prioritizeSources(evidencias, maxSources = 3) {
  const withLevel = evidencias.map(e => ({
    ...e,
    nivel: classifySource(e.url),
    nivelLabel: getLevelLabel(classifySource(e.url))
  }));
  withLevel.sort((a, b) => a.nivel - b.nivel);
  const seen = new Set();
  const deduped = [];
  for (const ev of withLevel) {
    const key = ev.url ? ev.url.toLowerCase() : ev.descricao;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(ev);
    }
  }
  return deduped.slice(0, maxSources);
}

export {
  classifySource,
  getLevelLabel,
  sortByLevel,
  prioritizeSources,
  getUrlDomain
};