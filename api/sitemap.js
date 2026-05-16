import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BASE_URL = process.env.VITE_APP_URL || 'https://promessometro-brasil.vercel.app';

function generateSlug(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 60);
}

export default async (req, res) => {
  if (req.method === 'GET' && (req.url === '/api/sitemap.xml' || req.url === '/sitemap.xml' || req.url === '/api/sitemap')) {
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');

    const staticRoutes = [
      { url: '/', changefreq: 'weekly', priority: '1.0' },
      { url: '/promessas', changefreq: 'daily', priority: '0.9' },
      { url: '/ranking', changefreq: 'daily', priority: '0.9' },
      { url: '/metodologia', changefreq: 'monthly', priority: '0.5' },
      { url: '/fontes', changefreq: 'monthly', priority: '0.5' },
      { url: '/privacidade', changefreq: 'yearly', priority: '0.3' },
      { url: '/termos', changefreq: 'yearly', priority: '0.3' },
      { url: '/correcoes', changefreq: 'monthly', priority: '0.6' },
    ];

    let politicianUrls = [];
    let promiseUrls = [];

    try {
      const { data: politicians } = await supabase
        .from('promises')
        .select('politician_name, updated_at')
        .limit(500);

      const seenP = new Set();
      politicians?.forEach(p => {
        const name = p.politician_name;
        if (name && !seenP.has(name)) {
          seenP.add(name);
          politicianUrls.push({ url: `/politico/${generateSlug(name)}`, lastmod: p.updated_at ? new Date(p.updated_at).toISOString().split('T')[0] : undefined });
        }
      });

      const { data: promises } = await supabase
        .from('promises')
        .select('promise_title, updated_at')
        .limit(1000);

      const seenProm = new Set();
      promises?.forEach(p => {
        const title = p.promise_title;
        if (title && !seenProm.has(title)) {
          seenProm.add(title);
          promiseUrls.push({ url: `/promessa/${generateSlug(title)}`, lastmod: p.updated_at ? new Date(p.updated_at).toISOString().split('T')[0] : undefined });
        }
      });
    } catch (dbError) {
      console.warn('[Sitemap] DB error:', dbError.message);
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${staticRoutes.map(r => `  <url><loc>${BASE_URL}${r.url}</loc><changefreq>${r.changefreq}</changefreq><priority>${r.priority}</priority></url>`).join('\n')}
${politicianUrls.map(p => `  <url><loc>${BASE_URL}${p.url}</loc><changefreq>weekly</changefreq><priority>0.8</priority>${p.lastmod ? `\n    <lastmod>${p.lastmod}</lastmod>` : ''}</url>`).join('\n')}
${promiseUrls.map(p => `  <url><loc>${BASE_URL}${p.url}</loc><changefreq>weekly</changefreq><priority>0.7</priority>${p.lastmod ? `\n    <lastmod>${p.lastmod}</lastmod>` : ''}</url>`).join('\n')}
</urlset>`;

    return res.status(200).send(xml);
  }

  return res.status(404).send('Not found');
};