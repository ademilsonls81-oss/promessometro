import axios from "axios";

const WIKIPEDIA_API = "https://pt.wikipedia.org/w/api.php";
const WIKIPEDIA_REST = "https://pt.wikipedia.org/api/rest_v1";
const APP_NAME = "Promessometro/1.0";
const CONTACT_EMAIL = "contato@promessometro.com.br";

const httpClient = axios.create({
  headers: {
    "User-Agent": `${APP_NAME} (${CONTACT_EMAIL})`
  }
});

export interface PoliticianPhoto {
  name: string;
  photoUrl: string | null;
  source: string;
}

function cleanPoliticianName(name: string): string {
  return name
    .replace(/^(Deputado|Senador|Governador|Prefeito|Presidente|Ver[eé]ador)\s+/i, "")
    .replace(/\s*(MDB|PT|PSL|PP|PSD|REPUBLICANOS|UNI[AÃ]O|PSB|PDT|PCdoB|PV|NOVO|CIDADANIA|PCDSOL|PODE|REDE|AGIR|AVANTE|SOLIDARIEDADE|PSC)\s*$/gi, "")
    .replace(/\,?\s*(SP|RJ|MG|BA|RS|PR|SC|PE|CE|PA|MA|GO|AM|ES|PI|MA|AL|SE|RO|RR|AP|TO|DF|MT|MS)\s*$/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function getImageUrlFromPage(pageTitle: string): Promise<string | null> {
  try {
    const pageRes = await httpClient.get(WIKIPEDIA_API, {
      params: {
        action: "query",
        titles: pageTitle,
        prop: "pageimages",
        piprop: "original",
        format: "json",
        origin: "*",
        redirects: 1
      }
    });

    const pages = pageRes.data?.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as any;
    if (!page || page.missing !== undefined) return null;

    const originalUrl = page.original?.source;
    if (originalUrl) {
      return originalUrl;
    }

    if (page.pageid) {
      const imageRes = await httpClient.get(WIKIPEDIA_API, {
        params: {
          action: "query",
          pageids: page.pageid,
          prop: "images",
          format: "json",
          origin: "*",
          redirects: 1
        }
      });

      const images = imageRes.data?.query?.pages?.[page.pageid]?.images || [];
      for (const img of images) {
        const title = img.title;
        if (/\.(jpg|jpeg|png|gif|svg)$/i.test(title) &&
            !title.toLowerCase().includes("icon") &&
            !title.toLowerCase().includes("logo") &&
            !title.toLowerCase().includes("banner") &&
            !title.toLowerCase().includes("bandeira") &&
            !title.toLowerCase().includes("emblema") &&
            !title.toLowerCase().includes("flag")) {

          const infoRes = await httpClient.get(WIKIPEDIA_API, {
            params: {
              action: "query",
              titles: title,
              prop: "imageinfo",
              iiprop: "url",
              iiurlwidth: 300,
              format: "json",
              origin: "*"
            }
          });

          const infoPage = Object.values(infoRes.data?.query?.pages || {})[0] as any;
          const url = infoPage?.imageinfo?.[0]?.url;
          if (url) return url;
        }
      }
    }

    return null;
  } catch (err) {
    console.error(`[PhotoService] Image fetch failed for "${pageTitle}":`, err);
    return null;
  }
}

export async function fetchPoliticianPhoto(name: string): Promise<PoliticianPhoto> {
  const cleanName = cleanPoliticianName(name);

  const searchQueries = [
    `"${cleanName}"`,
    `${cleanName}`,
    `"${cleanName}" político`,
    `"${cleanName}" político brasileiro`,
    `${cleanName} prefeito`,
    `${cleanName} governador`,
    `${cleanName} deputados`
  ];

  for (const query of searchQueries) {
    try {
      const searchRes = await httpClient.get(WIKIPEDIA_API, {
        params: {
          action: "query",
          list: "search",
          srsearch: query,
          format: "json",
          origin: "*",
          srlimit: 3
        }
      });

      const results = searchRes.data?.query?.search || [];

      for (const result of results) {
        const title = result.title;
        const score = result.wordcount || 0;

        if (score < 50) continue;

        const lowerTitle = title.toLowerCase();
        const skipTerms = ["filme", "filmes", "ator", "série", "novela", "desenho", "banda", "cant", "album", "romance", "esporte", "time", "clube", "jogador"];
        if (skipTerms.some(t => lowerTitle.includes(t))) continue;

        const photoUrl = await getImageUrlFromPage(title);
        if (photoUrl) {
          console.log(`[PhotoService] ✓ Found: "${name}" via "${title}" → ${photoUrl.substring(0, 80)}`);
          return { name, photoUrl, source: "wikipedia" };
        }
      }
    } catch (err) {
      console.error(`[PhotoService] Search failed for "${query}":`, err);
    }
  }

  console.log(`[PhotoService] ✗ No photo found for "${name}"`);
  return { name, photoUrl: null, source: "wikipedia" };
}

export async function fetchPoliticianPhotos(names: string[]): Promise<PoliticianPhoto[]> {
  const results = await Promise.all(names.map(name => fetchPoliticianPhoto(name)));
  return results;
}