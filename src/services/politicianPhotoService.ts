import axios from "axios";

const WIKIPEDIA_API = "https://pt.wikipedia.org/w/api.php";

export interface PoliticianPhoto {
  name: string;
  photoUrl: string | null;
  source: string;
}

export async function fetchPoliticianPhoto(name: string): Promise<PoliticianPhoto> {
  try {
    const searchName = name.replace(/^(Deputado|Senador|Governador|Prefeito|Presidente| Vereador)\s+/i, "").trim();

    const searchRes = await axios.get(WIKIPEDIA_API, {
      params: {
        action: "query",
        list: "search",
        srsearch: `${searchName} político brasileiro`,
        format: "json",
        origin: "*",
        srlimit: 1
      }
    });

    const searchResults = searchRes.data?.query?.search;
    if (!searchResults || searchResults.length === 0) {
      return { name, photoUrl: null, source: "wikipedia" };
    }

    const pageId = searchResults[0].pageid;

    const pageRes = await axios.get(WIKIPEDIA_API, {
      params: {
        action: "query",
        pageids: pageId,
        prop: "pageimages|extracts",
        piprop: "original",
        format: "json",
        origin: "*"
      }
    });

    const page = pageRes.data?.query?.pages?.[pageId];
    if (!page) {
      return { name, photoUrl: null, source: "wikipedia" };
    }

    return {
      name,
      photoUrl: page.original?.source || null,
      source: "wikipedia"
    };
  } catch (err) {
    console.error(`[PhotoService] Error fetching photo for ${name}:`, err);
    return { name, photoUrl: null, source: "wikipedia" };
  }
}

export async function fetchPoliticianPhotos(names: string[]): Promise<PoliticianPhoto[]> {
  const results = await Promise.all(names.map(name => fetchPoliticianPhoto(name)));
  return results;
}