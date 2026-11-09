let map, geojsonData, statsData, markers = [], currentFilter = 'all';

async function loadData() {
    try {
        const [geoResponse, statsResponse] = await Promise.all([
            fetch('data/transport_2025.geojson'),
            fetch('data/stats.json')
        ]);
        geojsonData = await geoResponse.json();
        statsData = await statsResponse.json();
        updateStatsDashboard();
        initMap();
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
    }
}

function updateStatsDashboard() {
    document.getElementById('stat-total').textContent = statsData.total_mapped;
    document.getElementById('stat-simple-avg').textContent = statsData.simple_avg;
    document.getElementById('stat-weighted-avg').textContent = statsData.weighted_avg;
    document.getElementById('stat-max-point').textContent = statsData.max_trips_point;
}

function initMap() {
    map = new maplibregl.Map({
        container: 'map',
        style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
        center: [38.97, 45.03],
        zoom: 7,
        minZoom: 6,
        maxZoom: 14
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');
    map.on('load', () => { renderMarkers(); setupInteractions(); });
}

function calculateMarkerDimensions(trips, population) {
    const minBase = 12, maxBase = 36, maxPop = 918145;
    const sqrtPop = Math.sqrt(population);
    const baseDiameter = minBase + ((sqrtPop / Math.sqrt(maxPop)) * (maxBase - minBase));
    let height = 0, hasData = false;
    if (trips !== null && trips !== undefined) {
        hasData = true;
        height = 8 + ((trips / 773) * (60 - 8));
    }
    return { baseDiameter, height, hasData };
}

function renderMarkers() {
    markers.forEach(m => m.remove());
    markers = [];
    geojsonData.features.forEach(feature => {
        const props = feature.properties;
        if (currentFilter === 'with-data' && !props.has_data) return;
        if (currentFilter === 'no-data' && props.has_data) return;

        const dims = calculateMarkerDimensions(props.trips, props.population);
        const el = document.createElement('div');
        el.className = 'sims-marker';
        
        if (dims.hasData) {
            el.innerHTML = `<div class="marker-pillar" style="width: ${dims.baseDiameter}px; height: ${dims.height}px;"></div><div class="marker-base" style="width: ${dims.baseDiameter}px; height: ${dims.baseDiameter * 0.6}px;"></div><div class="marker-label">${props.name}</div>`;
        } else {
            el.innerHTML = `<div class="marker-base neutral"></div><div class="marker-label">${props.name}</div>`;
        }

        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(feature.geometry.coordinates).addTo(map);
        
        const popupContent = dims.hasData 
            ? `<div class="popup-title">${props.name}</div><div class="popup-stat">🚌 Поездок: <b>${props.trips.toFixed(1)}</b></div><div class="popup-stat">👥 Население: <b>${Math.round(props.population).toLocaleString()}</b></div>`
            : `<div class="popup-title">${props.name}</div><div class="popup-stat" style="color: #778078;">Данные о числе поездок отсутствуют</div>`;
        
        const popup = new maplibregl.Popup({ offset: 15, closeButton: false }).setHTML(popupContent);

        el.addEventListener('mouseenter', () => { marker.setPopup(popup); marker.togglePopup(); el.classList.add('active'); });
        el.addEventListener('mouseleave', () => { marker.togglePopup(); el.classList.remove('active'); });
        el.addEventListener('click', () => {
            showDetails(props, dims);
            document.querySelectorAll('.sims-marker').forEach(m => m.classList.remove('active'));
            el.classList.add('active');
        });
        markers.push(marker);
    });
}

function showDetails(props, dims) {
    document.getElementById('details-panel').classList.add('open');
    document.getElementById('detail-name').textContent = props.name;
    const contentEl = document.getElementById('detail-content');
    
    if (dims.hasData) {
        contentEl.innerHTML = `
            <div class="detail-row"><span class="detail-label">Поездок на человека в год</span><span class="detail-value highlight">${props.trips.toFixed(2)}</span></div>
            <div class="detail-row"><span class="detail-label">Численность населения</span><span class="detail-value">${Math.round(props.population).toLocaleString()} чел.</span></div>
            <div class="detail-row"><span class="detail-label">ОКТМО</span><span class="detail-value">${props.oktmo}</span></div>
            <div class="detail-row"><span class="detail-label">Координаты</span><span class="detail-value" style="font-size: 0.8rem;">${props.geometry.coordinates[1].toFixed(4)}, ${props.geometry.coordinates[0].toFixed(4)}</span></div>`;
    } else {
        contentEl.innerHTML = `
            <div class="detail-row"><span class="detail-label">Численность населения</span><span class="detail-value">${Math.round(props.population).toLocaleString()} чел.</span></div>
            <div class="detail-row"><span class="detail-label">ОКТМО</span><span class="detail-value">${props.oktmo}</span></div>
            <div class="no-data-state">⚠️ Статистические данные о транспортной мобильности отсутствуют</div>`;
    }
}

function setupInteractions() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentFilter = e.target.dataset.filter;
            renderMarkers();
        });
    });

    document.getElementById('search-input').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        if (query.length < 2) return;
        const found = geojsonData.features.find(f => f.properties.name.toLowerCase().includes(query));
        if (found) {
            map.flyTo({ center: found.geometry.coordinates, zoom: 10, duration: 1500 });
            setTimeout(() => {
                showDetails(found.properties, calculateMarkerDimensions(found.properties.trips, found.properties.population));
            }, 1600);
        }
    });
}

document.addEventListener('DOMContentLoaded', loadData);