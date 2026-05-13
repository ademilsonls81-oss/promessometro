export const config = {
  matcher: ['/politico/:path*', '/promessa/:path*'],
};

const BASE_URL = 'https://promessometro-brasil.vercel.app';
const SUPABASE_URL = 'https://liqutcjzzrqstivvfele.supabase.co';
const SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxpcXV0Y2p6enJxc3RpdnZmZWxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTgwMzYsImV4cCI6MjA5MTA3NDAzNn0.deYQjqFEAkJu9zRowDNQsfTNw99RR9aMqnKeb8-Cuis';

/**
 * Detect social media / search engine crawlers.
 * Regular browsers are served the SPA as-is (JS handles the SEO).
 */
function isCrawler(userAgent = '') {
  const ua = userAgent.toLowerCase();
  return (
    ua.includes('facebookexternalhit') ||
    ua.includes('facebot') ||
    ua.includes('whatsapp') ||
    ua.includes('twitterbot') ||
    ua.includes('telegrambot') ||
    ua.includes('linkedinbot') ||
    ua.includes('slackbot') ||
    ua.includes('discordbot') ||
    ua.includes('googlebot') ||
    ua.includes('bingbot') ||
    ua.includes('applebot') ||
    ua.includes('embedly') ||
    ua.includes('semrushbot') ||
    ua.includes('ahrefsbot') ||
    ua.includes('screaming frog') ||
    ua.includes('rogerbot')
  );
}

/** Convert any string to a URL-safe slug (mirrors generateSlug in SEO.tsx) */
function generateSlug(text = '') {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 60);
}

/** Fetch politician data from Supabase REST API */
async function fetchPoliticianMeta(nameSlug) {
  // We'll query promises and try to reconstruct politician data from slug
  const url = `${SUPABASE_URL}/rest/v1/promises?select=politician_name,status,fulfillment_score&limit=200`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!res.ok) return null;

  const promises = await res.json();
  if (!Array.isArray(promises)) return null;

  // Find the politician whose slug matches
  const found = promises.find((p) => generateSlug(p.politician_name || '') === nameSlug);
  if (!found) return null;

  const politicianName = found.politician_name;

  // Compute stats for this politician
  const mine = promises.filter((p) => p.politician_name === politicianName);
  const total = mine.length;
  let fulfilled = 0;
  mine.forEach((p) => {
    const s = (p.status || '').toLowerCase();
    if (s === 'fulfilled' || s === 'realizada' || s === 'cumprida') fulfilled++;
  });
  const pct = total > 0 ? Math.round((fulfilled / total) * 100) : 0;

  return {
    name: politicianName,
    total,
    fulfilled,
    pct,
    slug: nameSlug,
  };
}

/** Fetch promise data from Supabase REST API */
async function fetchPromiseMeta(promiseSlug) {
  const url = `${SUPABASE_URL}/rest/v1/promises?select=*&limit=100`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!res.ok) return null;

  const promises = await res.json();
  if (!Array.isArray(promises)) return null;

  const found = promises.find((p) => {
    const pSlug = generateSlug(p.promise_title || p.title || '');
    return pSlug === promiseSlug || p.id === promiseSlug;
  });

  if (!found) return null;

  return {
    title: found.promise_title || found.title || 'Promessa',
    description: found.promise_description || found.description || null,
    politician: found.politician_name || '',
    status: found.status || '',
    score: found.fulfillment_score || 0,
    slug: promiseSlug,
  };
}

/** Status labels for og:description */
const STATUS_LABELS = {
  cumprida: 'Cumprida',
  parcialmente_cumprida: 'Parcialmente Cumprida',
  em_andamento: 'Em Andamento',
  nao_iniciada: 'Pendente',
  pendente: 'Pendente',
  descumprida: 'Descumprida',
  fulfilled: 'Cumprida',
  partial: 'Parcialmente Cumprida',
  partial_fulfilled: 'Parcialmente Cumprida',
  broken: 'Descumprida',
  not_fulfilled: 'Descumprida',
  pending: 'Pendente',
  nao_classificada: 'Pendente'
};

const SITE_NAME = 'Promessômetro';
const DEFAULT_IMAGE = `${BASE_URL}/og-default.png`;

