/* THE LONDON TABLE — interactive restaurant map. */
(() => {
  'use strict';

  // Paste your CARTO Basemaps key between the quotes below.
  // This browser-side key is visible in the deployed site; restrict it to your website in CARTO.
  const CARTO_API_KEY = 'cb1_50f8_1_3c265ef12f5dafaee297c329';

  const content = window.LONDON_TABLE_CONTENT || { posts: [], highlights: [] };
  const posts = Array.isArray(content.posts) ? content.posts : [];
  const $ = (id) => document.getElementById(id);
  const mapSection = $('map-section');
  const page = document.querySelector('.page');
  const londonCenter = [51.5074, -0.1278];

  if (!mapSection || !page) return;

  let map = null;
  let markerLayer = null;
  let selectedMarker = null;
  let selectedPostId = null;
  let initialViewSet = false;
  let activeFilter = 'all';
  let searchTerm = '';

  function normaliseCoordinates(value) {
    if (!value) return null;
    let lat;
    let lng;
    if (Array.isArray(value)) {
      lat = value[0];
      lng = value[1];
    } else if (typeof value === 'object') {
      lat = value.lat !== undefined ? value.lat : value.latitude;
      lng = value.lng !== undefined ? value.lng : (value.lon !== undefined ? value.lon : value.longitude);
    }
    if (lat === undefined || lat === null || lat === '' || lng === undefined || lng === null || lng === '') return null;
    lat = Number(lat);
    lng = Number(lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat: lat, lng: lng };
  }

  function getCoordinates(post) {
    const direct = normaliseCoordinates(post.coordinates || post.mapCoordinates || {
      lat: post.latitude !== undefined ? post.latitude : post.mapLatitude,
      lng: post.longitude !== undefined ? post.longitude : post.mapLongitude
    });
    if (direct) return direct;

    const mapUrl = String(post.mapEmbedUrl || post.googleMapsUrl || post.mapsUrl || '');
    let match = mapUrl.match(/!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/);
    if (match) return normaliseCoordinates({ lat: match[2], lng: match[1] });

    match = mapUrl.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
    if (match) return normaliseCoordinates({ lat: match[1], lng: match[2] });

    match = mapUrl.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (match) return normaliseCoordinates({ lat: match[1], lng: match[2] });

    match = mapUrl.match(/[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?)(?:,|%2C)(-?\d+(?:\.\d+)?)/i);
    if (match) return normaliseCoordinates({ lat: match[1], lng: match[2] });

    return null;
  }

  function getEntries() {
    return posts.map((post, index) => ({ post: post, index: index, coordinates: getCoordinates(post) }));
  }

  function getMappedEntries() {
    return getEntries().filter((entry) => !!entry.coordinates);
  }

  function matchesFilter(post) {
    if (activeFilter === 'all') return true;
    return post.category === activeFilter || (Array.isArray(post.tags) && post.tags.includes(activeFilter));
  }

  function matchesSearch(post) {
    if (!searchTerm) return true;
    const haystack = [
      post.name,
      post.location,
      post.foodType,
      post.nearestTube,
      post.priceRange,
      post.category,
      ...(Array.isArray(post.tags) ? post.tags : [])
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(searchTerm);
  }

  function getVisibleEntries() {
    return getMappedEntries().filter((entry) => matchesFilter(entry.post) && matchesSearch(entry.post));
  }

  function renderFilters() {
    const container = $('map-filters');
    if (!container) return;
    container.replaceChildren();

    const usedCategories = new Set(posts.flatMap((post) => [
      post.category,
      ...(Array.isArray(post.tags) ? post.tags : [])
    ]).filter(Boolean));

    const filters = [{ id: 'all', name: 'All places' }];
    (content.highlights || []).forEach((item) => {
      if (item.id !== 'all' && usedCategories.has(item.id)) filters.push(item);
    });

    filters.forEach((filter) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'map-filter' + (activeFilter === filter.id ? ' is-active' : '');
      button.textContent = filter.name;
      button.setAttribute('aria-pressed', String(activeFilter === filter.id));
      button.addEventListener('click', () => {
        activeFilter = filter.id;
        renderMap();
      });
      container.append(button);
    });
  }

  function makePinIcon(selected) {
    return L.divIcon({
      className: 'restaurant-map-marker',
      html: '<span class="restaurant-map-pin' + (selected ? ' is-selected' : '') + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"></path><circle cx="12" cy="10" r="2.5"></circle></svg></span>',
      iconSize: [40, 46],
      iconAnchor: [20, 44],
      tooltipAnchor: [0, -39]
    });
  }

  function ensureMap() {
    if (map) return true;
    if (!window.L) {
      $('map-unavailable').hidden = false;
      return false;
    }

    map = L.map('restaurant-map', {
      center: londonCenter,
      zoom: 11,
      minZoom: 9,
      maxZoom: 19,
      zoomControl: true,
      scrollWheelZoom: false,
      preferCanvas: true
    });

    const cartoTileUrl = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key='
      + encodeURIComponent(CARTO_API_KEY.trim());

    L.tileLayer(cartoTileUrl, {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    markerLayer = typeof L.markerClusterGroup === 'function'
      ? L.markerClusterGroup({
          showCoverageOnHover: false,
          spiderfyOnMaxZoom: true,
          maxClusterRadius: 48,
          iconCreateFunction: function (cluster) {
            return L.divIcon({
              className: 'map-cluster-shell',
              html: '<span class="map-cluster-count">' + cluster.getChildCount() + '</span>',
              iconSize: [42, 42]
            });
          }
        })
      : L.featureGroup();

    markerLayer.addTo(map);
    return true;
  }

  function fitEntries(entries) {
    if (!map || !entries.length) {
      if (map) map.setView(londonCenter, 11);
      return;
    }
    const points = entries.map((entry) => [entry.coordinates.lat, entry.coordinates.lng]);
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [64, 64], maxZoom: 13 });
  }

  function updateEmptyState(visibleEntries, mappedEntries) {
    const empty = $('map-empty');
    const clearButton = $('map-clear-search');
    const title = $('map-empty-title');
    const copy = $('map-empty-copy');
    const hasFilters = !!searchTerm || activeFilter !== 'all';

    if (visibleEntries.length) {
      empty.hidden = true;
      return;
    }

    empty.hidden = false;
    clearButton.hidden = !hasFilters;
    if (!posts.length) {
      title.textContent = 'Your London map starts here';
      copy.textContent = 'Publish a restaurant review and its pin will appear here automatically.';
    } else if (!mappedEntries.length) {
      title.textContent = 'No locations pinned yet';
      copy.textContent = 'Add coordinates to a restaurant post, or include a Google Maps embed URL with a pin location.';
    } else if (hasFilters) {
      title.textContent = 'No restaurants found';
      copy.textContent = 'Try another search or clear your filters to see every place.';
    } else {
      title.textContent = 'No restaurants to show';
      copy.textContent = 'Add a restaurant review to see its location here.';
    }
  }

  function renderMap() {
    renderFilters();

    const mappedEntries = getMappedEntries();
    const visibleEntries = mappedEntries.filter((entry) => matchesFilter(entry.post) && matchesSearch(entry.post));
    $('map-results').textContent = visibleEntries.length + (visibleEntries.length === 1 ? ' restaurant' : ' restaurants');
    $('map-total').textContent = mappedEntries.length + ' of ' + posts.length + ' with map pins';

    const missing = posts.length - mappedEntries.length;
    const note = $('map-note');
    note.hidden = missing === 0;
    if (missing > 0) {
      note.textContent = missing + (missing === 1 ? ' restaurant has' : ' restaurants have') + ' no map pin yet. Add coordinates or a Google Maps embed URL to its post data.';
    }

    updateEmptyState(visibleEntries, mappedEntries);
    if (!ensureMap()) return;

    markerLayer.clearLayers();
    selectedMarker = null;

    visibleEntries.forEach((entry) => {
      const post = entry.post;
      const marker = L.marker([entry.coordinates.lat, entry.coordinates.lng], {
        icon: makePinIcon(post.id === selectedPostId),
        title: post.name,
        alt: 'Map pin for ' + post.name,
        riseOnHover: true,
        keyboard: true
      });

      const tooltip = document.createElement('span');
      tooltip.textContent = post.name;
      marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -34], opacity: 1 });

      marker.on('click', () => {
        if (selectedMarker && selectedMarker !== marker) selectedMarker.setIcon(makePinIcon(false));
        selectedMarker = marker;
        selectedPostId = post.id;
        marker.setIcon(makePinIcon(true));
        map.setView([entry.coordinates.lat, entry.coordinates.lng], Math.max(map.getZoom(), 14), {
          animate: true,
          duration: 0.4
        });
        document.dispatchEvent(new CustomEvent('london-table:open-post', {
          detail: { postId: post.id }
        }));
      });

      markerLayer.addLayer(marker);
      if (post.id === selectedPostId) selectedMarker = marker;
    });

    if (!initialViewSet) {
      fitEntries(visibleEntries.length ? visibleEntries : mappedEntries);
      initialViewSet = true;
    }

    window.requestAnimationFrame(() => {
      if (map) map.invalidateSize({ pan: false });
    });
  }

  function showMap() {
    document.body.classList.add('is-map-view');
    page.classList.add('is-map-view');
    mapSection.hidden = false;

    document.querySelectorAll('[data-nav]').forEach((button) => button.classList.remove('is-active'));
    document.querySelectorAll('[data-map-nav]').forEach((button) => {
      button.classList.add('is-active');
      button.setAttribute('aria-pressed', 'true');
    });

    renderMap();
    window.requestAnimationFrame(() => {
      if (map) map.invalidateSize({ pan: false });
    });
  }

  function hideMap() {
    if (!document.body.classList.contains('is-map-view')) return;
    document.body.classList.remove('is-map-view');
    page.classList.remove('is-map-view');
    mapSection.hidden = true;
    document.querySelectorAll('[data-map-nav]').forEach((button) => {
      button.classList.remove('is-active');
      button.setAttribute('aria-pressed', 'false');
    });
  }

  $('map-search').addEventListener('input', (event) => {
    searchTerm = event.target.value.trim().toLowerCase();
    renderMap();
  });

  $('map-fit').addEventListener('click', () => {
    if (!map) return;
    const visible = getVisibleEntries();
    fitEntries(visible.length ? visible : getMappedEntries());
  });

  $('map-clear-search').addEventListener('click', () => {
    searchTerm = '';
    activeFilter = 'all';
    $('map-search').value = '';
    renderMap();
  });

  document.querySelectorAll('[data-map-nav]').forEach((button) => {
    button.addEventListener('click', showMap);
  });

  document.querySelectorAll('[data-nav]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!document.body.classList.contains('is-map-view')) return;
      hideMap();
      window.requestAnimationFrame(() => {
        if (button.dataset.nav === 'saved') {
          $('feed').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    });
  });

  window.addEventListener('resize', () => {
    if (map && document.body.classList.contains('is-map-view')) map.invalidateSize({ pan: false });
  });

  renderFilters();
})();
