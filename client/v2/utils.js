// Invoking strict mode https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Strict_mode#invoking_strict_mode
'use strict';

const API_BASE_URL = (() => {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('api');

    if (fromQuery) {
        return fromQuery.replace(/\/$/, '');
    }

    if (!window.location.hostname) {
        return 'http://localhost:8092';
    }

    return `http://${window.location.hostname}:8092`;
})();

let currentShowSize = 6;
let activeSort = null;
let activeFilter = null;
let activeThresholdFilter = null;

const filterThresholdConfig = {
    discount: { label: 'Minimum discount', unit: '%', min: 0, max: 100, step: 1 },
    commented: { label: 'Minimum comments', unit: '', min: 0, max: 200, step: 1 },
    hot: { label: 'Minimum hotness', unit: '', min: -50, max: 1000, step: 5 }
};

const filterThresholds = {
    discount: 30,
    commented: 5,
    hot: 100
};

const toNumber = value => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
};

const getIdsFromDeals = deals => deals.map(deal => deal.id);

const getFavorites = () => {
    try {
        const raw = localStorage.getItem('favorites');
        const favorites = raw ? JSON.parse(raw) : [];
        return Array.isArray(favorites) ? favorites : [];
    } catch (error) {
        console.error(error);
        return [];
    }
};

const saveFavorites = favorites => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
};

const getDealById = (deals, id) => {
    if (!id) return null;
    return deals.find(deal => String(deal.id) === String(id)) || null;
};

const toTimestampMs = value => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value > 1e12 ? value : value * 1000;
    }

    if (typeof value === 'string') {
        const asNumber = Number(value);
        if (Number.isFinite(asNumber) && value.trim() !== '') {
            return asNumber > 1e12 ? asNumber : asNumber * 1000;
        }

        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    return 0;
};

const formatPrice = amount => {
    const value = toNumber(amount);
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
};

