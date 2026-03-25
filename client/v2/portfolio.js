// Invoking strict mode https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode#invoking_strict_mode
'use strict';

/**
Description of the available api
GET https://lego-api-blue.vercel.app/deals

Search for specific deals

This endpoint accepts the following optional query string parameters:

- `page` - page of deals to return
- `size` - number of deals to return

GET https://lego-api-blue.vercel.app/sales

Search for current Vinted sales for a given lego set id

This endpoint accepts the following optional query string parameters:

- `id` - lego set id to return
*/

// current deals on the page
let currentDeals = [];
let currentPagination = {};
let currentSales = [];
let activeFilter = null;
let activeSort = null;
let currentShowSize = 6;
let activeThresholdFilter = null;
let salesSortField = 'date';
let salesSortDirection = 'desc';

const filterThresholds = {
  discount: 50,
  commented: 15,
  hot: 100
};

const filterThresholdConfig = {
  discount: {title: 'Minimum discount', min: 0, max: 100, step: 1, unit: '%'},
  commented: {title: 'Minimum comments', min: 0, max: 120, step: 1, unit: ''},
  hot: {title: 'Minimum hot score', min: 0, max: 400, step: 5, unit: ''}
};

const FALLBACK_DEAL_IMAGE = 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=700&q=60';
const VINTED_LOGO_IMAGE = 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/31/Vinted_Logo.svg/320px-Vinted_Logo.svg.png';
const API_BASE_URL = window.LEGO_API_URL || 'https://server-flame-eta-87.vercel.app';

// instantiate the selectors
const selectShow = document.querySelector('#show-select');
const selectPage = document.querySelector('#page-select');
const selectSort = document.querySelector('#sort-select');
const selectLegoSetIds = document.querySelector('#lego-set-id-select');
const legoSetDropdown = document.querySelector('#lego-set-dropdown');
const legoSetDropdownBtn = document.querySelector('#lego-set-dropdown-btn');
const legoSetDropdownMenu = document.querySelector('#lego-set-dropdown-menu');
const legoSetDropdownImage = document.querySelector('#lego-set-dropdown-image');
const legoSetDropdownText = document.querySelector('#lego-set-dropdown-text');
const sectionSales = document.querySelector('#sales');
const sectionDeals = document.querySelector('#deals');
const filterContainer = document.querySelector('#filters');
const filterThresholdPopover = document.querySelector('#filter-threshold-popover');
const filterThresholdTitle = document.querySelector('#filter-threshold-title');
const filterThresholdValue = document.querySelector('#filter-threshold-value');
const filterThresholdRange = document.querySelector('#filter-threshold-range');
const selectedSetContainer = document.querySelector('#selected-set');
const selectedSetPreview = document.querySelector('#selected-set-preview');

const spanNbDeals = document.querySelector('#nbDeals');
const spanNbSales = document.querySelector('#nbSales');
const spanAvgSales = document.querySelector('#avgSalesValue');
const spanP5Sales = document.querySelector('#p5SalesValue');
const spanP25Sales = document.querySelector('#p25SalesValue');
const spanP50Sales = document.querySelector('#p50SalesValue');
const spanLifetimeSales = document.querySelector('#lifetimeSalesValue');

const getDealSetId = deal => {
  const direct = String(deal?.id || deal?.reference || '').trim();
  if (direct) return direct;

  const fromTitle = String(deal?.title || '').match(/\b\d{4,6}\b/);
  return fromTitle ? fromTitle[0] : '';
};

const toNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const pickColorByThresholds = (value, thresholds) => {
  for (const threshold of thresholds) {
    if (value >= threshold.min) {
      return threshold.color;
    }
  }

  return '#64748b';
};

const setIndicatorColor = (node, color) => {
  if (!node) return;
  node.style.backgroundColor = color;
};

const pickColorFromRange = (value, min, max) => {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return '#64748b';
  }

  const ratio = (value - min) / (max - min);

  if (ratio >= 0.8) return '#ef4444';
  if (ratio >= 0.6) return '#f59e0b';
  if (ratio >= 0.4) return '#16a34a';
  if (ratio >= 0.2) return '#0ea5e9';
  return '#64748b';
};

const getSortArrow = (field) => {
  if (salesSortField !== field) return '';
  return salesSortDirection === 'asc' ? '↑' : '↓';
};

const sortSales = sales => {
  const sorted = (sales || []).slice();

  const getValue = sale => {
    if (salesSortField === 'price') {
      return toNumber(sale?.price?.amount);
    }

    return toNumber(sale?.published);
  };

  sorted.sort((a, b) => {
    const aVal = getValue(a);
    const bVal = getValue(b);
    return salesSortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });

  return sorted;
};

const formatPrice = (amount, currency) => {
  const value = toNumber(amount);
  const symbol = currency === 'EUR' ? '€' : '$';
  return `${value.toFixed(2)} ${symbol}`;
};

const calculateOriginalPrice = (salePrice, discount) => {
  const price = toNumber(salePrice);
  const disc = toNumber(discount);
  if (disc >= 100 || disc <= 0) return price;
  return price / (1 - disc / 100);
};

