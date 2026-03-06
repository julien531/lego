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

// instantiate the selectors
const selectShow = document.querySelector('#show-select');
const selectPage = document.querySelector('#page-select');
const selectLegoSetIds = document.querySelector('#lego-set-id-select');
const sectionSales = document.querySelector('#sales');
const sectionDeals= document.querySelector('#deals');
const spanNbDeals = document.querySelector('#nbDeals');

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
 * @param  {Number}  [size=12] - size of the page
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
      return {currentDeals, currentPagination};
    }

    return body.data;
  } catch (error) {
    console.error(error);
    return {currentDeals, currentPagination};
  }
};

/**
 * Render list of deals
 * @param  {Array} deals
 */
const renderDeals = deals => {
  const favorites = getFavorites();
  const fragment = document.createDocumentFragment();
  const div = document.createElement('div');
  const template = deals
    .map(deal => {
      const isFavorite = favorites.includes(deal.uuid);
      const star = isFavorite ? "*" : ".";
      return `
      <div class="deal" id=${deal.uuid}>
        <span>${deal.id}</span>
        <a href="${deal.link}" target="_blank">${deal.title}</a>  
        <span>${deal.price}</span>
        <button class="favorite-btn" data-id="${deal.uuid}">${star}</button>
      </div>
    `; // target="_blank" pour ouvrir le lien dans un nouvel onglet
    })
    .join('');

  div.innerHTML = template;
  fragment.appendChild(div);
  sectionDeals.innerHTML = '<h2>Deals</h2>';
  sectionDeals.appendChild(fragment);
};
// functions for favorite button
const getFavorites = () => {
    const fav = localStorage.getItem('favorites');
    return fav ? JSON.parse(fav) : [];
};

const saveFavorites = (favorites) => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
};

sectionDeals.addEventListener('click', (event) => {
    if (!event.target.classList.contains('favorite-btn')) return;

    const dealId = event.target.dataset.id;
    let favorites = getFavorites();

    if (favorites.includes(dealId)) {
        favorites = favorites.filter(id => id !== dealId);
        event.target.textContent = ".";
    } else {
        favorites.push(dealId);
        event.target.textContent = "*";
    }

    saveFavorites(favorites);
});


/**
 * Render page selector
 * @param  {Object} pagination
 */
const renderPagination = pagination => {
  const {currentPage, pageCount} = pagination;
  const options = Array.from(
    {'length': pageCount},
    (value, index) => `<option value="${index + 1}">${index + 1}</option>`
  ).join('');

  selectPage.innerHTML = options;
  selectPage.selectedIndex = currentPage - 1;
};

/**
 * Render lego set ids selector
 * @param  {Array} lego set ids
 */
const renderLegoSetIds = deals => {
  const ids = getIdsFromDeals(deals);
  const options = ids.map(id => 
    `<option value="${id}">${id}</option>`
  ).join('');

  selectLegoSetIds.innerHTML = options;
};

/**
 * Render page selector
 * @param  {Object} pagination
 */
const renderIndicators = pagination => {
  const {count} = pagination;

  spanNbDeals.innerHTML = count;
};

const render = (deals, pagination) => {
    const filteredDeals = applyFilter(deals) //changed filter deals
    var sortedDeals = applySort(filteredDeals); //changed sort deals
  renderDeals(sortedDeals);
  renderPagination(pagination);
  renderIndicators(pagination);
  renderLegoSetIds(deals)
};

/**
 * Declaration of all Listeners
 */

/**
 * Select the number of deals to display
 */
selectShow.addEventListener('change', async (event) => {
  const deals = await fetchDeals(currentPagination.currentPage, parseInt(event.target.value)); // parseInt ne sert pas [6,12,24]

  setCurrentDeals(deals);
  render(currentDeals, currentPagination);
});

selectPage.addEventListener('change', async (event) => {
    const deals = await fetchDeals(parseInt(event.target.value), parseInt(selectShow.value)); // parseInt des Integers 

    setCurrentDeals(deals);
    render(currentDeals, currentPagination);
});


// Feature 2, 3, 4: filters
let activeFilter = null;

const applyFilter = function (deals) {

    if (!activeFilter) { return deals; }

    if (activeFilter == 'discount') {
        var filtered = [];
        for (var i = 0; i < deals.length; i++) {
            if (deals[i].discount > 50) {
                filtered.push(deals[i]);
            }
        }
        return filtered;
    }

    if (activeFilter == 'commented') {
        var filtered = [];
        for (var i = 0; i < deals.length; i++) {
            if (deals[i].comments > 15) {
                filtered.push(deals[i]);
            }
        }
        return filtered;
    }

    if (activeFilter == 'hot') {
        var filtered = [];
        for (var i = 0; i < deals.length; i++) {
            if (deals[i].temperature > 100) {
                filtered.push(deals[i]);
            }
        }
        return filtered;
    }

    if (activeFilter == 'favorites') {
        var favorites = getFavorites();
        var filtered = [];
        for (var i = 0; i < deals.length; i++) {
            if (favorites.indexOf(deals[i].uuid) !== -1) {
                filtered.push(deals[i]);
            }
        }
        return filtered;
    }

    return deals;
};

