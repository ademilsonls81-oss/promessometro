const name = 'Tarcísio de Freitas';
const keywords = 'incentivos fiscais desenvolvimento';

const queries = [
  `${name} ${keywords}`,
  `${name} desenvolvimento SP governo`,
  `${name}`,
];

for (const q of queries) {
  try {
    const params = new URLSearchParams({ q });
    const res = await fetch('https://html.duckduckgo.com/html/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      body: params.toString()
    });
    const text = await res.text();

    const results = [];
    const resultRegex = /<a rel="nofollow" class="result__a" href="([^"]+)">([\s\S]*?)<\/a>[\s\S]*?<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = resultRegex.exec(text)) !== null) {
      const url = match[1];
      const title = match[2].replace(/<[^>]+>/g, '').trim();
      const snippet = match[3].replace(/<[^>]+>/g, '').trim();
      if (title && url && !url.includes('duckduckgo.com')) {
        results.push({ title, url, snippet });
      }
    }

    console.log(`Query "${q.substring(0, 50)}": ${results.length} results`);
    for (const r of results.slice(0, 3)) {
      console.log(`  - ${r.title.substring(0, 60)} | ${r.url.substring(0, 60)}`);
    }
  } catch (e) {
    console.log(`Query "${q.substring(0, 50)}": ERROR ${e.message}`);
  }
}