const getOriginalPrice = deal => {
  const retail = toNumber(deal.retail);
  const price = toNumber(deal.price);

  if (retail > price) {
    return retail;
  }

  return calculateOriginalPrice(price, deal.discount);
};

const getDiscountPercent = deal => {
  const explicit = toNumber(deal.discount);
  if (explicit > 0) {
    return Math.round(explicit);
  }

  const price = toNumber(deal.price);
  const original = getOriginalPrice(deal);

  if (original > price && original > 0) {
    return Math.round(((original - price) / original) * 100);
  }

  return 0;
};

const formatTemperature = temperature => {
  const temp = toNumber(temperature);
  return `${Math.round(temp)}°`;
};

const getTemperatureColor = (temperature) => {
  const temp = toNumber(temperature);
  if (temp >= 200) return '#ff6b35';
  if (temp >= 100) return '#f7931e';
  if (temp >= 50) return '#ffd166';
  return '#cbd5e1';
};

const getTemperatureEmoji = (temperature) => {
  const temp = toNumber(temperature);
  if (temp >= 200) return '🔥';
  if (temp >= 100) return '⚡';
  if (temp >= 50) return '🌡️';
  return '❄️';
};

const getDealImage = deal => {
  return deal.photo || deal.image || deal.imageUrl || FALLBACK_DEAL_IMAGE;
};

const getSafeImageHtml = (src, alt, className = '') => {
  const classAttr = className ? ` class="${className}"` : '';
  return `<img${classAttr} src="${src}" alt="${alt}" loading="lazy" onerror="this.onerror=null;this.src='${FALLBACK_DEAL_IMAGE}';" />`;
};

const getDealById = (deals, id) => {
  return deals.find(deal => String(deal.setId || getDealSetId(deal)) === String(id));
};

const getSaleImage = sale => {
  return sale?.photo || VINTED_LOGO_IMAGE;
};

/**
 * Set global value
 * @param {Array} result - deals to display
 * @param {Object} meta - pagination meta info
 */
const setCurrentDeals = ({result, meta}) => {
  currentDeals = (result || []).map(deal => ({
    ...deal,
    setId: getDealSetId(deal)
  }));
  currentPagination = meta;
};

/**
 * Fetch deals from api
 * @param  {Number}  [page=1] - current page to fetch
 * @param  {Number}  [size=6] - size of the page
 * @return {Object}
 */
const fetchDeals = async (page = 1, size = 6) => {
  try {
    const response = await fetch(`${API_BASE_URL}/deals?page=${page}&size=${size}`);
    const body = await response.json();

    if (body.success !== true) {
      console.error(body);
      return {result: currentDeals, meta: currentPagination};
    }

    return body.data;
  } catch (error) {
    console.error(error);
    return {result: currentDeals, meta: currentPagination};
  }
};

/**
 * Fetch sales for a lego set id
 * @param {String} id
 * @return {Array|null}
 */
const fetchSales = async id => {
  try {
    const response = await fetch(`${API_BASE_URL}/sales?id=${id}`);
    const body = await response.json();

    if (body.success !== true) {
      return null;
    }

    return body.data.result;
  } catch (error) {
    console.error(error);
    return null;
  }
};

// functions for favorite button
const getFavorites = () => {
  const fav = localStorage.getItem('favorites');
  return fav ? JSON.parse(fav) : [];
};

const saveFavorites = favorites => {
  localStorage.setItem('favorites', JSON.stringify(favorites));
};

/**
 * Render list of deals
 * @param  {Array} deals
 */
