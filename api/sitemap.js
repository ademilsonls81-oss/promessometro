import { createClient } from '@supabase/supabase-js';

const cors = require('cors');

const supabaseUrl = process.env.VITE_S_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const BASE_URL = process.env.VITE_APP_URL || process.env.APP_URL || 'https://promessometro-brasil.vercel.app';

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 60);
}

module.exports = async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/sitemap.xml') {
    try {
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');

      const staticRoutes = [
        { url: '/', changefreq: 'weekly', priority: '1.0' },
        { url: '/promessas', changefreq: 'daily', priority: '0.9' },
        { url: '/ranking', changefreq: 'daily', priority: '0.9' },
        { url: '/metodologia', changefreq: 'monthly', priority: '0.5' },
        { url: '/fontes', changefreq: 'monthly', priority: '0.5' },
        { url: '/quem-somos', changefreq: 'monthly', priority: '0.5' },
        { url: '/como-funciona', changefreq: 'monthly', priority: '0.5' },
        { url: '/privacidade', changefreq: 'yearly', priority: '0.3' },
        { url: '/termos', changefreq: 'yearly', priority: '0.3' },
        { url: '/correcoes', changefreq: 'monthly', priority: '0.6' },
      ];

      let politicianUrls: Array<{url: string; changefreq: string; priority: string; lastmod?: string}> = [];
      let promiseUrls: Array<{url: string; changefreq: string; priority: string; lastmod?: string}> = [];

      try {
        const { data: politicians } = await supabase
          .from('promises')
          .select('politician_name, updated_at')
          .limit(500);

        const seenP = new Set<string>();
        politicians?.forEach((p: any) => {
          const name = p.politician_name;
          if (name && !seenP.has(name)) {
            seenP.add(name);
            const slug = generateSlug(name);
            politicianUrls.push({
              url: `/politico/${slug}`,
              changefreq: 'weekly',
              priority: '0.8',
              lastmod: p.updated_at ? new Date(p.updated_at).toISOString().split('T')[0] : undefined
            });
          }
        });

        const { data: promises } = await supabase
          .from('promises')
          .select('promise_title, title, updated_at')
          .limit(1000);

        const seenProm = new Set<string>();
        promises?.forEach((p: any) => {
          const title = p.promise_title || p.title;
          if (title && !seenProm.has(title)) {
            seenProm.add(title);
            const slug = generateSlug(title);
            promiseUrls.push({
              url: `/promessa/${slug}`,
              changefreq: 'weekly',
              priority: '0.7',
              lastmod: p.updated_at ? new Date(p.updated_at).toISOString().split('T')[0] : undefined
            });
          }
        });
      } catch (dbError) {
        console.warn('[Sitemap] DB error, using static only:', dbError);
      }

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${staticRoutes.map(r => `  <url>
    <loc>${BASE_URL}${r.url}</loc>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`).join('\n')}
${politicianUrls.map(p => `  <url>
    <loc>${BASE_URL}${p.url}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>${p.lastmod ? `\n    <lastmod>${p.lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
${promiseUrls.map(p => `  <url>
    <loc>${BASE_URL}${p.url}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>${p.lastmod ? `\n    <lastmod>${p.lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>`;

      res.status(200).send(xml);
    } catch (error) {
      console.error('[Sitemap] Error:', error);
      res.status(500).send('Error generating sitemap');
    }
  } else {
    res.status(404).send('Not found');
  }
};