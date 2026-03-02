document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  const resultsEl = document.getElementById('results');
  const searchBtn = document.getElementById('searchBtn');
  const resetBtn = document.getElementById('resetBtn');

  let dataCache = null;

  async function loadData() {
    if (dataCache) return dataCache;
    try {
      const res = await fetch('travel_recommendation_api.json');
      const data = await res.json();
      console.log('Loaded travel_recommendation_api.json:', data);
      dataCache = data;
      return data;
    } catch (err) {
      console.error('Failed to load JSON', err);
      resultsEl.textContent = 'Failed to load recommendations.';
      return null;
    }
  }

  // Map placeholder filenames from the JSON to real image URLs (Unsplash queries).
  // Map JSON placeholder filenames to local images in the img/ folder
  const imageMap = {
    'enter_your_image_for_sydney.jpg': 'img/country.png',
    'enter_your_image_for_melbourne.jpg': 'img/country1.png',
    'enter_your_image_for_tokyo.jpg': 'img/country.png',
    'enter_your_image_for_kyoto.jpg': 'img/country1.png',
    'enter_your_image_for_rio.jpg': 'img/beach.png',
    'enter_your_image_for_sao-paulo.jpg': 'img/country.png',
    'enter_your_image_for_angkor-wat.jpg': 'img/tempel.png',
    'enter_your_image_for_taj-mahal.jpg': 'img/tempel1.png',
    'enter_your_image_for_bora-bora.jpg': 'img/beach.png',
    'enter_your_image_for_copacabana.jpg': 'img/beach1.png'
  };

  function getImageUrl(original) {
    if (!original) return 'https://via.placeholder.com/400x250?text=No+Image';
    return imageMap[original] || original;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"']/g, function (s) {
      return ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[s];
    });
  }

  function renderResults(items) {
    if (!items || items.length === 0) {
      resultsEl.innerHTML = '<p>No results found.</p>';
      return;
    }
    const html = items.map(item => {
      const tz = detectTimeZone(item);
      const timeHtml = tz ? `<div class="local-time" data-tz="${tz}">Local time: ${getCurrentTimeForTZ(tz)}</div>` : '';
      return `
      <div class="result-card">
        <img src="${getImageUrl(item.imageUrl)}" alt="${escapeHtml(item.name)}" />
        <div class="card-body">
          <h3>${escapeHtml(item.name)}</h3>
          <p>${escapeHtml(item.description || '')}</p>
          ${timeHtml}
        </div>
      </div>
    `}).join('');
    resultsEl.innerHTML = `<div class="result-grid">${html}</div>`;
    // start live updates for displayed times
    updateTimes();
  }

  // Detect a best-guess IANA time zone based on item name/content
  function detectTimeZone(item) {
    if (!item || !item.name) return null;
    const n = item.name.toLowerCase();
    if (n.includes('sydney')) return 'Australia/Sydney';
    if (n.includes('melbourne')) return 'Australia/Melbourne';
    if (n.includes('australia')) return 'Australia/Sydney';
    if (n.includes('tokyo') || n.includes('kyoto') || n.includes('japan')) return 'Asia/Tokyo';
    if (n.includes('rio') || n.includes('rio de janeiro') || n.includes('copacabana') || n.includes('brazil') || n.includes('sao paulo') || n.includes('são paulo')) return 'America/Sao_Paulo';
    if (n.includes('angkor') || n.includes('cambodia')) return 'Asia/Phnom_Penh';
    if (n.includes('taj mahal') || n.includes('india')) return 'Asia/Kolkata';
    if (n.includes('bora bora') || n.includes('french polynesia')) return 'Pacific/Tahiti';
    // fallback: try to detect country names in the description
    if (item.description) {
      const d = item.description.toLowerCase();
      if (d.includes('australia')) return 'Australia/Sydney';
      if (d.includes('japan')) return 'Asia/Tokyo';
      if (d.includes('brazil')) return 'America/Sao_Paulo';
      if (d.includes('india')) return 'Asia/Kolkata';
      if (d.includes('cambodia')) return 'Asia/Phnom_Penh';
    }
    return null;
  }

  function getCurrentTimeForTZ(tz) {
    try {
      const options = { timeZone: tz, hour12: true, hour: 'numeric', minute: 'numeric', second: 'numeric' };
      return new Date().toLocaleTimeString('en-US', options);
    } catch (e) {
      return '';
    }
  }

  let _timeUpdater = null;
  function updateTimes() {
    // clear any existing interval
    if (_timeUpdater) clearInterval(_timeUpdater);
    // update immediately
    const els = resultsEl.querySelectorAll('.local-time');
    els.forEach(el => {
      const tz = el.getAttribute('data-tz');
      el.textContent = tz ? `Local time: ${getCurrentTimeForTZ(tz)}` : '';
    });
    // set interval only if there are timezone elements
    if (els.length > 0) {
      _timeUpdater = setInterval(() => {
        const els2 = resultsEl.querySelectorAll('.local-time');
        els2.forEach(el => {
          const tz = el.getAttribute('data-tz');
          el.textContent = tz ? `Local time: ${getCurrentTimeForTZ(tz)}` : '';
        });
      }, 1000);
    }
  }

  searchBtn.addEventListener('click', async () => {
    const raw = (searchInput.value || '').trim();
    const q = raw.toLowerCase();
    if (!q) { resultsEl.textContent = 'Please enter search keywords.'; return; }
    resultsEl.textContent = 'Searching...';
    const data = await loadData();
    if (!data) return;

    // Accept plural/singular variations (e.g., beach/beaches, temple/temples)
    const singular = q.endsWith('s') ? q.slice(0, -1) : q;

    const results = [];
    const seen = new Set();
    const add = (item) => {
      if (!item || !item.name) return;
      if (!seen.has(item.name)) { seen.add(item.name); results.push(item); }
    };

    // If user entered a beach/temple keyword, include those category items
    if (singular === 'beach') {
      if (Array.isArray(data.beaches)) data.beaches.forEach(add);
    }
    if (singular === 'temple') {
      if (Array.isArray(data.temples)) data.temples.forEach(add);
    }

    // Match country names (e.g., "japan") and include that country's cities
    if (Array.isArray(data.countries)) {
      data.countries.forEach(country => {
        const countryName = (country.name || '').toLowerCase();
        if (countryName.includes(q) || countryName.includes(singular)) {
          if (Array.isArray(country.cities)) country.cities.forEach(add);
        }

        // Also search within city names/descriptions
        if (Array.isArray(country.cities)) {
          country.cities.forEach(city => {
            const hay = (city.name + ' ' + (city.description || '')).toLowerCase();
            if (hay.includes(q) || hay.includes(singular)) add(city);
          });
        }
      });
    }

    // If the user searched for "country" show country-level recommendations
    if (singular === 'country' || q.includes('country')) {
      if (Array.isArray(data.countries)) {
        // build a country-level item using first city's image and a short description
        data.countries.forEach(country => {
          const firstCity = Array.isArray(country.cities) && country.cities.length ? country.cities[0] : null;
          const item = {
            name: country.name,
            imageUrl: firstCity ? firstCity.imageUrl : '',
            description: firstCity ? `${firstCity.name} — ${firstCity.description}` : `Explore ${country.name}`
          };
          add(item);
        });
        // ensure at least two country results; if less, duplicate fallback from cities
        if (results.length < 2 && Array.isArray(data.countries)) {
          data.countries.slice(0, 2).forEach(country => {
            const firstCity = Array.isArray(country.cities) && country.cities.length ? country.cities[0] : null;
            const item = {
              name: country.name,
              imageUrl: firstCity ? firstCity.imageUrl : '',
              description: firstCity ? `${firstCity.name} — ${firstCity.description}` : `Explore ${country.name}`
            };
            add(item);
          });
        }
      }
    }

    // Also search temples and beaches by name/description
    ['temples', 'beaches'].forEach(key => {
      if (Array.isArray(data[key])) {
        data[key].forEach(item => {
          const hay = (item.name + ' ' + (item.description || '')).toLowerCase();
          if (hay.includes(q) || hay.includes(singular)) add(item);
        });
      }
    });

    console.log('Search results for', raw, results);
    renderResults(results);
  });

  resetBtn.addEventListener('click', () => {
    searchInput.value = '';
    resultsEl.innerHTML = '';
    searchInput.focus();
  });

  // Clear results function — removes displayed recommendation results
  function clearResults() {
    resultsEl.innerHTML = '';
  }

  const clearBtn = document.getElementById('clearBtn');
  if (clearBtn) clearBtn.addEventListener('click', clearResults);

  // optional: pre-load data so console.log shows it early
  loadData();
});
