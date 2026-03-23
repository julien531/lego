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
let activeFilter = null;
let activeSort = null;
let currentShowSize = 6;
let activeThresholdFilter = null;

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

const toNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatPrice = (amount, currency) => {
  const value = toNumber(amount);
  const symbol = currency === 'EUR' ? 'EUR' : '$';
  return `${value.toFixed(2)} ${symbol}`;
};

const getDealImage = deal => {
  return deal.photo || deal.image || deal.imageUrl || FALLBACK_DEAL_IMAGE;
};

const getDealById = (deals, id) => {
  return deals.find(deal => String(deal.id) === String(id));
};

/**
 * Set global value
 * @param {Array} result - deals to display
 * @param {Object} meta - pagination meta info
 */
const setCurrentDeals = ({result, meta}) => {
  currentDeals = result;
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
    const response = await fetch(
      `https://lego-api-blue.vercel.app/deals?page=${page}&size=${size}`
    );
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
    const response = await fetch(`https://lego-api-blue.vercel.app/sales?id=${id}`);
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
      <h2>Dealabs deals</h2>
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
      const source = deal.community || 'dealabs';

      return `
        <article class="deal ${isFavorite ? 'favorite-deal' : ''}" id="${deal.uuid}">
          <a class="deal-media" href="${deal.link}" target="_blank" rel="noopener noreferrer">
            <img src="${image}" alt="${deal.title}" loading="lazy" />
            <span class="deal-source">${source}</span>
          </a>
          <div class="deal-body">
            <span class="deal-id">Set #${deal.id}</span>
            <a class="deal-title" href="${deal.link}" target="_blank" rel="noopener noreferrer">${deal.title}</a>
            <div class="deal-footer">
              <span class="deal-price">${formatPrice(deal.price)}</span>
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

  sectionDeals.innerHTML = '<h2>Dealabs deals</h2>';
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
    const id = String(deal.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });

  const options = uniqueDeals.map(deal => `<option value="${deal.id}">${deal.id}</option>`).join('');

  selectLegoSetIds.innerHTML = options;

  const availableIds = uniqueDeals.map(deal => String(deal.id));
  if (selectedId && availableIds.includes(String(selectedId))) {
    selectLegoSetIds.value = selectedId;
  } else if (uniqueDeals.length > 0) {
    selectLegoSetIds.value = String(uniqueDeals[0].id);
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
  legoSetDropdownText.textContent = `Set #${deal.id}`;

  if (legoSetDropdownMenu) {
    const items = legoSetDropdownMenu.querySelectorAll('.lego-dropdown-item');
    items.forEach(item => {
      item.classList.toggle('active', item.dataset.id === String(deal.id));
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
        <button type="button" class="lego-dropdown-item" data-id="${deal.id}" role="option" aria-selected="false">
          <img src="${getDealImage(deal)}" alt="Set ${deal.id}" loading="lazy" />
          <span>Set #${deal.id}</span>
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
  renderSalesIndicators(salesData);
  renderSalesList(salesData);

  if (shouldScroll) {
    sectionSales.scrollIntoView({behavior: 'smooth', block: 'start'});
  }
};

/**
 * Render deals count indicator
 * @param  {Object} pagination
 */
const renderIndicators = pagination => {
  const {count} = pagination;
  spanNbDeals.textContent = count;
};

const renderSelectedSet = deal => {
  if (!deal) {
    selectedSetContainer.classList.remove('visible');
    selectedSetPreview.innerHTML = '';
    return;
  }

  const image = getDealImage(deal);
  selectedSetPreview.innerHTML = `
    <article class="selected-card">
      <img class="selected-image" src="${image}" alt="${deal.title}" loading="lazy" />
      <div class="selected-content">
        <span class="selected-id">Set #${deal.id}</span>
        <p class="selected-title">${deal.title}</p>
        <div class="selected-meta">
          <span class="selected-price">${formatPrice(deal.price)}</span>
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

  const dates = sales.map(sale => toNumber(sale.published));
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const lifetimeDays = Math.floor((maxDate - minDate) / (60 * 60 * 24));
  const lifetime80Days = Math.floor(lifetimeDays * 0.8);

  spanLifetimeSales.textContent = `${lifetime80Days} days`;
};

const renderSalesList = sales => {
  if (!sales || sales.length === 0) {
    sectionSales.innerHTML = `
      <h2>Vinted sales</h2>
      <p class="muted-state">No sales found for this set.</p>
    `;
    return;
  }

  const template = sales
    .map(sale => {
      const date = new Date(toNumber(sale.published) * 1000).toLocaleDateString();
      const priceLabel = formatPrice(sale.price.amount, sale.price.currency_code);

      return `
        <article class="sale">
          <img class="sale-logo" src="${VINTED_LOGO_IMAGE}" alt="Vinted" loading="lazy" />
          <div class="sale-main">
            <a href="${sale.link}" target="_blank" rel="noopener noreferrer">${sale.title}</a>
            <span class="sale-date">${date}</span>
          </div>
          <span class="sale-price">${priceLabel}</span>
        </article>
      `;
    })
    .join('');

  sectionSales.innerHTML = `
    <h2>Vinted sales</h2>
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

const render = (deals, pagination) => {
  const filteredDeals = applyFilter(deals);
  const sortedDeals = applySort(filteredDeals);

  renderDeals(sortedDeals);
  renderPagination(pagination);
  renderIndicators(pagination);
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