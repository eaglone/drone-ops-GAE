/**
 * MAP.JS — Drone OPS Tactical Map
 * VERSION PRO STABLE — MÉTÉO-FRANCE & DATA.GOUV INTEGRATION
 * * Ce module gère l'affichage cartographique et les couches radar
 * sans exposer les clés API sur GitHub.
 */

let map = null;
let positionMarker = null;
let osmLayer = null;
let oaciLayer = null;
let rainRadarLayer = null;

// =====================================================
// 1. CONFIGURATION DU RADAR (SÉCURISÉ)
// =====================================================

async function initRainRadar() {
    console.log("🛰️ Initialisation du flux Radar Météo-France...");

    // Nettoyage si une couche existe déjà
    if (rainRadarLayer && map) {
        map.removeLayer(rainRadarLayer);
    }

    // Récupération du token depuis le secret/localStorage pour GitHub
    const mfToken = localStorage.getItem('MF_TOKEN');

    if (mfToken) {
        // OPTION A : Flux WMS AROME-PI (Haute résolution via API)
        const wmsUrl = "https://portail-api.meteofrance.fr/wms/MF-NWP-HIGHRES-AROMEPI-001-FRANCE-WMS/GetMap";
        
        rainRadarLayer = L.tileLayer.wms(wmsUrl, {
            layers: 'PRECIPITATION_TOP_LEVEL', 
            format: 'image/png',
            transparent: true,
            version: '1.3.0',
            opacity: 0.6,
            token: mfToken, // Utilise ton secret enregistré
            pane: "weatherPane",
            attribution: "© Météo-France AROME-PI"
        });
        console.log("✅ Radar AROME-PI activé via Token");
    } else {
        // OPTION B : URL Stable Data.gouv (Mosaïque France sans token)
        console.warn("⚠️ Pas de token MF_TOKEN trouvé. Utilisation de l'URL stable Data.gouv.");
        
        const stableUrl = "https://www.data.gouv.fr/api/1/datasets/r/87668014-3d50-4074-9ba3-c4ef92882bd7";
        
        // Coordonnées de la mosaïque pour couvrir la carte
        const imageBounds = [[51.5, -5.8], [41.2, 9.8]]; 
        
        rainRadarLayer = L.imageOverlay(stableUrl, imageBounds, {
            opacity: 0.7,
            pane: "weatherPane",
            attribution: "© Météo-France / Data.gouv"
        });
        console.log("✅ Radar stable (Data.gouv) activé");
    }

    return rainRadarLayer;
}

// Rafraîchissement automatique toutes les 5 min (Évite le cache navigateur)
setInterval(() => {
    if (rainRadarLayer && map && map.hasLayer(rainRadarLayer)) {
        console.log("🔄 Refresh du radar pluie...");
        const timestamp = Date.now();
        if (typeof rainRadarLayer.setUrl === 'function') {
            // Pour l'image stable
            const baseUrl = "https://www.data.gouv.fr/api/1/datasets/r/87668014-3d50-4074-9ba3-c4ef92882bd7";
            rainRadarLayer.setUrl(`${baseUrl}?t=${timestamp}`);
        } else {
            // Pour le flux WMS
            rainRadarLayer.redraw();
        }
    }
}, 300000);

// =====================================================
// 2. INITIALISATION DE LA CARTE
// =====================================================

async function initMap() {
    if (!document.getElementById("map") || map) return;

    console.log("🗺️ Chargement du Dashboard Tactique...");

    // Initialisation centrée sur la France
    map = L.map("map", {
        zoomControl: true,
        preferCanvas: true
    }).setView([46.6, 2.2], 6);

    window.map = map;

    // Gestion de l'ordre d'affichage (Panes)
    map.createPane("zonesPane").style.zIndex = 650;
    map.createPane("weatherPane").style.zIndex = 675;
    map.createPane("airspacePane").style.zIndex = 700;

    // --- COUCHES DE BASE ---
    osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap"
    }).addTo(map);

    oaciLayer = L.tileLayer("https://data.geopf.fr/private/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&apikey=8Y5CE2vg2zJMePOhqeHYhXx4fmI3uzpz", {
        opacity: 0.7,
        maxZoom: 18,
        attribution: "© IGN — Carte OACI"
    }).addTo(map);

    // --- COUCHES OPÉRATIONNELLES ---
    const dgacIgnLayer = L.tileLayer("https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=TRANSPORTS.DRONES.RESTRICTIONS&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}", {
        opacity: 0.75,
        attribution: "© IGN — Restrictions drones"
    });

    window.openAipLayer = L.layerGroup([], { pane: "airspacePane" }).addTo(map);

    // --- INITIALISATION DU RADAR ---
    const radar = await initRainRadar();
    if (radar) radar.addTo(map);

    // --- CONTRÔLE DES COUCHES ---
    const baseMaps = { "Fond OSM": osmLayer };
    const overlays = {
        "Carte OACI IGN": oaciLayer,
        "Restrictions drones IGN": dgacIgnLayer,
        "Espaces aériens OpenAIP": window.openAipLayer,
        "Radar Pluie (Météo-France)": radar
    };

    L.control.layers(baseMaps, overlays, { collapsed: false }).addTo(map);

    console.log("✅ MAP READY");
}

// =====================================================
// 3. FONCTIONS DE POSITIONNEMENT
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

    if (typeof loadOpenAIPAirspaces === "function") {
        loadOpenAIPAirspaces(lat, lon);
    }
}

// Exports globaux
window.initMap = initMap;
window.updateMapPosition = updateMapPosition;
