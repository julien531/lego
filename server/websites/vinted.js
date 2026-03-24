import { v5 as uuidv5 } from 'uuid';

const COOKIE = process.env.VINTED_COOKIE || '';
const BASE_URL = 'https://www.vinted.fr';
const SEARCH_ENDPOINT = `${BASE_URL}/api/v2/catalog/items`;

const isNotDefined = value => {
  return value == null || (typeof value === 'string' && value.trim().length === 0);
};

/**
 * Parse Vinted json response into normalized sales array.
 * @param {Object} data
 * @return {Array<Object>}
 */
const parse = data => {
  try {
    const items = Array.isArray(data?.items) ? data.items : [];

    return items.map(item => {
      const link = item?.url || '';
      const price = item?.total_item_price || item?.price || null;
      const photos = Array.isArray(item?.photos) ? item.photos : [];
      const firstPhoto = photos[0] || null;
      const photo = item?.photo || firstPhoto || null;
      const published = photo?.high_resolution?.timestamp || firstPhoto?.high_resolution?.timestamp || photo?.timestamp || null;

      return {
        link,
        photo: firstPhoto?.url || firstPhoto?.full_size_url || photo?.url || photo?.full_size_url || '',
        price,
        title: item?.title || '',
        published,
        uuid: uuidv5(link || `${item?.id || ''}-${item?.title || ''}`, uuidv5.URL)
      };
    });
  } catch (error) {
    console.error(error);
    return [];
  }
};

const buildSearchQueries = setId => {
  const id = String(setId || '').trim();

  if (isNotDefined(id)) {
    return [];
  }

  const queries = [
    id,
    `lego ${id}`,
    `lego city ${id}`,
    `lego set ${id}`,
    `lego ${id} neuf avec etiquette`,
    `lego ${id} neuf sans etiquette`,
    `lego ${id} neuf avec étiquette`,
    `lego ${id} neuf sans étiquette`
  ];

  return Array.from(new Set(queries));
};

const buildSearchParams = (searchText, { relaxed = false } = {}) => {
  const params = new URLSearchParams({
    page: '1',
    per_page: '96',
    search_text: searchText,
    catalog_ids: '',
    size_ids: '',
    material_ids: ''
  });

  if (!relaxed) {
    // Strict mode: prioritize LEGO brand and common new-like statuses.
    params.set('brand_ids', '89162');
    params.set('status_ids', '6,1,2');
  }

  return params;
};

const fetchCatalog = async (searchText, options = {}) => {
  const params = buildSearchParams(searchText, options);

  const headers = {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    pragma: 'no-cache',
    'cache-control': 'no-cache',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
  };

  if (!isNotDefined(COOKIE)) {
    headers.cookie = COOKIE;
  }

  const response = await fetch(`${SEARCH_ENDPOINT}?${params.toString()}`, {
    method: 'GET',
    headers,
    referrerPolicy: 'strict-origin-when-cross-origin'
  });

  if (!response.ok) {
    console.warn(`⚠️  Vinted response ${response.status} for query "${searchText}"`);
    return [];
  }

  const body = await response.json();
  return parse(body);
};

const dedupeSales = sales => {
  const seen = new Set();
  const unique = [];

  for (const sale of sales) {
    if (!sale?.uuid || seen.has(sale.uuid)) {
      continue;
    }

    seen.add(sale.uuid);
    unique.push(sale);
  }

  return unique.sort((a, b) => Number(b.published || 0) - Number(a.published || 0));
};

const filterSalesBySetId = (sales, setId) => {
  const id = String(setId || '').trim();
  if (isNotDefined(id)) {
    return [];
  }

  const idPattern = new RegExp(`\\b${id}\\b`, 'i');
  const filtered = sales.filter(sale => {
    const haystack = [sale?.title, sale?.link].filter(Boolean).join(' ');
    return idPattern.test(haystack);
  });

  return filtered;
};

const isLikelyCompleteSetListing = sale => {
  const text = String(sale?.title || '').toLowerCase();

  const blacklist = [
    /\blot\b/,
    /\bpiece\b|\bpieces\b|\bpi[eè]ce\b|\bpi[eè]ces\b/,
    /\bpart\b|\bparts\b/,
    /\bplate\b|\bmodified\b/,
    /\bverbinder\b|\bcrochet\b|\bsfuso\b/,
    /\bref\b|\br[eé]f[ée]rence\b/,
    /\bminifig\b|\bminifigure\b/
  ];

  return !blacklist.some(pattern => pattern.test(text));
};

const applyStrictSetFilter = (sales, setId) => {
  const byId = filterSalesBySetId(sales, setId);
  if (byId.length === 0) {
    return [];
  }

  const strict = byId.filter(isLikelyCompleteSetListing);
  return strict;
};

const scrape = async setId => {
  try {
    if (isNotDefined(setId)) {
      return [];
    }

    const allSales = [];
    const queries = buildSearchQueries(setId);

    for (const query of queries) {
      const strictResult = await fetchCatalog(query, { relaxed: false });
      allSales.push(...strictResult);

      // If strict query returns nothing, retry once with relaxed filters.
      if (strictResult.length === 0) {
        const relaxedResult = await fetchCatalog(query, { relaxed: true });
        allSales.push(...relaxedResult);
      }
    }

    const merged = dedupeSales(allSales);
    const byId = filterSalesBySetId(merged, setId);
    const strictFiltered = applyStrictSetFilter(merged, setId);

    if (strictFiltered.length > 0) {
      return strictFiltered;
    }

    // Requested behavior: only relax when the set id yields no match at all.
    if (byId.length > 0) {
      return byId;
    }

    return merged;
  } catch (error) {
    console.error(error);
    return [];
  }
};

export { scrape };