/** Replace meta-tag placeholders in the raw HTML string */
function injectMeta(html, { title, description, url, image = DEFAULT_IMAGE, type = 'website' }) {
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const safeDesc = description.replace(/"/g, '&quot;');
  const safeTitle = fullTitle.replace(/"/g, '&quot;');

  return html
    // document <title>
    .replace(/<title>[^<]*<\/title>/, `<title>${safeTitle}</title>`)

    // description
    .replace(/(<meta name="description" content=")[^"]*(")/i, `$1${safeDesc}$2`)

    // og:title
    .replace(/(<meta property="og:title" content=")[^"]*(")/i, `$1${safeTitle}$2`)

    // og:description
    .replace(/(<meta property="og:description" content=")[^"]*(")/i, `$1${safeDesc}$2`)

    // og:url
    .replace(/(<meta property="og:url" content=")[^"]*(")/i, `$1${url}$2`)

    // og:type
    .replace(/(<meta property="og:type" content=")[^"]*(")/i, `$1${type}$2`)

    // og:image
    .replace(/(<meta property="og:image" content=")[^"]*(")/i, `$1${image}$2`)

    // twitter:title
    .replace(/(<meta property="twitter:title" content=")[^"]*(")/i, `$1${safeTitle}$2`)

    // twitter:description
    .replace(/(<meta property="twitter:description" content=")[^"]*(")/i, `$1${safeDesc}$2`)

    // twitter:url
    .replace(/(<meta property="twitter:url" content=")[^"]*(")/i, `$1${url}$2`)

    // twitter:image
    .replace(/(<meta property="twitter:image" content=")[^"]*(")/i, `$1${image}$2`)

    // canonical link
    .replace(/(<link rel="canonical" href=")[^"]*(")/i, `$1${url}$2`);
}

export default async function middleware(request) {
  const { pathname } = new URL(request.url);
  const userAgent = request.headers.get('user-agent') || '';

  // Only intercept crawlers; regular users get the SPA directly
  if (!isCrawler(userAgent)) {
    return; // continue to next handler (serve SPA normally)
  }

  try {
    let meta = null;
    let pageType = 'website';
    let pageUrl = `${BASE_URL}${pathname}`;

    // --- /politico/:slug ---
    const politMatch = pathname.match(/^\/politico\/(.+)$/);
    if (politMatch) {
      const nameSlug = decodeURIComponent(politMatch[1]);
      const data = await fetchPoliticianMeta(nameSlug);

      if (data) {
        meta = {
          title: `${data.name} | ${SITE_NAME}`,
          description: `${data.name} tem ${data.pct}% de suas promessas cumpridas. Acompanhe o histórico completo de ${data.total} promessas rastreadas no Promessômetro.`,
          url: pageUrl,
          type: 'profile',
        };
      }
    }

    // --- /promessa/:slug ---
    const promMatch = pathname.match(/^\/promessa\/(.+)$/);
    if (promMatch) {
      const promSlug = decodeURIComponent(promMatch[1]);
      const data = await fetchPromiseMeta(promSlug);

      if (data) {
        const statusLabel = STATUS_LABELS[data.status] || data.status || 'Pendente';
        const desc = data.description
          ? `${data.politician}: ${statusLabel} (${data.score}/100). ${data.description.substring(0, 120)}...`
          : `${data.politician}: ${statusLabel} (${data.score}/100). Acompanhe a avaliação completa desta promessa no Promessômetro.`;

        meta = {
          title: `${data.title} — ${data.politician} | ${SITE_NAME}`,
          description: desc,
          url: pageUrl,
          type: 'article',
        };
      }
    }

    // If we couldn't load data, fall through to the default HTML
    if (!meta) return;

    // Fetch the SPA's index.html from Vercel's static files
    const htmlResponse = await fetch(new URL('/', request.url).toString(), {
      headers: { 'user-agent': 'internal-prerender' }, // avoid infinite loop
    });

    if (!htmlResponse.ok) return;

    const rawHtml = await htmlResponse.text();
    const injectedHtml = injectMeta(rawHtml, meta);

    return new Response(injectedHtml, {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'public, s-maxage=300, stale-while-revalidate=60',
        'x-prerender': '1',
      },
    });
  } catch (err) {
    console.error('[middleware] Error:', err);
    return; // fall through on error
  }
}
