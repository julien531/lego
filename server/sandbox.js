/* eslint-disable no-console, no-process-exit */
import * as avenuedelabrique from './websites/avenuedelabrique.js';
import * as dealabs from './websites/dealabs.js';
import * as vinted from './websites/vinted.js';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function saveJson (relativeFilePath, data) {
  const outputFile = path.join(__dirname, relativeFilePath);
  await writeFile(outputFile, JSON.stringify(data, null, 2), 'utf8');
  return outputFile;
}

async function loadJson (relativeFilePath, defaultValue) {
  const filePath = path.join(__dirname, relativeFilePath);

  try {
    const content = await readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return defaultValue;
  }
}

async function scrapeADLB (website = 'https://www.avenuedelabrique.com/promotions-et-bons-plans-lego') {
  try {
    console.log(`🕵️‍♀️  browsing ${website} website`);

    const deals = await avenuedelabrique.scrape(website);
    const outputFile = await saveJson('sources/avenuedelabrique.json', deals);

    console.log(`saved ${deals?.length || 0} deal(s) in ${outputFile}`);
    console.log(deals);
    console.log('done');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

async function scrapeVinted (lego) {
  try {
    console.log(`🕵️‍♀️  scraping lego ${lego} from vinted.fr`);

    const sales = await vinted.scrape(lego);
    const payload = { [String(lego)]: sales || [] };
    const outputFile = await saveJson('sources/vinted.json', payload);

    console.log(`saved ${(sales || []).length} sale(s) in ${outputFile}`);
    console.log(payload);
    console.log('done');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

const isValidLegoSetId = value => /^\d{4,8}$/.test(String(value || '').trim());

const extractLegoSetIds = ({ dealabsDeals, adlbDeals }) => {
  const ids = new Set();

  for (const deal of dealabsDeals || []) {
    const id = String(deal?.id || '').trim();
    if (isValidLegoSetId(id)) {
      ids.add(id);
    }
  }

  // Include only a subset of ADLB ids to broaden coverage without over-querying Vinted.
  const adlbSubset = (adlbDeals || []).slice(0, 12);
  for (const deal of adlbSubset) {
    const id = String(deal?.id || '').trim();
    if (isValidLegoSetId(id)) {
      ids.add(id);
    }
  }

  return Array.from(ids);
};

const scrapeVintedBySetIds = async setIds => {
  const salesBySetId = {};

  for (const setId of setIds) {
    try {
      console.log(`🧪 scraping vinted for set ${setId}`);
      const sales = await vinted.scrape(setId);
      salesBySetId[setId] = sales || [];
      console.log(`   -> ${salesBySetId[setId].length} sale(s)`);
    } catch (error) {
      console.warn(`⚠️  unable to scrape vinted for set ${setId}: ${error}`);
      salesBySetId[setId] = [];
    }
  }

  return salesBySetId;
};

async function retryVintedMissing () {
  try {
    console.log('🕵️‍♀️  retrying empty or missing vinted sets');

    const [dealabsDeals, adlbDeals, existingSales] = await Promise.all([
      loadJson('sources/dealabs.json', []),
      loadJson('sources/avenuedelabrique.json', []),
      loadJson('sources/vinted.json', {})
    ]);

    const targetIds = extractLegoSetIds({
      dealabsDeals,
      adlbDeals
    });

    const idsToRetry = targetIds.filter(id => {
      const sales = existingSales[id];
      return !Array.isArray(sales) || sales.length === 0;
    });

    console.log(`retry targets: ${idsToRetry.length}`);

    if (idsToRetry.length === 0) {
      console.log('nothing to retry');
      process.exit(0);
    }

    const retriedSales = await scrapeVintedBySetIds(idsToRetry);
    const mergedSales = {
      ...existingSales,
      ...retriedSales
    };

    const outputFile = await saveJson('sources/vinted.json', mergedSales);
    const remainingEmpty = targetIds.filter(id => !Array.isArray(mergedSales[id]) || mergedSales[id].length === 0);

    console.log(`saved ${Object.keys(mergedSales).length} vinted set(s) in ${outputFile}`);
    console.log(`remaining empty sets: ${remainingEmpty.length}`);
    console.log('done');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

async function scrapeDealabs (website = 'https://www.dealabs.com/groupe/lego') {
  try {
    console.log(`🕵️‍♀️  browsing ${website} website`);

    const deals = await dealabs.scrape(website);
    const outputFile = await saveJson('sources/dealabs.json', deals);

    console.log(`saved ${deals?.length || 0} deal(s) in ${outputFile}`);
    console.log(deals);
    console.log('done');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

async function scrapeAllDeals () {
  try {
    console.log('🕵️‍♀️  scraping Dealabs, Avenue de la Brique and Vinted');

    const [dealabsDeals, adlbDeals] = await Promise.all([
      dealabs.scrape('https://www.dealabs.com/groupe/lego'),
      avenuedelabrique.scrape('https://www.avenuedelabrique.com/promotions-et-bons-plans-lego')
    ]);

    const normalizedDealabs = (dealabsDeals || []).map(deal => ({
      ...deal,
      comments: typeof deal.comments === 'number' ? deal.comments : 0,
      community: deal.community || 'dealabs',
      id: deal.id || '',
      photo: deal.photo || '',
      retail: typeof deal.retail === 'number' ? deal.retail : deal.price || 0,
      temperature: typeof deal.temperature === 'number' ? deal.temperature : 0
    }));

    const normalizedAdlb = (adlbDeals || []).map(deal => ({
      ...deal,
      comments: typeof deal.comments === 'number' ? deal.comments : 0,
      community: deal.community || 'avenuedelabrique',
      id: deal.id || '',
      photo: deal.photo || '',
      retail: typeof deal.retail === 'number' ? deal.retail : deal.price || 0,
      published: deal.published || deal.scrapedAt || Math.floor(Date.now() / 1000),
      temperature: 0
    }));

    const mergedDeals = [...normalizedDealabs, ...normalizedAdlb];
    const setIds = extractLegoSetIds({
      dealabsDeals: normalizedDealabs,
      adlbDeals: normalizedAdlb
    });
    const salesBySetId = await scrapeVintedBySetIds(setIds);

    await saveJson('sources/dealabs.json', normalizedDealabs);
    await saveJson('sources/avenuedelabrique.json', normalizedAdlb);
    const mergedFile = await saveJson('sources/deals.json', mergedDeals);
    const vintedFile = await saveJson('sources/vinted.json', salesBySetId);

    console.log(`saved ${mergedDeals.length} merged deal(s) in ${mergedFile}`);
    console.log(`saved ${Object.keys(salesBySetId).length} vinted set(s) in ${vintedFile}`);
    console.log('done');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

const [,, param] = process.argv;

if (param === 'dealabs') {
  scrapeDealabs();
} else if (param === 'all') {
  scrapeAllDeals();
} else if (param === 'retry-vinted') {
  retryVintedMissing();
} else if ((param || '').startsWith('http')) {
  scrapeADLB(param);
} else if ((param || '').trim().length > 0) {
  scrapeVinted(param);
} else {
  scrapeADLB();
}
