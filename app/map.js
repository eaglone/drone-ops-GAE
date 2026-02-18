/**
 * MAP.JS — Drone OPS Tactical Map
 * VERSION PRO — SÉCURISÉE & AUTOMATISÉE
 * * Ce fichier gère l'affichage cartographique et l'injection du token Météo-France.
 */

let map = null;
let positionMarker = null;
let osmLayer = null;
let oaciLayer = null;
let rainRadarLayer = null;

// =====================================================
// 1. GESTION DU RADAR PLUIE (MÉTÉO-FRANCE)
// =====================================================

async function initRainRadar() {
    console.log("🛰️ Initialisation du Radar...");

    if (rainRadarLayer && map) {
        map.removeLayer(rainRadarLayer);
    }

    /**
     * SÉCURITÉ : Injection du Token
     * La balise ci-dessous est remplacée par GitHub Actions lors du déploiement.
     */
    const injectedToken = "__METEO_FRANCE_API_KEY__";
    
    // On vérifie si le token est injecté, sinon on check le localStorage (pour le dev local)
    const mfToken = (injectedToken !== "__" + "METEO_FRANCE_API_KEY__" && injectedToken !== "") 
                    ? injectedToken 
                    : localStorage.getItem('MF_TOKEN');

    if (mfToken) {
        // OPTION A : Flux AROME-PI Haute Résolution (Requiert Token)
        console.log("✅ Token détecté : Chargement AROME-PI HD");
        const wmsUrl = "https://portail-api.meteofrance.fr/wms/MF-NWP-HIGHRES-AROMEPI-001-FRANCE-WMS/GetMap";
        
        rainRadarLayer = L.tileLayer.wms(wmsUrl, {
            layers: 'PRECIPITATION_TOP_LEVEL', 
            format: 'image/png',
            transparent: true,
            version: '1.3.0',
            opacity: 0.65,
            token: mfToken,
            pane: "weatherPane",
            attribution: "© Météo-France AROME-PI"
        });
    } else {
        // OPTION B : Image Stable Data.gouv (Sans Token)
        console.warn("⚠️ Aucun token trouvé : Passage sur URL stable Data.gouv");
        const stableUrl = "https://www.data.gouv.fr/api/1/datasets/r/87668014-3d50-4074-9ba3-c4ef92882bd7";
        const imageBounds = [[51.5, -5.8], [41.2, 9.8]]; // Calage France
        
        rainRadarLayer = L.imageOverlay(stableUrl, imageBounds, {
            opacity: 0.7,
            pane: "weatherPane",
            attribution: "© Météo-France / Data.gouv"
        });
    }

    return rainRadarLayer;
}

// Rafraîchissement automatique toutes les 5 minutes
setInterval(() => {
    if (rainRadarLayer && map && map.hasLayer(rainRadarLayer)) {
        console.log("🔄 Actualisation des données radar...");
        if (typeof rainRadarLayer.setUrl === 'function') {
            const baseUrl = "https://www.data.gouv.fr/api/1/datasets/r/87668014-3d50-4074-9ba3-c4ef92882bd7";
            rainRadarLayer.setUrl(`${baseUrl}?t=${Date.now()}`);
        } else if (typeof rainRadarLayer.redraw === 'function') {
            rainRadarLayer.redraw();
        }
    }
}, 300000);

// =====================================================
// 2. INITIALISATION DE LA CARTE
// =====================================================

async function initMap() {
    // Sécurité contre la double initialisation
    if (!document.getElementById("map") || map) return;

    console.log("🗺️ Chargement du Dashboard Tactique...");

    // Config compatible Leaflet 1.4.0 (Windy)
    map = L.map("map", {
        zoomControl: true,
        preferCanvas: false,
        zoomAnimation: false 
    }).setView([46.6, 2.2], 6);

    window.map = map;

    // Création des Panes (Z-Index)
    map.createPane("weatherPane").style.zIndex = 675;
    map.createPane("airspacePane").style.zIndex = 700;

    // --- COUCHES DE BASE ---
    osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap"
    }).addTo(map);

    oaciLayer = L.tileLayer("https://data.geopf.fr/private/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&apikey=8Y5CE2vg2zJMePOhqeHYhXx4fmI3uzpz", {
        opacity: 0.7,
        attribution: "© IGN — Carte OACI"
    }).addTo(map);

    // --- COUCHES OPÉRATIONNELLES ---
    window.openAipLayer = L.layerGroup([], { pane: "airspacePane" }).addTo(map);

    // --- RADAR ---
    const radar = await initRainRadar();
    if (radar) radar.addTo(map);

    // --- CONTRÔLEUR DE COUCHES ---
    const baseMaps = { "Fond OSM": osmLayer };
    const overlays = {
        "Carte OACI IGN": oaciLayer,
        "Espaces aériens": window.openAipLayer,
        "Radar Pluie": radar
    };

    L.control.layers(baseMaps, overlays, { collapsed: false }).addTo(map);

    console.log("✅ MAP READY");
}

// =====================================================
// 3. FONCTIONS DE POSITIONNEMENT
// =====================================================

function updateMapPosition(lat, lon) {
    if (!map || !lat || !lon) return;

    map.setView([lat, lon], 11);

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

// Exports globaux pour main.js
window.initMap = initMap;
window.updateMapPosition = updateMapPosition;
