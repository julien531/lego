import * as cheerio from 'cheerio';
import { v5 as uuidv5 } from 'uuid';

const BASE_URL = 'https://www.avenuedelabrique.com';

const toAbsoluteUrl = value => {
  if (!value) {
    return '';
  }

  if (value.startsWith('http')) {
    return value;
  }

  const normalized = value.startsWith('/') ? value : `/${value}`;
  return `${BASE_URL}${normalized}`;
};

const normalizePhotoUrl = value => {
  const absolute = toAbsoluteUrl(value);

  if (!absolute) {
    return '';
  }

  let normalized = absolute;

  try {
    const parsed = new URL(absolute);

    // ADLB product images are served from /img/produits rather than /produits.
    if (parsed.pathname.startsWith('/produits/')) {
      parsed.pathname = `/img${parsed.pathname}`;
    }

    normalized = parsed.toString();
  } catch (error) {
    if (normalized.startsWith(`${BASE_URL}/produits/`)) {
      normalized = normalized.replace(`${BASE_URL}/produits/`, `${BASE_URL}/img/produits/`);
    }
  }

  // 0x180 thumbnails are frequently unavailable from hotlinked contexts.
  normalized = normalized.replace(/_0x180\.(jpg|jpeg|png|webp)$/i, '_1000x0.$1');

  return normalized;
};

const parseLocalizedNumber = value => {
  if (!value) {
    return 0;
  }

  const normalized = String(value)
    .replace(/&euro;|€/gi, '')
    .replace(',', '.')
    .replace(/[^0-9.-]/g, '');

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getRetailFromDiscount = (price, discount) => {
  if (price > 0 && discount > 0 && discount < 100) {
    return Number((price / (1 - (discount / 100))).toFixed(2));
  }

  return price;
};

const extractSetId = ({ title, link, reference }) => {
  const candidates = [reference, title, link].filter(Boolean);

  for (const candidate of candidates) {
    const match = String(candidate).match(/\b\d{4,8}\b/);
    if (match) {
      return match[0];
    }
  }

  // Fallback to internal reference when no numeric lego set id is present.
  return reference || '';
};
/**
 * Parse webpage data response
 * @param  {String} data - html response
 * @return {Object} deal
 */
const parse = data => {
  const $ = cheerio.load(data);

  return $('div.prods a')
    .map((i, element) => {
      const link = toAbsoluteUrl($(element).attr('href'));
      const title = $(element).attr('title') || '';
      const reference = $(element)
        .find('span.prodl-ref')
        .text()
        .trim();
      const price = parseLocalizedNumber(
        $(element)
          .find('span.prodl-prix span')
          .text()
      );
      const discount = Math.abs(parseInt(
        $(element)
          .find('span.prodl-reduc')
          .text(),
        10
      )) || 0;
      const photoDataSrc = $(element)
        .find('span.prodl-img img')
        .attr('data-src');
      const photoSrc = $(element)
        .find('span.prodl-img img')
        .attr('src');
      const photoLazySrc = $(element)
        .find('span.prodl-img img')
        .attr('data-lazy-src');
      const photo = normalizePhotoUrl(photoDataSrc || photoLazySrc || photoSrc);
      const id = extractSetId({ title, link, reference });
      const retail = getRetailFromDiscount(price, discount);

      return {
        comments: null,
        community: 'avenuedelabrique',
        discount,
        id,
        link,
        price,
        photo,
        published: null,
        reference,
        retail,
        scrapedAt: Math.floor(Date.now() / 1000),
        temperature: null,
        title,
        uuid: uuidv5(link, uuidv5.URL)
      };
    })
    .get();
};

/**
 * Scrape a given url page
 * @param {String} url - url to parse and scrape
 * @returns 
 */
const scrape = async url => {
  const response = await fetch(url);

  if (response.ok) {
    const body = await response.text();

    return parse(body);
  }

  console.error(response);

  return null;
};

export {scrape};