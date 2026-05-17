const BASE     = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const BASE_VIEW = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view';

export function structureUrl(cas, size = '300x250') {
  if (!cas?.trim()) return null;
  return `${BASE}/compound/name/${encodeURIComponent(cas.trim())}/PNG?record_type=2d&image_size=${size}`;
}

async function getCID(cas) {
  const res = await fetch(`${BASE}/compound/name/${encodeURIComponent(cas.trim())}/cids/JSON`);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.IdentifierList?.CID?.[0] ?? null;
}

function findSection(sections, heading) {
  for (const s of sections ?? []) {
    if (s.TOCHeading === heading) return s;
    const found = findSection(s.Section, heading);
    if (found) return found;
  }
  return null;
}

export async function fetchGHS(cas) {
  if (!cas?.trim()) return null;
  try {
    const cid = await getCID(cas);
    if (!cid) return null;

    const res = await fetch(
      `${BASE_VIEW}/data/compound/${cid}/JSON?heading=GHS+Classification`
    );
    if (!res.ok) return { cid, hazardCodes: [], signalWord: '', pictogramUrls: [] };
    const data = await res.json();

    const ghsSec = findSection(data?.Record?.Section, 'GHS Classification');
    if (!ghsSec) return { cid, hazardCodes: [], signalWord: '', pictogramUrls: [] };

    const hCodes  = new Set();
    const picUrls = new Set();
    let signalWord = '';

    for (const info of ghsSec.Information ?? []) {
      for (const val of info.Value?.StringWithMarkup ?? []) {
        const text = val.String ?? '';

        // Signal word
        if (/^(Danger|Warning|Peligro|Advertencia)$/i.test(text.trim())) {
          signalWord = text.trim();
        }

        // H-codes
        const hMatch = text.match(/H\d{3}[A-Z]?/g);
        if (hMatch) hMatch.forEach(h => hCodes.add(h));

        // Pictogram URLs from markup
        for (const m of val.Markup ?? []) {
          if (m.URL?.includes('GHS')) picUrls.add(m.URL);
        }
      }
    }

    return {
      cid,
      hazardCodes:   [...hCodes].sort(),
      signalWord,
      pictogramUrls: [...picUrls],
    };
  } catch {
    return null;
  }
}

// Fetch GHS for a batch of CAS numbers with concurrency limit.
// onProgress(done, total) called after each item resolves.
export async function fetchGHSBatch(casNumbers, { concurrency = 3, onProgress } = {}) {
  const results = new Array(casNumbers.length).fill(null);
  let next = 0;
  let done = 0;
  const total = casNumbers.length;

  async function worker() {
    while (next < total) {
      const i = next++;
      const cas = casNumbers[i];
      results[i] = cas?.trim() ? await fetchGHS(cas) : null;
      onProgress?.(++done, total);
      // Respect PubChem rate limit (~5 req/s per process)
      await new Promise(r => setTimeout(r, 220));
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}
