/**
 * MAP.JS — Drone OPS Tactical Map
 * VERSION STABLE PRODUCTION
 * OSM + IGN OACI + OpenAIP + DGAC WMTS + DGAC dynamique
 */

let map = null;
let positionMarker = null;

let osmLayer = null;
let oaciLayer = null;


// ================= INIT MAP =================

async function initMap() {

    if (!document.getElementById("map")) return;
    if (map) return;

    console.log("🗺️ Initialisation carte");

    map = L.map("map", {
        zoomControl: true,
        preferCanvas: true
    }).setView([
        window.latitude || 48.783057,
        window.longitude || 2.213649
    ], 10);

    window.map = map;

    // ================= PANE DGAC VECTEUR =================

    if (!map.getPane("zonesPane")) {
        map.createPane("zonesPane");
        map.getPane("zonesPane").style.zIndex = 650;
    }

    // ================= FOND OSM =================

    osmLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution: "© OpenStreetMap"
        }
    ).addTo(map);

    // ================= IGN OACI =================

    try {
        oaciLayer = L.tileLayer(
            "https://data.geopf.fr/private/tms/1.0.0/" +
            "GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI/{z}/{x}/{y}.jpeg" +
            "?apikey=essentiels",
            {
                opacity: 0.7,
                maxZoom: 16,
                attribution: "© IGN"
            }
        ).addTo(map);
    } catch(e){
        console.warn("OACI indisponible", e);
    }

    // ================= OPENAIP =================

    window.openAipLayer = L.layerGroup().addTo(map);

    // ================= DGAC WMTS (affichage global France) =================

    let dgacWmtsLayer = null;

    try {
        dgacWmtsLayer = L.tileLayer(
            "https://data.geopf.fr/wmts?" +
            "SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
            "&LAYER=TRANSPORTS.DRONES.RESTRICTIONS" +
            "&STYLE=normal" +
            "&TILEMATRIXSET=PM" +
            "&FORMAT=image/png" +
            "&TILEMATRIX={z}" +
            "&TILEROW={y}" +
            "&TILECOL={x}" +
            "&apikey=essentiels",
            {
                opacity: 0.55,
                attribution: "DGAC / IGN",
                crossOrigin: true
            }
        ).addTo(map);
    } catch(e){
        console.warn("DGAC WMTS error", e);
    }

    // ================= DGAC VECTEUR (clic + altitude) =================

    let dgacVectorLayer = null;

    if (typeof window.loadDGACZones === "function") {
        try {
            dgacVectorLayer = await window.loadDGACZones();

            if (dgacVectorLayer) {
                dgacVectorLayer.addTo(map);
                console.log("✅ DGAC vecteur chargé");
            }
        } catch(e){
            console.warn("DGAC vector error", e);
        }
    }

    // ================= CONTROLE COUCHES =================

    const baseMaps = {
        "Fond OSM": osmLayer
    };

    const overlays = {
        "Carte OACI IGN": oaciLayer,
        "Espaces aériens OpenAIP": window.openAipLayer
    };

    if (dgacWmtsLayer)
        overlays["DGAC Officiel (WMTS)"] = dgacWmtsLayer;

    if (dgacVectorLayer)
        overlays["DGAC Dynamique (clic)"] = dgacVectorLayer;

    L.control.layers(baseMaps, overlays, {
        collapsed: false
    }).addTo(map);

    // ================= AUTO OPENAIP =================

    setTimeout(() => {
        if (typeof initOpenAIPAutoUpdate === "function") {
            initOpenAIPAutoUpdate();
        }
    }, 500);

    console.log("✅ MAP READY");
}


// ================= UPDATE POSITION =================

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

    // refresh OpenAIP
    if (typeof loadOpenAIPAirspaces === "function") {
        loadOpenAIPAirspaces(lat, lon);
    }
}


// ================= OPENAIP SUPPORT =================

function setOpenAIPLayer(layer) {

    if (!window.openAipLayer) return;

    try {
        window.openAipLayer.clearLayers();
        if (layer) window.openAipLayer.addLayer(layer);
    } catch(e){
        console.warn("OpenAIP layer error", e);
    }
}


// ================= EXPORT GLOBAL =================

window.initMap = initMap;
window.updateMapPosition = updateMapPosition;
window.setOpenAIPLayer = setOpenAIPLayer;
