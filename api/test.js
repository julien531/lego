import express from 'express';

const app = express();

app.get('/', (req, res) => {
  res.json({ ack: true, message: 'API is working!' });
});

app.get('/test', (req, res) => {
  res.json({ test: 'success' });
});

export default app;
