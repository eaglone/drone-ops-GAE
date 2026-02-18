/**
 * MAP.JS — Drone OPS Tactical Map
 * VERSION PRO STABLE — MÉTÉO-FRANCE INTEGRATION
 * * Basé sur les services WMS AROME-PI de Météo-France
 */

let map = null;
let positionMarker = null;
let osmLayer = null;
let oaciLayer = null;
let rainRadarLayer = null;

// =====================================================
// RADAR PLUIE HAUTE RÉSOLUTION (AROME-PI)
// =====================================================

async function initRainRadar() {
    console.log("🛰️ Initialisation Radar AROME-PI (Météo-France)");

    // On récupère le token depuis le localStorage pour éviter de le push sur GitHub
    const mfToken = localStorage.getItem('MF_TOKEN');

    if (mfToken) {
        // Option 1 : Flux WMS dynamique (GetMap) identifié dans tes documents
        const wmsUrl = "https://portail-api.meteofrance.fr/wms/MF-NWP-HIGHRES-AROMEPI-001-FRANCE-WMS/GetMap";
        
        rainRadarLayer = L.tileLayer.wms(wmsUrl, {
            layers: 'PRECIPITATION_TOP_LEVEL', 
            format: 'image/png',
            transparent: true,
            version: '1.3.0',
            opacity: 0.6,
            token: mfToken, // Injection sécurisée du token
            pane: "weatherPane",
            attribution: "© Météo-France AROME-PI"
        });
    } else {
        // Option 2 : Secours via l'URL stable Data.gouv sans token
        console.warn("⚠️ Aucun token trouvé, passage sur l'URL stable Data.gouv");
        const stableUrl = "https://www.data.gouv.fr/api/1/datasets/r/87668014-3d50-4074-9ba3-c4ef92882bd7";
        const bounds = [[51.5, -5.5], [41.0, 10.0]]; // Emprise France
        
        rainRadarLayer = L.imageOverlay(stableUrl, bounds, {
            opacity: 0.6,
            pane: "weatherPane",
            attribution: "© Météo-France via Data.gouv"
        });
    }

    return rainRadarLayer;
}

// Rafraîchissement automatique toutes les 5 minutes (Fréquence AROME-PI)
setInterval(() => {
    if (rainRadarLayer && map.hasLayer(rainRadarLayer)) {
        console.log("🔄 Actualisation des données radar...");
        if (typeof rainRadarLayer.redraw === 'function') {
            rainRadarLayer.redraw();
        } else if (typeof rainRadarLayer.setUrl === 'function') {
            const freshUrl = rainRadarLayer._url.split('?')[0] + "?t=" + Date.now();
            rainRadarLayer.setUrl(freshUrl);
        }
    }
}, 300000); 

// =====================================================
// INITIALISATION DE LA CARTE
// =====================================================

async function initMap() {
    if (!document.getElementById("map") || map) return;

    console.log("🗺️ Initialisation du Dashboard Tactique");

    map = L.map("map", {
        zoomControl: true,
        preferCanvas: true
    }).setView([
        window.latitude || 48.783057,
        window.longitude || 2.213649
    ], 10);

    window.map = map;

    // Création des Panes pour gérer l'ordre d'affichage (Z-Index)
    map.createPane("zonesPane").style.zIndex = 650;
    map.createPane("weatherPane").style.zIndex = 675;
    map.createPane("airspacePane").style.zIndex = 700;

    // Couches de base
    osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap"
    }).addTo(map);

    oaciLayer = L.tileLayer("https://data.geopf.fr/private/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&apikey=8Y5CE2vg2zJMePOhqeHYhXx4fmI3uzpz", {
        opacity: 0.7,
        maxZoom: 18,
        attribution: "© IGN — Carte OACI"
    }).addTo(map);

    // Restrictions DGAC (IGN)
    const dgacIgnLayer = L.tileLayer("https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=TRANSPORTS.DRONES.RESTRICTIONS&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}", {
        opacity: 0.75,
        attribution: "© IGN — Restrictions drones"
    });

    // Initialisation du Radar Météo-France
    const radarLayer = await initRainRadar();

    // Gestion des overlays
    window.openAipLayer = L.layerGroup([], { pane: "airspacePane" }).addTo(map);
    
    let dgacLayer = null;
    if (typeof window.loadDGACZones === "function") {
        try { dgacLayer = await window.loadDGACZones(); } catch(e) { console.warn(e); }
    }

    const baseMaps = { "Fond OSM": osmLayer };
    const overlays = {
        "Carte OACI IGN": oaciLayer,
        "Restrictions drones IGN": dgacIgnLayer,
        "Espaces aériens OpenAIP": window.openAipLayer
    };

    if (radarLayer) overlays["Radar Météo-France"] = radarLayer;
    if (dgacLayer) overlays["Zones DGAC Cliquables"] = dgacLayer;

    L.control.layers(baseMaps, overlays, { collapsed: false }).addTo(map);

    // Initialisation des services tiers
    setTimeout(() => {
        if (typeof initOpenAIPAutoUpdate === "function") initOpenAIPAutoUpdate();
    }, 500);

    console.log("✅ MAP READY");
}

// =====================================================
// FONCTIONS DE MISE À JOUR
// =====================================================

function updateMapPosition(lat, lon) {
    if (!map || !lat || !lon) return;

    map.flyTo([lat, lon], 11, { duration: 0.6 });

    if (positionMarker) map.removeLayer(positionMarker);

    positionMarker = L.circle([lat, lon], {
        radius: 500,
        color: "#38bdf8",
        weight: 2,
        fillOpacity: 0.15
    }).addTo(map);

    if (typeof loadOpenAIPAirspaces === "function") loadOpenAIPAirspaces(lat, lon);
}

function setOpenAIPLayer(layer) {
    if (!window.openAipLayer) return;
    try {
        window.openAipLayer.clearLayers();
        if (layer) window.openAipLayer.addLayer(layer);
    } catch (e) { console.warn(e); }
}

// Exportation globale pour les autres modules (main.js, ui.js)
window.initMap = initMap;
window.updateMapPosition = updateMapPosition;
window.setOpenAIPLayer = setOpenAIPLayer;
