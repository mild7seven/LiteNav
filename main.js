import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-routing-machine';
import 'leaflet-rotatedmarker';
import './style.css';

// Fix Leaflet Default Icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const map = L.map('map', { zoomControl: false }).setView([-6.2000, 106.8166], 13);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);

let osmb = null, userMarker, routing, startPos, endPos, currentMode = 'car';
let isActive = false, isPaused = false;
let history = JSON.parse(localStorage.getItem('liteNavHistory')) || [];

const carIcon = L.divIcon({
    className: 'v-marker',
    html: `<div style="width: 22px; height: 22px; background: #4285F4; clip-path: polygon(50% 0%, 0% 100%, 50% 82%, 100% 100%); border: 2px solid white; border-radius: 50%;"></div>`,
    iconSize: [22, 22], iconAnchor: [11, 11]
});

// Autocomplete Logic
async function fetchSuggestions(query, listId, isStart) {
    if (query.length < 3) return;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=5`);
    const data = await res.json();
    const list = document.getElementById(listId);
    list.innerHTML = ''; list.style.display = 'block';
    data.forEach(d => {
        const li = document.createElement('li');
        li.innerText = d.display_name.split(',')[0];
        li.onclick = () => {
            const ll = L.latLng(d.lat, d.lon);
            if (isStart) startPos = ll; 
            else { 
                endPos = ll; 
                saveToHistory(d.display_name.split(',')[0], ll);
            }
            document.getElementById(isStart ? 'start-input' : 'end-input').value = d.display_name.split(',')[0];
            list.style.display = 'none';
            if (startPos && endPos) calcRoute();
        };
        list.appendChild(li);
    });
}

function saveToHistory(name, ll) {
    if (history.find(h => h.name === name)) return;
    history.unshift({ name, lat: ll.lat, lng: ll.lng });
    if (history.length > 5) history.pop();
    localStorage.setItem('liteNavHistory', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const list = document.getElementById('recent-list');
    list.innerHTML = '';
    history.forEach(h => {
        const li = document.createElement('li');
        li.innerText = h.name;
        li.onclick = () => { endPos = L.latLng(h.lat, h.lng); document.getElementById('end-input').value = h.name; calcRoute(); };
        list.appendChild(li);
    });
}
renderHistory();

document.getElementById('start-input').oninput = e => fetchSuggestions(e.target.value, 'start-results', true);
document.getElementById('end-input').oninput = e => fetchSuggestions(e.target.value, 'end-results', false);

// Routing
function calcRoute() {
    if (routing) map.removeControl(routing);
    const profiles = { car: 'driving', motorcycle: 'driving', walk: 'walking', exercise: 'walking' };
    routing = L.Routing.control({
        waypoints: [startPos, endPos],
        router: L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1', profile: profiles[currentMode] }),
        lineOptions: { styles: [{ color: '#4285F4', weight: 7, opacity: 0.8 }] },
        createMarker: () => null
    }).on('routesfound', e => {
        const s = e.routes[0].summary;
        document.getElementById('dist-txt').innerText = (s.totalDistance / 1000).toFixed(1) + ' km';
        document.getElementById('eta-txt').innerText = Math.round(s.totalTime / 60) + ' mnt';
    }).addTo(map);
}

// Controls
document.getElementById('start-trip').onclick = () => {
    if (!endPos) return alert("Pilih rute tujuan!");
    isActive = true; 
    document.getElementById('start-trip').style.display = 'none';
    document.getElementById('pause-trip').style.display = 'flex';
    document.getElementById('finish-trip').style.display = 'flex';
    map.locate({ watch: true, enableHighAccuracy: true });
};

document.getElementById('finish-trip').onclick = () => {
    isActive = false; map.stopLocate();
    document.getElementById('start-trip').style.display = 'flex';
    document.getElementById('pause-trip').style.display = 'none';
    document.getElementById('finish-trip').style.display = 'none';
};

map.on('locationfound', e => {
    if (!isActive) return;
    document.getElementById('speed-num').innerText = e.speed ? Math.round(e.speed * 3.6) : 0;
    if (!userMarker) userMarker = L.marker(e.latlng, { icon: carIcon }).addTo(map);
    else userMarker.setLatLng(e.latlng);
    map.setView(e.latlng, 18);
    if (endPos && e.latlng.distanceTo(endPos) < 25) { alert("Tiba!"); isActive = false; }
});

// View Switcher
document.getElementById('v2d').onclick = () => { setActiveV('v2d'); map.getContainer().style.transform = "none"; };
document.getElementById('v25d').onclick = () => { setActiveV('v25d'); map.getContainer().style.transform = "perspective(1000px) rotateX(50deg)"; };
function setActiveV(id) { document.querySelectorAll('.v-btn').forEach(b => b.classList.remove('active')); document.getElementById(id).classList.add('active'); }

document.getElementById('allow-btn').onclick = () => {
    document.getElementById('permission-modal').style.display = 'none';
    map.locate({ setView: true, maxZoom: 15 });
};