const percentile = (numbers, p) => {
    if (!numbers || numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const index = (p / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) return sorted[lower];

    return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
};

const applyFilter = deals => {
    if (!activeFilter) return deals;

    if (activeFilter === 'favorites') {
        const favorites = getFavorites();
        return deals.filter(deal => favorites.includes(String(deal.uuid)));
    }

    if (activeFilter === 'discount') {
        const minDiscount = filterThresholds.discount;
        return deals.filter(deal => toNumber(deal.discount) >= minDiscount);
    }

    if (activeFilter === 'commented') {
        const minComments = filterThresholds.commented;
        return deals.filter(deal => toNumber(deal.comments) >= minComments);
    }

    if (activeFilter === 'hot') {
        const minHotness = filterThresholds.hot;
        return deals.filter(deal => toNumber(deal.temperature) >= minHotness);
    }

    return deals;
};

const applySort = deals => {
    const sortedDeals = [...deals];

    if (!activeSort) {
        return sortedDeals;
    }

    if (activeSort === 'price-asc') {
        return sortedDeals.sort((a, b) => toNumber(a.price) - toNumber(b.price));
    }

    if (activeSort === 'price-desc') {
        return sortedDeals.sort((a, b) => toNumber(b.price) - toNumber(a.price));
    }

    if (activeSort === 'date-asc') {
        return sortedDeals.sort((a, b) => toTimestampMs(b.published) - toTimestampMs(a.published));
    }

    if (activeSort === 'date-desc') {
        return sortedDeals.sort((a, b) => toTimestampMs(a.published) - toTimestampMs(b.published));
    }

    return sortedDeals;
};

const getTemperatureColor = value => {
    if (value >= 500) return '#dc2626';
    if (value >= 200) return '#ea580c';
    if (value >= 50) return '#f59e0b';
    return '#6b7280';
};

const updateDealIndicators = deals => {
    const avgDiscountValue = document.querySelector('#avgDiscountValue');
    const maxDiscountValue = document.querySelector('#maxDiscountValue');
    const avgTempValue = document.querySelector('#avgTempValue');
    const maxTempValue = document.querySelector('#maxTempValue');

    if (!avgDiscountValue || !maxDiscountValue || !avgTempValue || !maxTempValue) return;

    if (!deals || deals.length === 0) {
        avgDiscountValue.textContent = '0%';
        maxDiscountValue.textContent = '0%';
        avgTempValue.textContent = '0';
        maxTempValue.textContent = '0';
        return;
    }

    const discounts = deals.map(deal => toNumber(deal.discount)).filter(value => value > 0);
    const temperatures = deals.map(deal => toNumber(deal.temperature));

    const avgDiscount = discounts.length ? discounts.reduce((sum, value) => sum + value, 0) / discounts.length : 0;
    const maxDiscount = discounts.length ? Math.max(...discounts) : 0;
    const avgTemp = temperatures.length ? temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length : 0;
    const maxTemp = temperatures.length ? Math.max(...temperatures) : 0;

    avgDiscountValue.textContent = `${Math.round(avgDiscount)}%`;
    maxDiscountValue.textContent = `${Math.round(maxDiscount)}%`;
    avgTempValue.textContent = Math.round(avgTemp).toString();
    maxTempValue.textContent = Math.round(maxTemp).toString();
};

const resetSalesIndicators = () => {
    const ids = [
        ['#nbSales', '0'],
        ['#avgSalesValue', '0'],
        ['#p5SalesValue', '0'],
        ['#p25SalesValue', '0'],
        ['#p50SalesValue', '0'],
        ['#lifetimeSalesValue', '0 days']
    ];

    ids.forEach(([selector, value]) => {
        const node = document.querySelector(selector);
        if (node) node.textContent = value;
    });
};

const renderSalesIndicators = sales => {
    if (!sales || sales.length === 0) {
        resetSalesIndicators();
        return;
    }

    const prices = sales.map(sale => toNumber(sale.price && sale.price.amount));
    const publishedValues = sales
        .map(sale => toTimestampMs(sale.published))
        .filter(timestamp => timestamp > 0);

    const avg = prices.reduce((sum, value) => sum + value, 0) / prices.length;
    const p5 = percentile(prices, 5);
    const p25 = percentile(prices, 25);
    const p50 = percentile(prices, 50);

    const minPublished = publishedValues.length ? Math.min(...publishedValues) : 0;
    const maxPublished = publishedValues.length ? Math.max(...publishedValues) : 0;
    const lifetimeDays = minPublished && maxPublished ? Math.round((maxPublished - minPublished) / 86400000) : 0;

    const nbSales = document.querySelector('#nbSales');
    const avgSalesValue = document.querySelector('#avgSalesValue');
    const p5SalesValue = document.querySelector('#p5SalesValue');
    const p25SalesValue = document.querySelector('#p25SalesValue');
    const p50SalesValue = document.querySelector('#p50SalesValue');
    const lifetimeSalesValue = document.querySelector('#lifetimeSalesValue');

    if (nbSales) nbSales.textContent = String(sales.length);
    if (avgSalesValue) avgSalesValue.textContent = formatPrice(avg);
    if (p5SalesValue) p5SalesValue.textContent = formatPrice(p5);
    if (p25SalesValue) p25SalesValue.textContent = formatPrice(p25);
    if (p50SalesValue) p50SalesValue.textContent = formatPrice(p50);
    if (lifetimeSalesValue) lifetimeSalesValue.textContent = `${lifetimeDays} days`;
};

const renderSales = sales => {
    const sectionSales = document.querySelector('#sales');
    if (!sectionSales) return;

    if (!sales || sales.length === 0) {
        sectionSales.innerHTML = `
            <h2>Vinted sales</h2>
            <p class="muted-state">No Vinted sales available for this set.</p>
        `;
        resetSalesIndicators();
        return;
    }

    const rows = sales
        .slice(0, 50)
        .map(sale => {
            const published = toTimestampMs(sale.published);
            const dateText = published
                ? new Date(published).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: '2-digit' })
                : '-';

            return `
                <article class="sale">
                    <img class="sale-logo" src="${sale.photo || 'https://via.placeholder.com/64x64?text=Lego'}" alt="Vinted item" />
                    <div class="sale-main">
                        <a href="${sale.link}" target="_blank" rel="noreferrer">${sale.title || 'Untitled'}</a>
                        <span class="sale-date">${dateText}</span>
                    </div>
                    <div class="sale-pricing">
                        <span class="sale-price">${formatPrice(sale.price && sale.price.amount)}</span>
                    </div>
                </article>
            `;
        })
        .join('');

    sectionSales.innerHTML = `
        <h2>Vinted sales</h2>
        <div class="sales-list">${rows}</div>
    `;

    renderSalesIndicators(sales);
};