const renderDeals = deals => {
  const favorites = getFavorites();
  const div = document.createElement('div');
  const footer = document.createElement('div');

  const pageCount = toNumber(currentPagination.pageCount);
  const currentPage = toNumber(currentPagination.currentPage);
  const isPrevDisabled = currentPage <= 1;
  const isNextDisabled = currentPage >= pageCount;

  if (!deals || deals.length === 0) {
    sectionDeals.innerHTML = `
      <h2>Deals (Dealabs + Avenue de la Brique)</h2>
      <p class="muted-state">No deal matches your current filters.</p>
    `;
    footer.innerHTML = `
      <div class="deals-footer">
        <div class="deals-pagination">
          <button type="button" class="deals-btn" data-action="prev-page" ${isPrevDisabled ? 'disabled' : ''} aria-label="Previous page">←</button>
          <span class="deals-page-info">Page ${currentPage || 1}/${pageCount || 1}</span>
          <button type="button" class="deals-btn" data-action="next-page" ${isNextDisabled ? 'disabled' : ''} aria-label="Next page">→</button>
        </div>
      </div>
    `;
    sectionDeals.appendChild(footer);
    return;
  }

  const template = deals
    .map(deal => {
      const isFavorite = favorites.includes(deal.uuid);
      const star = isFavorite ? '❤' : '♡';
      const image = getDealImage(deal);
      const community = deal.community || 'dealabs';
      const isDealabs = community === 'dealabs';
      const sourceEmoji = community === 'avenuedelabrique' ? '🧱' : '🧪';
      const sourceLabel = community === 'avenuedelabrique' ? 'Avenue de la Brique' : 'Dealabs';
      const discount = getDiscountPercent(deal);
      const originalPrice = getOriginalPrice(deal);
      const temperature = toNumber(deal.temperature);
      const temperatureLabel = formatTemperature(temperature);
      const temperatureBadge = isDealabs
        ? `<span class="deal-temperature" style="background-color: ${getTemperatureColor(temperature)}" title="Chaleur Dealabs: ${temperatureLabel}">${getTemperatureEmoji(temperature)} ${temperatureLabel}</span>`
        : '';
      const commentsLabel = isDealabs
        ? `<span class="deal-comments" title="Comments: ${deal.comments}">💬 ${deal.comments}</span>`
        : '';

      return `
        <article class="deal ${isFavorite ? 'favorite-deal' : ''}" id="${deal.uuid}">
          <a class="deal-media" href="${deal.link}" target="_blank" rel="noopener noreferrer">
            ${getSafeImageHtml(image, deal.title)}
            <span class="deal-source">${sourceEmoji} ${sourceLabel}</span>
            ${temperatureBadge}
          </a>
          <div class="deal-body">
            <span class="deal-id">Set #${deal.setId || 'N/A'}</span>
            <a class="deal-title" href="${deal.link}" target="_blank" rel="noopener noreferrer">${deal.title}</a>
            <div class="deal-prices">
              <span class="deal-original-price">${formatPrice(originalPrice)}</span>
              <span class="deal-price">${formatPrice(deal.price)}</span>
              <span class="deal-discount">-${discount}%</span>
            </div>
            <div class="deal-footer">
              ${commentsLabel}
              <button class="favorite-btn ${isFavorite ? 'active' : ''}" data-id="${deal.uuid}" aria-label="Toggle favorite">${star}</button>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  div.innerHTML = `${template}
    <article class="show-more-card" data-action="show-more-card" role="button" tabindex="0" aria-label="Load more deals">
      <div>
        <strong>Show more deals</strong>
        <span>Increase show by 6 and restart from page 1</span>
      </div>
    </article>
  `;
  footer.innerHTML = `
    <div class="deals-footer">
      <div class="deals-pagination">
        <button type="button" class="deals-btn" data-action="prev-page" ${isPrevDisabled ? 'disabled' : ''} aria-label="Previous page">←</button>
        <span class="deals-page-info">Page ${currentPage || 1}/${pageCount || 1}</span>
        <button type="button" class="deals-btn" data-action="next-page" ${isNextDisabled ? 'disabled' : ''} aria-label="Next page">→</button>
      </div>
    </div>
  `;

  sectionDeals.innerHTML = '<h2>Deals (Dealabs + Avenue de la Brique)</h2>';
  sectionDeals.appendChild(div);
  sectionDeals.appendChild(footer);
};

/**
 * Render page selector
 * @param  {Object} pagination
 */
const renderPagination = pagination => {
  const {currentPage, pageCount} = pagination;
  const options = Array.from(
    {length: pageCount},
    (value, index) => `<option value="${index + 1}">${index + 1}</option>`
  ).join('');

  selectPage.innerHTML = options;
  selectPage.selectedIndex = currentPage - 1;
};

/**
 * Render lego set ids selector
 * @param  {Array} deals
 */
const renderLegoSetIds = deals => {
  const selectedId = selectLegoSetIds.value;
  const seen = new Set();
  const uniqueDeals = deals.filter(deal => {
    const id = String(deal.setId || getDealSetId(deal));
    if (!id) return false;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const options = uniqueDeals.map(deal => `<option value="${deal.setId}">${deal.setId}</option>`).join('');

  selectLegoSetIds.innerHTML = options;

  const availableIds = uniqueDeals.map(deal => String(deal.setId));
  if (selectedId && availableIds.includes(String(selectedId))) {
    selectLegoSetIds.value = selectedId;
  } else if (uniqueDeals.length > 0) {
    selectLegoSetIds.value = String(uniqueDeals[0].setId);
  }

  renderLegoDropdownMenu(uniqueDeals);
  setLegoDropdownSelection(getDealById(deals, selectLegoSetIds.value));
};

const setLegoDropdownSelection = deal => {
  if (!legoSetDropdownImage || !legoSetDropdownText) return;

  if (!deal) {
    legoSetDropdownImage.src = FALLBACK_DEAL_IMAGE;
    legoSetDropdownText.textContent = 'Select a lego set';
    return;
  }

  legoSetDropdownImage.src = getDealImage(deal);
  legoSetDropdownImage.onerror = () => {
    legoSetDropdownImage.onerror = null;
    legoSetDropdownImage.src = FALLBACK_DEAL_IMAGE;
  };
  legoSetDropdownText.textContent = `Set #${deal.setId || 'N/A'}`;

  if (legoSetDropdownMenu) {
    const items = legoSetDropdownMenu.querySelectorAll('.lego-dropdown-item');
    items.forEach(item => {
      item.classList.toggle('active', item.dataset.id === String(deal.setId));
    });
  }
};

const renderLegoDropdownMenu = deals => {
  if (!legoSetDropdownMenu) return;

  if (!deals || deals.length === 0) {
    legoSetDropdownMenu.innerHTML = '<p class="muted-state">No lego sets available.</p>';
    return;
  }

  const template = deals
    .map(deal => {
      return `
        <button type="button" class="lego-dropdown-item" data-id="${deal.setId}" role="option" aria-selected="false">
          ${getSafeImageHtml(getDealImage(deal), `Set ${deal.setId}`)}
          <span>Set #${deal.setId}</span>
        </button>
      `;
    })
    .join('');

  legoSetDropdownMenu.innerHTML = template;
};

const closeLegoDropdown = () => {
  if (!legoSetDropdown || !legoSetDropdownBtn) return;
  legoSetDropdown.classList.remove('open');
  legoSetDropdownBtn.setAttribute('aria-expanded', 'false');
};

const toggleLegoDropdown = () => {
  if (!legoSetDropdown || !legoSetDropdownBtn) return;
  const isOpen = legoSetDropdown.classList.toggle('open');
  legoSetDropdownBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
};

const handleLegoSetSelection = async (id, shouldScroll = true) => {
  if (!id) return;

  const selectedDeal = getDealById(currentDeals, id);
  renderSelectedSet(selectedDeal);
  setLegoDropdownSelection(selectedDeal);

  const salesData = await fetchSales(id);
  currentSales = Array.isArray(salesData) ? salesData : [];
  renderSalesIndicators(salesData);
  renderSalesList(currentSales);

  if (shouldScroll) {
    sectionSales.scrollIntoView({behavior: 'smooth', block: 'start'});
  }
};

/**
 * Render deals count indicator
 * @param  {Object} pagination
 */
const renderIndicators = pagination => {
  const totalDeals = toNumber(pagination && (pagination.total ?? pagination.count));
  spanNbDeals.textContent = String(totalDeals);

  setIndicatorColor(
    spanNbDeals,
    pickColorByThresholds(totalDeals, [
      {min: 60, color: '#7f1d1d'},
      {min: 45, color: '#b91c1c'},
      {min: 30, color: '#15803d'},
      {min: 24, color: '#16a34a'},
      {min: 20, color: '#16a34a'},
      {min: 16, color: '#65a30d'},
      {min: 12, color: '#65a30d'},
      {min: 8, color: '#0ea5e9'},
      {min: 6, color: '#0ea5e9'}
    ])
  );

  if (!currentDeals || currentDeals.length === 0) return;

  const dealabsDeals = currentDeals.filter(deal => (deal.community || 'dealabs') === 'dealabs');

  const discounts = currentDeals
    .map(deal => toNumber(deal.discount))
    .filter(d => Number.isFinite(d));
  
  const temperatures = dealabsDeals
    .map(deal => toNumber(deal.temperature))
    .filter(t => Number.isFinite(t));
  
  const avgDiscount = discounts.length > 0 ? discounts.reduce((a, b) => a + b, 0) / discounts.length : 0;
  const maxDiscount = discounts.length > 0 ? Math.max(...discounts) : 0;
  const avgTemp = temperatures.length > 0 ? temperatures.reduce((a, b) => a + b, 0) / temperatures.length : 0;
  const maxTemp = temperatures.length > 0 ? Math.max(...temperatures) : 0;
  
  // Update additional indicator spans
  const spanAvgDiscount = document.querySelector('#avgDiscountValue');
  const spanMaxDiscount = document.querySelector('#maxDiscountValue');
  const spanAvgTemp = document.querySelector('#avgTempValue');
  const spanMaxTemp = document.querySelector('#maxTempValue');
  
  if (spanAvgDiscount) spanAvgDiscount.textContent = `${avgDiscount.toFixed(1)}%`;
  if (spanMaxDiscount) spanMaxDiscount.textContent = `${maxDiscount}%`;
  if (spanAvgTemp) spanAvgTemp.textContent = `${avgTemp.toFixed(0)}`;
  if (spanMaxTemp) spanMaxTemp.textContent = `${maxTemp}`;

  setIndicatorColor(
    spanAvgDiscount,
    pickColorByThresholds(avgDiscount, [
      {min: 90, color: '#7f1d1d'},
      {min: 80, color: '#ef4444'},
      {min: 65, color: '#f97316'},
      {min: 50, color: '#f59e0b'},
      {min: 40, color: '#facc15'},
      {min: 30, color: '#eab308'},
      {min: 22, color: '#22c55e'},
      {min: 15, color: '#16a34a'},
      {min: 8, color: '#0ea5e9'}
    ])
  );

  setIndicatorColor(
    spanMaxDiscount,
    pickColorByThresholds(maxDiscount, [
      {min: 90, color: '#7f1d1d'},
      {min: 80, color: '#ef4444'},
      {min: 65, color: '#f97316'},
      {min: 50, color: '#f59e0b'},
      {min: 40, color: '#facc15'},
      {min: 30, color: '#eab308'},
      {min: 22, color: '#22c55e'},
      {min: 15, color: '#16a34a'},
      {min: 8, color: '#0ea5e9'}
    ])
  );

  setIndicatorColor(
    spanAvgTemp,
    pickColorByThresholds(avgTemp, [
      {min: 400, color: '#7f1d1d'},
      {min: 250, color: '#ef4444'},
      {min: 180, color: '#f97316'},
      {min: 120, color: '#f59e0b'},
      {min: 80, color: '#facc15'},
      {min: 60, color: '#eab308'},
      {min: 35, color: '#22c55e'},
      {min: 20, color: '#0ea5e9'},
      {min: 10, color: '#94a3b8'}
    ])
  );

  setIndicatorColor(
    spanMaxTemp,
    pickColorByThresholds(maxTemp, [
      {min: 700, color: '#7f1d1d'},
      {min: 500, color: '#ef4444'},
      {min: 350, color: '#f97316'},
      {min: 250, color: '#f59e0b'},
      {min: 180, color: '#facc15'},
      {min: 120, color: '#eab308'},
      {min: 70, color: '#22c55e'},
      {min: 40, color: '#0ea5e9'},
      {min: 20, color: '#94a3b8'}
    ])
  );
};

const renderSelectedSet = deal => {
  if (!deal) {
    selectedSetContainer.classList.remove('visible');
    selectedSetPreview.innerHTML = '';
    return;
  }

  const image = getDealImage(deal);
  const community = deal.community || 'dealabs';
  const isDealabs = community === 'dealabs';
  const originalPrice = getOriginalPrice(deal);
  const temperature = toNumber(deal.temperature);
  const temperatureLabel = formatTemperature(temperature);
  const tempEmoji = getTemperatureEmoji(temperature);
  const selectedHotness = isDealabs
    ? `<span class="selected-hotness" style="color: ${getTemperatureColor(temperature)}">${tempEmoji} ${temperatureLabel}</span>`
    : '';
  
  selectedSetPreview.innerHTML = `
    <article class="selected-card">
      ${getSafeImageHtml(image, deal.title, 'selected-image')}
      <div class="selected-content">
        <span class="selected-id">Set #${deal.setId || 'N/A'}</span>
        <p class="selected-title">${deal.title}</p>
        <div class="selected-prices">
          <span class="selected-original-price">${formatPrice(originalPrice)}</span>
          <span class="selected-price">${formatPrice(deal.price)}</span>
        </div>
        <div class="selected-meta">
          ${selectedHotness}
          <a class="selected-link" href="${deal.link}" target="_blank" rel="noopener noreferrer">Open deal</a>
        </div>
      </div>
    </article>
  `;

  selectedSetContainer.classList.add('visible');
};

const renderSalesIndicators = sales => {
  if (!sales || sales.length === 0) {
    spanNbSales.textContent = '0';
    spanAvgSales.textContent = '0';
    spanP5Sales.textContent = '0';
    spanP25Sales.textContent = '0';
    spanP50Sales.textContent = '0';
    spanLifetimeSales.textContent = '0 days';

    setIndicatorColor(spanNbSales, '#64748b');
    setIndicatorColor(spanAvgSales, '#64748b');
    setIndicatorColor(spanP5Sales, '#64748b');
    setIndicatorColor(spanP25Sales, '#64748b');
    setIndicatorColor(spanP50Sales, '#64748b');
    setIndicatorColor(spanLifetimeSales, '#64748b');
    return;
  }

  spanNbSales.textContent = String(sales.length);

  const prices = sales
    .map(sale => toNumber(sale.price && sale.price.amount))
    .filter(price => Number.isFinite(price))
    .sort((a, b) => a - b);

  const sum = prices.reduce((acc, price) => acc + price, 0);
  const average = prices.length > 0 ? sum / prices.length : 0;

  const getPercentile = (arr, percentile) => {
    if (arr.length === 0) return 0;
    const index = Math.floor(percentile * (arr.length - 1));
    return arr[index];
  };

  spanAvgSales.textContent = formatPrice(average, sales[0].price && sales[0].price.currency_code);
  spanP5Sales.textContent = formatPrice(getPercentile(prices, 0.05), sales[0].price && sales[0].price.currency_code);
  spanP25Sales.textContent = formatPrice(getPercentile(prices, 0.25), sales[0].price && sales[0].price.currency_code);
  spanP50Sales.textContent = formatPrice(getPercentile(prices, 0.5), sales[0].price && sales[0].price.currency_code);

  const p5 = getPercentile(prices, 0.05);
  const p25 = getPercentile(prices, 0.25);
  const p50 = getPercentile(prices, 0.5);
  const minPrice = prices.length > 0 ? prices[0] : 0;
  const maxPrice = prices.length > 0 ? prices[prices.length - 1] : 0;

  const dates = sales.map(sale => toNumber(sale.published));
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const lifetimeDays = Math.floor((maxDate - minDate) / (60 * 60 * 24));
  const lifetime80Days = Math.floor(lifetimeDays * 0.8);

  spanLifetimeSales.textContent = `${lifetime80Days} days`;

  setIndicatorColor(
    spanNbSales,
    pickColorByThresholds(sales.length, [
      {min: 150, color: '#7f1d1d'},
      {min: 100, color: '#b91c1c'},
      {min: 80, color: '#15803d'},
      {min: 65, color: '#16a34a'},
      {min: 50, color: '#16a34a'},
      {min: 35, color: '#65a30d'},
      {min: 25, color: '#65a30d'},
      {min: 15, color: '#0ea5e9'},
      {min: 10, color: '#0ea5e9'}
    ])
  );

  setIndicatorColor(spanAvgSales, pickColorFromRange(average, minPrice, maxPrice));
  setIndicatorColor(spanP5Sales, pickColorFromRange(p5, minPrice, maxPrice));
  setIndicatorColor(spanP25Sales, pickColorFromRange(p25, minPrice, maxPrice));
  setIndicatorColor(spanP50Sales, pickColorFromRange(p50, minPrice, maxPrice));

  setIndicatorColor(
    spanLifetimeSales,
    pickColorByThresholds(lifetime80Days, [
      {min: 260, color: '#7f1d1d'},
      {min: 210, color: '#b91c1c'},
      {min: 180, color: '#15803d'},
      {min: 130, color: '#16a34a'},
      {min: 90, color: '#16a34a'},
      {min: 65, color: '#65a30d'},
      {min: 45, color: '#65a30d'},
      {min: 30, color: '#0ea5e9'},
      {min: 20, color: '#0ea5e9'}
    ])
  );
};

const renderSalesList = sales => {
  if (!sales || sales.length === 0) {
    sectionSales.innerHTML = `
      <h2>Vinted sales</h2>
      <p class="muted-state">No sales found for this set.</p>
    `;
    return;
  }

  const selectedDealId = selectLegoSetIds.value;
  const selectedDeal = getDealById(currentDeals, selectedDealId);
  const dealabsPrice = selectedDeal ? toNumber(selectedDeal.price) : null;
  const sortedSales = sortSales(sales);

  const salesToolbar = `
    <div class="sales-toolbar" aria-label="Sort Vinted sales">
      <button type="button" class="sales-sort-btn ${salesSortField === 'date' ? 'active' : ''}" data-sales-sort="date">
        Date ${getSortArrow('date')}
      </button>
      <button type="button" class="sales-sort-btn ${salesSortField === 'price' ? 'active' : ''}" data-sales-sort="price">
        Price ${getSortArrow('price')}
      </button>
    </div>
  `;

  const template = sortedSales
    .map(sale => {
      const date = new Date(toNumber(sale.published) * 1000).toLocaleDateString();
      const vintedPrice = toNumber(sale.price.amount);
      const salePrice = formatPrice(vintedPrice, sale.price.currency_code);
      
      let profitHTML = '';
      if (dealabsPrice !== null && Number.isFinite(dealabsPrice)) {
        const profit = vintedPrice - dealabsPrice;
        const profitColor = profit >= 0 ? '#15803d' : '#dc2626';
        const profitText = profit >= 0 ? `+${profit.toFixed(2)}` : `${profit.toFixed(2)}`;
        profitHTML = `<span class="sale-profit" style="color: ${profitColor}">${profitText}</span>`;
      }

      return `
        <article class="sale">
          <img class="sale-logo" src="${getSaleImage(sale)}" alt="${sale.title}" loading="lazy" onerror="this.onerror=null;this.src='${VINTED_LOGO_IMAGE}';" />
          <div class="sale-main">
            <a href="${sale.link}" target="_blank" rel="noopener noreferrer">${sale.title}</a>
            <span class="sale-date">${date}</span>
          </div>
          <div class="sale-pricing">
            <span class="sale-price">${salePrice}</span>
            ${profitHTML}
          </div>
        </article>
      `;
    })
    .join('');

  sectionSales.innerHTML = `
    <h2>Vinted sales</h2>
    ${salesToolbar}
    <div class="sales-list">
      ${template}
    </div>
  `;
};

const updateFilterButtonsState = () => {
  const singleButtons = filterContainer.querySelectorAll('.filter-btn[data-filter]');
  singleButtons.forEach(button => {
    const filter = button.dataset.filter;
    button.classList.toggle('active', filter === activeFilter);
  });

  const groups = filterContainer.querySelectorAll('.filter-group[data-filter]');
  groups.forEach(group => {
    const filter = group.dataset.filter;
    group.classList.toggle('active', filter === activeFilter);
  });
};

const closeThresholdPopover = () => {
  if (!filterThresholdPopover) return;
  filterThresholdPopover.classList.remove('visible');
  activeThresholdFilter = null;
};

const openThresholdPopover = (filterName, sourceElement) => {
  if (!filterThresholdPopover || !filterThresholdRange || !filterThresholdTitle || !filterThresholdValue) return;

  const config = filterThresholdConfig[filterName];
  if (!config) return;

  activeThresholdFilter = filterName;

  filterThresholdTitle.textContent = config.title;
  filterThresholdRange.min = String(config.min);
  filterThresholdRange.max = String(config.max);
  filterThresholdRange.step = String(config.step);
  filterThresholdRange.value = String(filterThresholds[filterName]);
  filterThresholdValue.textContent = `${filterThresholds[filterName]}${config.unit}`;

  if (sourceElement && filterContainer) {
    const sourceRect = sourceElement.getBoundingClientRect();
    const containerRect = filterContainer.getBoundingClientRect();
    const left = sourceRect.left - containerRect.left;
    filterThresholdPopover.style.left = `${Math.max(0, left - 120)}px`;
  }

  filterThresholdPopover.classList.add('visible');
};

const applyFilter = deals => {
  if (!activeFilter) {
    return deals;
  }

  if (activeFilter === 'discount') {
    return deals.filter(deal => toNumber(deal.discount) >= filterThresholds.discount);
  }

  if (activeFilter === 'commented') {
    return deals.filter(deal => toNumber(deal.comments) >= filterThresholds.commented);
  }

  if (activeFilter === 'hot') {
    return deals.filter(deal => toNumber(deal.temperature) >= filterThresholds.hot);
  }

  if (activeFilter === 'favorites') {
    const favorites = getFavorites();
    return deals.filter(deal => favorites.includes(deal.uuid));
  }

  return deals;
};

const applySort = deals => {
  if (!activeSort || activeSort === 'default') {
    return deals;
  }

  const sorted = deals.slice();

  if (activeSort === 'price-asc') {
    sorted.sort((a, b) => toNumber(a.price) - toNumber(b.price));
  }

  if (activeSort === 'price-desc') {
    sorted.sort((a, b) => toNumber(b.price) - toNumber(a.price));
  }

  if (activeSort === 'date-asc') {
    sorted.sort((a, b) => toNumber(a.published) - toNumber(b.published));
  }

  if (activeSort === 'date-desc') {
    sorted.sort((a, b) => toNumber(b.published) - toNumber(a.published));
  }

  return sorted;
};

const updateDealIndicators = deals => {
  const spanAvgDiscount = document.querySelector('#avgDiscountValue');
  const spanMaxDiscount = document.querySelector('#maxDiscountValue');
  const spanAvgTemp = document.querySelector('#avgTempValue');
  const spanMaxTemp = document.querySelector('#maxTempValue');

  if (!spanAvgDiscount || !spanMaxDiscount || !spanAvgTemp || !spanMaxTemp) {
    return;
  }

  if (!deals || deals.length === 0) {
    spanAvgDiscount.textContent = '0%';
    spanMaxDiscount.textContent = '0%';
    spanAvgTemp.textContent = '0';
    spanMaxTemp.textContent = '0';
    return;
  }

  const discounts = deals.map(deal => toNumber(deal.discount)).filter(value => value > 0);
  const temperatures = deals.map(deal => toNumber(deal.temperature)).filter(value => Number.isFinite(value));

  const avgDiscount = discounts.length > 0 ? discounts.reduce((sum, value) => sum + value, 0) / discounts.length : 0;
  const maxDiscount = discounts.length > 0 ? Math.max(...discounts) : 0;
  const avgTemp = temperatures.length > 0 ? temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length : 0;
  const maxTemp = temperatures.length > 0 ? Math.max(...temperatures) : 0;

  spanAvgDiscount.textContent = `${avgDiscount.toFixed(1)}%`;
  spanMaxDiscount.textContent = `${maxDiscount}%`;
  spanAvgTemp.textContent = `${avgTemp.toFixed(0)}`;
  spanMaxTemp.textContent = `${maxTemp}`;
};

const render = (deals, pagination) => {
  const filteredDeals = applyFilter(deals);
  const sortedDeals = applySort(filteredDeals);

  renderDeals(sortedDeals);
  renderPagination(pagination);
  renderIndicators(pagination);
  updateDealIndicators(sortedDeals);
  renderLegoSetIds(deals);

  updateFilterButtonsState();

  if (selectLegoSetIds.value) {
    const selectedDeal = getDealById(deals, selectLegoSetIds.value);
    renderSelectedSet(selectedDeal);
    setLegoDropdownSelection(selectedDeal);
  } else {
    setLegoDropdownSelection(null);
  }
};

sectionDeals.addEventListener('click', event => {
  const actionButton = event.target.closest('.deals-btn[data-action]');
  const showMoreCard = event.target.closest('.show-more-card[data-action]');

  if (actionButton || showMoreCard) {
    const action = actionButton ? actionButton.dataset.action : showMoreCard.dataset.action;

    if (action === 'prev-page' && toNumber(currentPagination.currentPage) > 1) {
      fetchAndRenderDeals(toNumber(currentPagination.currentPage) - 1, currentShowSize);
    }

    if (action === 'next-page' && toNumber(currentPagination.currentPage) < toNumber(currentPagination.pageCount)) {
      fetchAndRenderDeals(toNumber(currentPagination.currentPage) + 1, currentShowSize);
    }

    if (action === 'show-more-card') {
      currentShowSize += 6;
      ensureShowOption(currentShowSize);
      selectShow.value = String(currentShowSize);
      fetchAndRenderDeals(1, currentShowSize);
    }

    return;
  }

  if (!event.target.classList.contains('favorite-btn')) return;

  const dealId = event.target.dataset.id;
  let favorites = getFavorites();

  if (favorites.includes(dealId)) {
    favorites = favorites.filter(id => id !== dealId);
    event.target.textContent = '♡';
    event.target.classList.remove('active');
  } else {
    favorites.push(dealId);
    event.target.textContent = '❤';
    event.target.classList.add('active');
  }

  saveFavorites(favorites);
  render(currentDeals, currentPagination);
});

sectionDeals.addEventListener('keydown', event => {
  const showMoreCard = event.target.closest('.show-more-card[data-action="show-more-card"]');
  if (!showMoreCard) return;

  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    currentShowSize += 6;
    ensureShowOption(currentShowSize);
    selectShow.value = String(currentShowSize);
    fetchAndRenderDeals(1, currentShowSize);
  }
});

const fetchAndRenderDeals = async (page, size) => {
  const deals = await fetchDeals(page, size);
  setCurrentDeals(deals);
  render(currentDeals, currentPagination);
};

const ensureShowOption = value => {
  const valueAsString = String(value);
  const exists = Array.from(selectShow.options).some(option => option.value === valueAsString);
  if (exists) return;

  const option = document.createElement('option');
  option.value = valueAsString;
  option.textContent = valueAsString;
  selectShow.appendChild(option);
};

selectShow.addEventListener('change', async event => {
  currentShowSize = parseInt(event.target.value, 10);
  await fetchAndRenderDeals(toNumber(currentPagination.currentPage) || 1, currentShowSize);
});

selectPage.addEventListener('change', async event => {
  await fetchAndRenderDeals(parseInt(event.target.value, 10), currentShowSize);
});

selectSort.addEventListener('change', event => {
  activeSort = event.target.value === 'default' ? null : event.target.value;
  render(currentDeals, currentPagination);
});

filterContainer.addEventListener('click', event => {
  const control = event.target.closest('[data-filter][data-role], .filter-btn[data-filter][data-role]');
  if (!control) return;

  const filterName = control.dataset.filter;
  const role = control.dataset.role;
  if (!filterName || !role) return;

  if (role === 'toggle') {
    activeFilter = activeFilter === filterName ? null : filterName;

    if (activeFilter !== filterName) {
      closeThresholdPopover();
    }

    render(currentDeals, currentPagination);
    return;
  }

  if (role === 'threshold') {
    const isOpen = filterThresholdPopover.classList.contains('visible') && activeThresholdFilter === filterName;
    if (isOpen) {
      closeThresholdPopover();
    } else {
      openThresholdPopover(filterName, control);
    }
  }
});

if (filterThresholdRange) {
  filterThresholdRange.addEventListener('input', event => {
    if (!activeThresholdFilter) return;

    const value = toNumber(event.target.value);
    filterThresholds[activeThresholdFilter] = value;
    const config = filterThresholdConfig[activeThresholdFilter];
    filterThresholdValue.textContent = `${value}${config ? config.unit : ''}`;

    if (activeFilter === activeThresholdFilter) {
      render(currentDeals, currentPagination);
    }
  });
}

if (legoSetDropdownBtn) {
  legoSetDropdownBtn.addEventListener('click', event => {
    event.stopPropagation();
    toggleLegoDropdown();
  });
}

if (legoSetDropdownMenu) {
  legoSetDropdownMenu.addEventListener('click', event => {
    const item = event.target.closest('.lego-dropdown-item');
    if (!item) return;

    selectLegoSetIds.value = item.dataset.id;
    closeLegoDropdown();
    selectLegoSetIds.dispatchEvent(new Event('change'));
  });
}

document.addEventListener('click', event => {
  if (!legoSetDropdown) return;
  if (!legoSetDropdown.contains(event.target)) {
    closeLegoDropdown();
  }

  if (filterContainer && !filterContainer.contains(event.target)) {
    closeThresholdPopover();
  }
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeLegoDropdown();
  }
});

selectLegoSetIds.addEventListener('change', async event => {
  const id = event.target.value;
  await handleLegoSetSelection(id, true);
});

document.addEventListener('DOMContentLoaded', async () => {
  currentShowSize = parseInt(selectShow.value, 10) || 6;
  const deals = await fetchDeals(1, currentShowSize);

  setCurrentDeals(deals);
  activeSort = selectSort.value === 'default' ? null : selectSort.value;
  render(currentDeals, currentPagination);

  if (selectLegoSetIds.value) {
    const id = selectLegoSetIds.value;
    await handleLegoSetSelection(id, false);
  } else {
    setLegoDropdownSelection(null);
  }
});

sectionSales.addEventListener('click', event => {
  const sortBtn = event.target.closest('.sales-sort-btn[data-sales-sort]');
  if (!sortBtn) return;

  const field = sortBtn.dataset.salesSort;
  if (!field) return;

  if (salesSortField === field) {
    salesSortDirection = salesSortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    salesSortField = field;
    salesSortDirection = field === 'date' ? 'desc' : 'asc';
  }

  renderSalesList(currentSales);
});