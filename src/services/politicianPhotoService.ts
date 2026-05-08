import axios from "axios";

const WIKIPEDIA_API = "https://pt.wikipedia.org/w/api.php";
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

function isValidImage(url: string | undefined | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return !lower.includes("poster") && !lower.includes("map") &&
         !lower.includes("chart") && !lower.includes("logo") &&
         !lower.includes("questionmark") && !lower.includes("default");
}

async function getInfoboxImage(pageTitle: string): Promise<string | null> {
  try {
    const res = await httpClient.get(WIKIPEDIA_API, {
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

    const pages = res.data?.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as any;
    if (!page || page.missing !== undefined) return null;

    const url = page.original?.source;
    if (isValidImage(url)) {
      console.log(`[PhotoService] ✓ Infobox image found: ${url.substring(0, 80)}`);
      return url;
    }

    return null;
  } catch (err) {
    console.error(`[PhotoService] InfoboxImage failed: ${pageTitle}`, err);
    return null;
  }
}

async function getGalleryFallback(pageTitle: string): Promise<string | null> {
  try {
    const res = await httpClient.get(WIKIPEDIA_API, {
      params: {
        action: "query",
        titles: pageTitle,
        prop: "images",
        format: "json",
        origin: "*",
        redirects: 1
      }
    });

    const page = Object.values(res.data?.query?.pages || {})[0] as any;
    const images: Array<{title: string}> = page?.images || [];

    for (const img of images) {
      const title = img.title;
      if (/\.(jpg|jpeg|png)$/i.test(title)) {
        const infoRes = await httpClient.get(WIKIPEDIA_API, {
          params: {
            action: "query",
            titles: title,
            prop: "imageinfo",
            iiprop: "url",
            iiurlwidth: 400,
            format: "json",
            origin: "*"
          }
        });

        const infoPage = Object.values(infoRes.data?.query?.pages || {})[0] as any;
        const url = infoPage?.imageinfo?.[0]?.url;
        if (isValidImage(url)) {
          console.log(`[PhotoService] ✓ Gallery fallback: ${url.substring(0, 80)}`);
          return url;
        }
      }
    }

    return null;
  } catch (err) {
    console.error(`[PhotoService] Gallery fallback failed: ${pageTitle}`, err);
    return null;
  }
}

export async function fetchPoliticianPhoto(name: string): Promise<PoliticianPhoto> {
  const cleanName = cleanPoliticianName(name);

  const queries = [
    `"${cleanName}"`,
    `${cleanName}`,
    `"${cleanName}" politico brasileiro`,
    `${cleanName} politico`,
    `${cleanName} prefeito`,
    `${cleanName} gobernador`
  ];

  for (const query of queries) {
    try {
      const searchRes = await httpClient.get(WIKIPEDIA_API, {
        params: {
          action: "query",
          list: "search",
          srsearch: query,
          format: "json",
          origin: "*",
          srlimit: 5
        }
      });

      const results = searchRes.data?.query?.search || [];

      for (const result of results) {
        const title = result.title;
        const lowerTitle = title.toLowerCase();

        if (lowerTitle.includes("filme") || lowerTitle.includes("ator") ||
            lowerTitle.includes("serie") || lowerTitle.includes("novela") ||
            lowerTitle.includes("banda") || lowerTitle.includes("cant") ||
            lowerTitle.includes("album") || lowerTitle.includes("time") ||
            lowerTitle.includes("desenho")) {
          continue;
        }

        const url = await getInfoboxImage(title);
        if (url) return { name, photoUrl: url, source: "wikipedia" };

        const fallbackUrl = await getGalleryFallback(title);
        if (fallbackUrl) return { name, photoUrl: fallbackUrl, source: "wikipedia" };
      }
    } catch (err) {
      console.error(`[PhotoService] Search failed: ${query}`, err);
    }
  }

  console.log(`[PhotoService] ✗ No photo for "${name}"`);
  return { name, photoUrl: null, source: "wikipedia" };
}

export async function fetchPoliticianPhotos(names: string[]): Promise<PoliticianPhoto[]> {
  return Promise.all(names.map(name => fetchPoliticianPhoto(name)));
}