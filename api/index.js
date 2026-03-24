const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();

let DEALS = [];
let SALES = {};

app.use(bodyParser.json());
app.use(cors());
app.use(helmet());

// Load data on startup
const sourcesDir = path.join(__dirname, './sources');

try {
  DEALS = JSON.parse(fs.readFileSync(path.join(sourcesDir, 'deals.json'), 'utf8'));
} catch (error) {
  try {
    DEALS = JSON.parse(fs.readFileSync(path.join(sourcesDir, 'dealabs.json'), 'utf8'));
  } catch (dealsError) {
    console.warn('Failed to load deals:', dealsError.message);
  }
}

try {
  SALES = JSON.parse(fs.readFileSync(path.join(sourcesDir, 'vinted.json'), 'utf8'));
} catch (error) {
  console.warn('Failed to load sales:', error.message);
}

app.get('/', (request, response) => {
  response.json({ack: true});
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
    return response.status(500).json({success: false, message: error.message});
  }
});

app.get('/deals/:id', (request, response) => {
  try {
    const {id} = request.params;
    const foundDeal = DEALS.find(deal => deal.uuid === id);

    if (!foundDeal) {
      return response.status(404).json({success: false, message: `Deal ${id} not found`});
    }

    return response.status(200).json({success: true, deal: foundDeal});
  } catch (error) {
    return response.status(500).json({success: false, message: error.message});
  }
});

app.get('/sales/search', (request, response) => {
  try {
    const {legoSetId, limit = 12} = request.query;

    if (!legoSetId) {
      return response.status(400).json({success: false, message: 'Missing legoSetId'});
    }

    const sales = SALES[String(legoSetId)] || [];
    const results = sales.slice(0, limit);

    return response.status(200).json({
      success: true,
      legoSetId,
      limit: Number(limit),
      total: sales.length,
      results
    });
  } catch (error) {
    return response.status(500).json({success: false, message: error.message});
  }
});

app.get('/deals/search', (request, response) => {
  try {
    const limit = Number(request.query.limit) || 12;
    const price = Number(request.query.price);
    const date = request.query.date;
    const filterByParam = request.query.filterBy;
    const discountThreshold = Number(request.query.discountThreshold) || Number(request.query.minDiscount) || 0;
    const commentedThreshold = Number(request.query.commentedThreshold) || Number(request.query.minComments) || 0;
    const minHot = Number(request.query.minHot) || 0;
    const favorites = request.query.favorites || request.query.favoriteIds;
    const sort = request.query.sort;

    const filterBySet = new Set();
    if (filterByParam) {
      filterByParam.split(',').forEach(f => filterBySet.add(f.trim()));
    }

    let result = DEALS.filter(deal => {
      if (price && deal.price > price) return false;
      if (date) {
        const dateTimestamp = new Date(date).getTime();
        const dealTimestamp = new Date(deal.published).getTime();
        if (dealTimestamp < dateTimestamp) return false;
      }

      if (filterBySet.size > 0) {
        if (filterBySet.has('discount') || filterBySet.has('best-discount')) {
          if (!deal.discount || deal.discount < discountThreshold) return false;
        }
        if (filterBySet.has('commented') || filterBySet.has('most-commented')) {
          if (!deal.comments || deal.comments < commentedThreshold) return false;
        }
        if (filterBySet.has('hot')) {
          if (!deal.temperature || deal.temperature < minHot) return false;
        }
        if (filterBySet.has('favorites')) {
          if (!favorites) return false;
          const favoriteIds = typeof favorites === 'string' ? favorites.split(',').map(id => id.trim()) : [];
          if (!favoriteIds.includes(deal.uuid)) return false;
        }
      }

      return true;
    });

    // Sort results
    if (filterBySet.has('best-discount') || sort === 'best-discount') {
      result = result.sort((a, b) => (b.discount || 0) - (a.discount || 0));
    } else if (filterBySet.has('most-commented') || sort === 'most-commented') {
      result = result.sort((a, b) => (b.comments || 0) - (a.comments || 0));
    } else if (sort === 'price-asc') {
      result = result.sort((a, b) => a.price - b.price);
    } else if (sort === 'price-desc') {
      result = result.sort((a, b) => b.price - a.price);
    } else if (sort === 'date-asc') {
      result = result.sort((a, b) => {
        const aTime = new Date(a.published).getTime();
        const bTime = new Date(b.published).getTime();
        return aTime - bTime;
      });
    } else if (sort === 'date-desc') {
      result = result.sort((a, b) => {
        const aTime = new Date(a.published).getTime();
        const bTime = new Date(b.published).getTime();
        return bTime - aTime;
      });
    }

    const results = result.slice(0, limit);

    return response.status(200).json({
      success: true,
      limit,
      total: result.length,
      results
    });
  } catch (error) {
    return response.status(500).json({
      success: false,
      limit: 0,
      total: 0,
      results: [],
      message: error.message
    });
  }
});

module.exports = app;

// Export app for Vercel and support local development
const PORT = process.env.PORT || 8092;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
