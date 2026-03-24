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
    const result = SALES[legoSetId] || []

    return response.status(200).json({
      'success': true,
      'data': {'result': result}
    });
  } catch (error) {
    console.log(error);
    return response.status(404).send({
      'success': false,
      'data': {'result': []}
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
