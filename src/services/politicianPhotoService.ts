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

async function searchWikipediaPage(searchQuery: string): Promise<string | null> {
  try {
    const searchRes = await httpClient.get(WIKIPEDIA_API, {
      params: {
        action: "query",
        list: "search",
        srsearch: searchQuery,
        format: "json",
        origin: "*",
        srlimit: 5
      }
    });

    const results = searchRes.data?.query?.search;
    if (!results || results.length === 0) return null;

    for (const result of results) {
      if (result.title.toLowerCase().includes(searchQuery.toLowerCase().split(" ")[0])) {
        return result.title;
      }
    }

    return results[0].title;
  } catch (err) {
    console.error(`[PhotoService] Search failed for "${searchQuery}":`, err);
    return null;
  }
}

async function getPageImage(pageTitle: string): Promise<string | null> {
  try {
    const pageRes = await httpClient.get(WIKIPEDIA_API, {
      params: {
        action: "query",
        titles: pageTitle,
        prop: "pageimages",
        piprop: "original|thumbnail",
        format: "json",
        origin: "*",
        redirects: 1
      }
    });

    const pages = pageRes.data?.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as any;
    if (!page || page.missing !== undefined) return null;

    return page.original?.source || page.thumbnail?.source || null;
  } catch (err) {
    console.error(`[PhotoService] Image fetch failed for "${pageTitle}":`, err);
    return null;
  }
}

export async function fetchPoliticianPhoto(name: string): Promise<PoliticianPhoto> {
  const cleanName = cleanPoliticianName(name);

  const searchQueries = [
    cleanName,
    `${cleanName} (político)`,
    `${cleanName} (político brasileiro)`,
    `${cleanName} prefeitura`,
    `${cleanName} governor`
  ];

  for (const query of searchQueries) {
    const pageTitle = await searchWikipediaPage(query);
    if (!pageTitle) continue;

    const photoUrl = await getPageImage(pageTitle);
    if (photoUrl) {
      console.log(`[PhotoService] Found photo for "${name}" via "${pageTitle}"`);
      return { name, photoUrl, source: "wikipedia" };
    }
  }

  console.log(`[PhotoService] No photo found for "${name}"`);
  return { name, photoUrl: null, source: "wikipedia" };
}

export async function fetchPoliticianPhotos(names: string[]): Promise<PoliticianPhoto[]> {
  const results = await Promise.all(names.map(name => fetchPoliticianPhoto(name)));
  return results;
}