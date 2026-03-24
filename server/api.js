import bodyParser from 'body-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const PORT = 8092;

const app = express();

// We load json files as data source
let DEALS = [];
let SALES = {};

app.use(bodyParser.json());
app.use(cors());
app.use(helmet());

app.get('/', (request, response) => {
  response.send({'ack': true});
});

app.get('/deals', (request, response) => {
  try {
    const page = Number(request.query.page) || 1;
    const size = Number(request.query.size) || 6;

    const start = (page - 1) * size;
    const end = start + size;
    const result = DEALS.slice(start, end);
    const pageCount = Math.max(1, Math.ceil(DEALS.length / size));

    return response.status(200).json({
      success: true,
      data: {
        result,
        meta: {
          currentPage: page,
          pageCount,
          size,
          total: DEALS.length
        }
      }
    });
  } catch (error) {
    console.log(error);
    return response.status(500).json({
      success: false,
      data: {
        result: [],
        meta: {
          currentPage: 1,
          pageCount: 1,
          size: 0,
          total: 0
        }
      }
    });
  }
});

app.get('/deals/search', (request, response) => {
  try {
    const toNumber = (value, fallback = 0) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    };

    const toTimestamp = value => {
      if (!value) return 0;
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const toDealTimestamp = value => {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return 0;
      return parsed > 1e12 ? parsed : parsed * 1000;
    };

    const limit = Math.max(1, toNumber(request.query.limit, 12));
    const maxPrice = request.query.price ? toNumber(request.query.price, Infinity) : Infinity;
    const minDate = toTimestamp(request.query.date);

    const filterByRaw = request.query.filterBy;
    const filterByTokens = Array.isArray(filterByRaw)
      ? filterByRaw
      : String(filterByRaw || '')
        .split(',')
        .map(token => token.trim())
        .filter(Boolean);

    const filterBySet = new Set(filterByTokens);

    const minDiscount = Math.max(
      0,
      toNumber(request.query.discountThreshold ?? request.query.minDiscount, 0)
    );
    const minComments = Math.max(
      0,
      toNumber(request.query.commentedThreshold ?? request.query.minComments, 0)
    );
    const minHot = toNumber(request.query.hotThreshold ?? request.query.minHot, 0);

    const favoriteIdsRaw = request.query.favorites ?? request.query.favoriteIds ?? '';
    const favoriteIds = new Set(
      String(favoriteIdsRaw)
        .split(',')
        .map(id => id.trim())
        .filter(Boolean)
    );

    let filtered = DEALS.filter(deal => {
      const dealPrice = toNumber(deal.price, 0);
      const dealDate = toDealTimestamp(deal.published);
      const dealDiscount = toNumber(deal.discount, 0);
      const dealComments = toNumber(deal.comments, 0);
      const dealHot = toNumber(deal.temperature, 0);
      const dealUuid = String(deal.uuid || '');

      if (dealPrice > maxPrice) return false;
      if (minDate && dealDate < minDate) return false;

      if (filterBySet.has('discount') && dealDiscount < minDiscount) return false;
      if (filterBySet.has('commented') && dealComments < minComments) return false;
      if (filterBySet.has('hot') && dealHot < minHot) return false;
      if (filterBySet.has('favorites') && !favoriteIds.has(dealUuid)) return false;

      return true;
    });

    const sortBy = request.query.sort || null;

    if (filterBySet.has('best-discount') || sortBy === 'best-discount') {
      filtered.sort((a, b) => toNumber(b.discount, 0) - toNumber(a.discount, 0));
    } else if (filterBySet.has('most-commented') || sortBy === 'most-commented') {
      filtered.sort((a, b) => toNumber(b.comments, 0) - toNumber(a.comments, 0));
    } else if (sortBy === 'price-desc' || filterBySet.has('price-desc')) {
      filtered.sort((a, b) => toNumber(b.price, 0) - toNumber(a.price, 0));
    } else if (sortBy === 'date-asc' || filterBySet.has('date-asc')) {
      filtered.sort((a, b) => toDealTimestamp(b.published) - toDealTimestamp(a.published));
    } else if (sortBy === 'date-desc' || filterBySet.has('date-desc')) {
      filtered.sort((a, b) => toDealTimestamp(a.published) - toDealTimestamp(b.published));
    } else {
      filtered.sort((a, b) => toNumber(a.price, 0) - toNumber(b.price, 0));
    }

    const results = filtered.slice(0, limit);

    return response.status(200).json({
      success: true,
      limit,
      total: filtered.length,
      results
    });
  } catch (error) {
    console.log(error);
    return response.status(500).json({
      success: false,
      limit: 0,
      total: 0,
      results: [],
      message: error.message
    });
  }
});

app.get('/deals/:id', (request, response) => {
  try {
    const { id } = request.params;
    const deal = DEALS.find(d => String(d.uuid) === String(id));

    if (!deal) {
      return response.status(404).json({
        success: false,
        data: null,
        message: 'Deal not found'
      });
    }

    return response.status(200).json({
      success: true,
      data: deal
    });
  } catch (error) {
    console.log(error);
    return response.status(500).json({
      success: false,
      data: null,
      message: error.message
    });
  }
});

app.get('/sales', (request, response) => {
  try {
    const { id } = request.query;
    const result = SALES[id] || [];

    return response.status(200).json({
      success: true,
      data: { result }
    });
  } catch (error) {
    console.log(error);
    return response.status(404).json({
      success: false,
      data: { result: [] }
    });
  }
});

app.get('/sales/search', (request, response) => {
  response.setHeader('Access-Control-Allow-Credentials', true)
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  )

  try {
    const { legoSetId } = request.query;
    const limit = Number(request.query.limit) || 12;
    
    let result = SALES[legoSetId] || [];
    
    // Sort by date descending (most recent first)
    result = Array.isArray(result) ? [...result] : [];
    result.sort((a, b) => {
      const aTime = Number(a.published) || 0;
      const bTime = Number(b.published) || 0;
      return bTime - aTime;
    });

    // Apply limit
    const results = result.slice(0, limit);

    return response.status(200).json({
      success: true,
      limit,
      total: result.length,
      results
    });
  } catch (error) {
    console.log(error);
    return response.status(500).json({
      success: false,
      limit: 0,
      total: 0,
      results: [],
      message: error.message
    });
  }
});


// Load data when module initializes
try {
  DEALS = JSON.parse(
    readFileSync(path.join(__dirname, 'sources', 'deals.json'), 'utf8')
  );
} catch (error) {
  try {
    DEALS = JSON.parse(
      readFileSync(path.join(__dirname, 'sources', 'dealabs.json'), 'utf8')
    );
  } catch (dealsError) {
    console.warn(`⚠️  ${dealsError}`);
  }
}

try {
  SALES = JSON.parse(
    readFileSync(path.join(__dirname, 'sources', 'vinted.json'), 'utf8')
  );
} catch (error) {
  console.warn(`⚠️  ${error}`);
}

// Export for Vercel serverless
export default app;

// For local development
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`📡 Running on port ${PORT}`);
  });
}
