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
app.use(cors())

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
    const limit = Number(request.query.limit) || 12;
    const maxPrice = request.query.price ? Number(request.query.price) : Infinity;
    const minDate = request.query.date ? new Date(request.query.date).getTime() : 0;
    const filterBy = request.query.filterBy || null;

    let filtered = DEALS.filter(deal => {
      if (Number(deal.price) > maxPrice) return false;
      if (Number(deal.published) * 1000 < minDate) return false;
      return true;
    });

    // Apply filterBy logic
    if (filterBy === 'best-discount') {
      filtered.sort((a, b) => Number(b.discount) - Number(a.discount));
    } else if (filterBy === 'most-commented') {
      filtered.sort((a, b) => Number(b.comments) - Number(a.comments));
    } else {
      // Default: sort by price ascending
      filtered.sort((a, b) => Number(a.price) - Number(b.price));
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


app.listen(PORT, () => {
  // when we start the server we load available json files
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
})

console.log(`📡 Running on port ${PORT}`);