const filterContainer = document.querySelector('#filters');

filterContainer.addEventListener('click', (event) => {
    const text = event.target.textContent;

    if (text === 'By best discount') {
        if (activeFilter == 'discount') { activeFilter = null; }
        else { activeFilter = 'discount'; }
    }

    if (text === 'By most commented') {
        if (activeFilter == 'commented') { activeFilter = null; }
        else { activeFilter = 'commented'; }
    }

    if (text === 'By hot deals') {
        if (activeFilter == 'hot') { activeFilter = null; }
        else { activeFilter = 'hot'; }
    }

    if (text === 'By favorites') {
        if (activeFilter == 'favorites') { activeFilter = null; }
        else { activeFilter = 'favorites'; }
    }

    render(currentDeals, currentPagination);
});


var activeSort = null;

var applySort = function (deals) {

    if (!activeSort) {
        return deals;
    }

    var sorted = deals.slice(); // copy array

    if (activeSort == 'price-asc') {
        sorted.sort(function (a, b) {
            return a.price - b.price;
        });
    }

    if (activeSort == 'price-desc') {
        sorted.sort(function (a, b) {
            return b.price - a.price;
        });
    }

    if (activeSort == 'date-asc') {
        sorted.sort(function (a, b) {
            return a.published - b.published;
        });
    }

    if (activeSort == 'date-desc') {
        sorted.sort(function (a, b) {
            return b.published - a.published;
        });
    }

    return sorted;
};

var selectSort = document.querySelector('#sort-select');

selectSort.addEventListener('change', function (event) {
    activeSort = event.target.value;
    render(currentDeals, currentPagination);
});




document.addEventListener('DOMContentLoaded', async () => {
  const deals = await fetchDeals();

  setCurrentDeals(deals);
  render(currentDeals, currentPagination);
});



const spanNbSales = document.querySelector('#nbSales');
const indicatorsSection = document.querySelector('#indicators');

const fetchSales = async (id) => {
    try {
        const response = await fetch(
            `https://lego-api-blue.vercel.app/sales?id=${id}`
        );
        const body = await response.json();

        if (body.success !== true) {
            return null;
        }
        return body.data.result;
    } catch (error) {
        return null;
    }
};

const renderSales = (sales) => {
    const indicatorDivs = document.querySelectorAll('#indicators > div');

    const nbSalesSpan = indicatorDivs[1].querySelector('span:last-child');
    const avgSpan = indicatorDivs[2].querySelector('span:last-child');
    const p5Span = indicatorDivs[3].querySelector('span:last-child');
    const p25Span = indicatorDivs[4].querySelector('span:last-child');
    const p50Span = indicatorDivs[5].querySelector('span:last-child');
    const lifetimeSpan = indicatorDivs[6].querySelector('span:last-child');

    if (!sales || sales.length === 0) {
        nbSalesSpan.textContent = 0;
        avgSpan.textContent = 0;
        p5Span.textContent = 0;
        p25Span.textContent = 0;
        p50Span.textContent = 0;
        lifetimeSpan.textContent = '0 days';
        return;
    }

    nbSalesSpan.textContent = sales.length;

    const prices = sales
        .map(sale => Number(sale.price.amount))
        .sort((a, b) => a - b);

    const sum = prices.reduce((acc, price) => acc + price, 0);
    const average = sum / prices.length;
    avgSpan.textContent = average.toFixed(2) + ' $';

    const getPercentile = (arr, percentile) => {
        const index = Math.floor(percentile * (arr.length - 1));
        return arr[index];
    };

    p5Span.textContent = getPercentile(prices, 0.05) + ' $';
    p25Span.textContent = getPercentile(prices, 0.25) + ' $';
    p50Span.textContent = getPercentile(prices, 0.5) + ' $';

    const dates = sales.map(sale => sale.published);
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);

    const lifetimeDays = Math.floor((maxDate - minDate) / (60 * 60 * 24));
    const lifetime80Days = Math.floor(lifetimeDays * 0.8);
    lifetimeSpan.textContent = lifetime80Days + ' days';
};




selectLegoSetIds.addEventListener('change', async (event) => {
    const id = event.target.value;

    const salesData = await fetchSales(id);

    renderSales(salesData);      // indicators
    renderSalesList(salesData);  // list of sales
});




const renderSalesList = (sales) => {

    if (!sales || sales.length === 0) {
        sectionSales.innerHTML = `
            <h2>Vinted sales</h2>
            <p>No sales found</p>
        `;
        return;
    }

    const template = sales.map(sale => {
        return `
            <div class="sale">
                <span>${new Date(sale.published * 1000).toLocaleDateString()}</span>
                <a href="${sale.link}" target="_blank">${sale.title}</a>
                <span>${sale.price.amount} $</span>
            </div>
        `;
    }).join('');

    sectionSales.innerHTML = `
        <h2>Vinted sales</h2>
        ${template}
    `;
};








