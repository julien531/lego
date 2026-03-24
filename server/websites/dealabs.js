import * as cheerio from 'cheerio';
import { v5 as uuidv5 } from 'uuid';

const BASE_URL = 'https://www.dealabs.com';
const PEPPER_CDN = 'https://static-pepper.dealabs.com';

const asNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const extractSetId = title => {
  if (!title) {
    return '';
  }

  const match = String(title).match(/\b\d{4,8}\b/);
  return match ? match[0] : '';
};

const getPhotoUrl = mainImage => {
  if (!mainImage?.path || !mainImage?.name) {
    return '';
  }

  // Dealabs mainImage is a CDN descriptor; render a stable 300x300 thumbnail URL.
  return `${PEPPER_CDN}/${mainImage.path}/${mainImage.name}/re/300x300/qt/60/${mainImage.name}.jpg`;
};

const getRetailPrice = ({ nextBestPrice, price, discount }) => {
  const referencePrice = asNumber(nextBestPrice);
  if (referencePrice > 0) {
    return referencePrice;
  }

  const salePrice = asNumber(price);
  const percentage = asNumber(discount);

  if (salePrice > 0 && percentage > 0 && percentage < 100) {
    return Number((salePrice / (1 - (percentage / 100))).toFixed(2));
  }

  return salePrice;
};

const getDiscount = ({ percentage, price, retail }) => {
  const explicit = asNumber(percentage);
  if (explicit > 0) {
    return explicit;
  }

  const salePrice = asNumber(price);
  const originalPrice = asNumber(retail);

  if (salePrice > 0 && originalPrice > salePrice) {
    return Math.round(((originalPrice - salePrice) / originalPrice) * 100);
  }

  return 0;
};

/**
 * Parse Dealabs group page and return normalized deals.
 * @param {string} data - html response
 * @returns {Array<Object>} deals
 */
const parse = data => {
  const $ = cheerio.load(data);

  return $('article.thread')
    .map((i, element) => {
      const rawVueData = $(element)
        .find('div.js-vue3[data-vue3]')
        .first()
        .attr('data-vue3');

      if (!rawVueData) {
        return null;
      }

      try {
        const vueData = JSON.parse(rawVueData);
        const thread = vueData?.props?.thread;

        if (!thread) {
          return null;
        }

        const link = thread.link || `${BASE_URL}/bons-plans/${thread.titleSlug}-${thread.threadId}`;
        const price = asNumber(thread.price);
        const retail = getRetailPrice({
          nextBestPrice: thread.nextBestPrice,
          price,
          discount: thread.percentage
        });
        const discount = getDiscount({
          percentage: thread.percentage,
          price,
          retail
        });
        const title = thread.title || '';

        return {
          comments: asNumber(thread.commentCount),
          community: 'dealabs',
          discount,
          id: extractSetId(title),
          link,
          linkHost: thread.linkHost || '',
          merchant: thread.merchant?.merchantName || '',
          nextBestPrice: asNumber(thread.nextBestPrice),
          photo: getPhotoUrl(thread.mainImage),
          price,
          published: asNumber(thread.publishedAt),
          retail,
          shareableLink: thread.shareableLink || '',
          temperature: asNumber(thread.temperature),
          threadId: String(thread.threadId || ''),
          title,
          uuid: uuidv5(link, uuidv5.URL)
        };
      } catch (error) {
        return null;
      }
    })
    .get()
    .filter(Boolean);
};

/**
 * Scrape a given Dealabs group page.
 * @param {string} url - url to parse and scrape
 * @returns {Promise<Array<Object>|null>} deals
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

export { scrape };