const renderSelectedSet = deal => {
    const selectedSetContainer = document.querySelector('#selected-set');
    const selectedSetPreview = document.querySelector('#selected-set-preview');
    if (!selectedSetContainer || !selectedSetPreview) return;

    if (!deal) {
        selectedSetContainer.classList.remove('visible');
        selectedSetPreview.innerHTML = '';
        return;
    }

    const temp = toNumber(deal.temperature);
    selectedSetPreview.innerHTML = `
        <article class="selected-card">
            <img class="selected-image" src="${deal.photo || 'https://via.placeholder.com/400x300?text=Lego'}" alt="${deal.title || 'Lego set'}" />
            <div class="selected-content">
                <p class="selected-id">Set ${deal.id || '-'}</p>
                <p class="selected-title">${deal.title || 'Untitled deal'}</p>
                <div class="selected-prices">
                    <span class="selected-price">${formatPrice(deal.price)}</span>
                    <span class="selected-original-price">${formatPrice(deal.retail)}</span>
                </div>
                <div class="selected-meta">
                    <span class="selected-hotness" style="color:${getTemperatureColor(temp)};">🔥 ${Math.round(temp)}</span>
                    <a class="selected-link" href="${deal.link}" target="_blank" rel="noreferrer">Open deal</a>
                </div>
            </div>
        </article>
    `;

    selectedSetContainer.classList.add('visible');
};

const setLegoDropdownSelection = selectedDeal => {
    const legoSetDropdown = document.querySelector('#lego-set-dropdown');
    const legoSetDropdownBtn = document.querySelector('#lego-set-dropdown-btn');
    const legoSetDropdownImage = document.querySelector('#lego-set-dropdown-image');
    const legoSetDropdownText = document.querySelector('#lego-set-dropdown-text');
    const legoSetDropdownMenu = document.querySelector('#lego-set-dropdown-menu');
    const selectLegoSetIds = document.querySelector('#lego-set-id-select');
    if (!legoSetDropdown || !legoSetDropdownBtn || !legoSetDropdownImage || !legoSetDropdownText || !legoSetDropdownMenu || !selectLegoSetIds) {
        return;
    }

    const dealsById = (typeof currentDeals !== 'undefined' ? currentDeals : []).reduce((acc, deal) => {
        acc[String(deal.id)] = deal;
        return acc;
    }, {});

    if (selectedDeal) {
        legoSetDropdownText.textContent = `${selectedDeal.id || '-'} - ${selectedDeal.title || 'Lego set'}`;
        legoSetDropdownImage.src = selectedDeal.photo || 'https://via.placeholder.com/64x64?text=Lego';
    } else {
        legoSetDropdownText.textContent = 'Select a lego set';
        legoSetDropdownImage.src = 'https://via.placeholder.com/64x64?text=Lego';
    }

    const currentId = selectedDeal ? String(selectedDeal.id) : String(selectLegoSetIds.value || '');

    const options = Array.from(selectLegoSetIds.options)
        .map(option => {
            const id = String(option.value);
            const deal = dealsById[id];
            if (!deal) return '';

            const activeClass = id === currentId ? 'active' : '';
            return `
                <button type="button" class="lego-dropdown-item ${activeClass}" data-id="${id}" role="option" aria-selected="${id === currentId}">
                    <img src="${deal.photo || 'https://via.placeholder.com/64x64?text=Lego'}" alt="${deal.title || id}" />
                    <span>${deal.id || '-'} - ${deal.title || 'Untitled'}</span>
                </button>
            `;
        })
        .join('');

    legoSetDropdownMenu.innerHTML = options || '<p class="muted-state">No lego set id available.</p>';
    legoSetDropdownBtn.setAttribute('aria-expanded', legoSetDropdown.classList.contains('open') ? 'true' : 'false');
};

const toggleLegoDropdown = () => {
    const legoSetDropdown = document.querySelector('#lego-set-dropdown');
    const legoSetDropdownBtn = document.querySelector('#lego-set-dropdown-btn');
    if (!legoSetDropdown || !legoSetDropdownBtn) return;

    const willOpen = !legoSetDropdown.classList.contains('open');
    legoSetDropdown.classList.toggle('open', willOpen);
    legoSetDropdownBtn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
};

const closeLegoDropdown = () => {
    const legoSetDropdown = document.querySelector('#lego-set-dropdown');
    const legoSetDropdownBtn = document.querySelector('#lego-set-dropdown-btn');
    if (!legoSetDropdown || !legoSetDropdownBtn) return;

    legoSetDropdown.classList.remove('open');
    legoSetDropdownBtn.setAttribute('aria-expanded', 'false');
};

const updateFilterButtonsState = () => {
    const controls = document.querySelectorAll('[data-filter][data-role]');
    controls.forEach(control => {
        const filterName = control.dataset.filter;
        const role = control.dataset.role;
        const group = control.closest('.filter-group');

        if (group) {
            group.classList.toggle('active', activeFilter === filterName);
        }

        if (!group && role === 'toggle') {
            control.classList.toggle('active', activeFilter === filterName);
        }
    });
};

const closeThresholdPopover = () => {
    const filterThresholdPopover = document.querySelector('#filter-threshold-popover');
    if (!filterThresholdPopover) return;

    filterThresholdPopover.classList.remove('visible');
    activeThresholdFilter = null;
};

const openThresholdPopover = (filterName, control) => {
    const filterThresholdPopover = document.querySelector('#filter-threshold-popover');
    const filterThresholdTitle = document.querySelector('#filter-threshold-title');
    const filterThresholdValue = document.querySelector('#filter-threshold-value');
    const filterThresholdRange = document.querySelector('#filter-threshold-range');
    if (!filterThresholdPopover || !filterThresholdTitle || !filterThresholdValue || !filterThresholdRange || !control) {
        return;
    }

    const config = filterThresholdConfig[filterName];
    if (!config) return;

    activeThresholdFilter = filterName;

    filterThresholdTitle.textContent = config.label;
    filterThresholdRange.min = String(config.min);
    filterThresholdRange.max = String(config.max);
    filterThresholdRange.step = String(config.step);
    filterThresholdRange.value = String(filterThresholds[filterName]);
    filterThresholdValue.textContent = `${filterThresholds[filterName]}${config.unit}`;

    const filterContainer = document.querySelector('#filters');
    if (filterContainer) {
        const containerRect = filterContainer.getBoundingClientRect();
        const controlRect = control.getBoundingClientRect();
        filterThresholdPopover.style.left = `${Math.max(0, controlRect.left - containerRect.left)}px`;
    }

    filterThresholdPopover.classList.add('visible');
};

const fetchSales = async id => {
    if (!id) return [];

    try {
        const response = await fetch(`${API_BASE_URL}/sales?id=${encodeURIComponent(id)}`);
        const body = await response.json();
        if (!body.success) return [];
        return body.data && Array.isArray(body.data.result) ? body.data.result : [];
    } catch (error) {
        console.error(error);
        return [];
    }
};

const handleLegoSetSelection = async (id, fetchSalesData = true) => {
    const selectedDeal = getDealById(typeof currentDeals !== 'undefined' ? currentDeals : [], id);

    renderSelectedSet(selectedDeal);
    setLegoDropdownSelection(selectedDeal);

    if (!id) {
        renderSales([]);
        return;
    }

    if (fetchSalesData) {
        const sales = await fetchSales(id);
        renderSales(sales);
    }
};
