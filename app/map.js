/**
 * MAP.JS — Drone OPS Tactical Map
 * VERSION STABLE PRODUCTION
 * OSM + IGN OACI + OpenAIP + DGAC WMTS + DGAC dynamique
 */

let map = null;
let positionMarker = null;

let osmLayer = null;
let oaciLayer = null;

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

    // ================= PANES ORDER =================

    map.createPane("osmPane");
    map.getPane("osmPane").style.zIndex = 200;

    map.createPane("oaciPane");
    map.getPane("oaciPane").style.zIndex = 300;

    map.createPane("dgacWmtsPane");
    map.getPane("dgacWmtsPane").style.zIndex = 400;

    map.createPane("zonesPane"); // DGAC vecteur cliquable
    map.getPane("zonesPane").style.zIndex = 650;
    map.getPane("zonesPane").style.pointerEvents = "auto";

    map.createPane("openAipPane");
    map.getPane("openAipPane").style.zIndex = 700;

    // ================= OSM =================

    osmLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            pane:"osmPane",
            maxZoom:19,
            attribution:"© OpenStreetMap"
        }
    ).addTo(map);
// ===============================
// ⭐ FOND OACI IGN (WMTS OFFICIEL)
// ===============================

// pane dédié
if (!map.getPane("oaciPane")) {
    map.createPane("oaciPane");
    map.getPane("oaciPane").style.zIndex = 300; // sous DGAC / OpenAIP
}

const oaciLayer = L.tileLayer(
  "https://data.geopf.fr/private/wmts?" +
  "SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
  "&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI" +
  "&STYLE=normal" +
  "&TILEMATRIXSET=PM" +
  "&FORMAT=image/jpeg" +
  "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}" +
  "&apikey=8Y5CE2vg2zJMePOhqeHYhXx4fmI3uzpz",
  {
    pane: "oaciPane",
    attribution: "© IGN — Carte OACI",
    maxZoom: 18,
    minZoom: 5,
    tileSize: 256,
    crossOrigin: true
  }
);

// actif par défaut
oaciLayer.addTo(map);

console.log("✅ OACI IGN chargé");



    // ================= DGAC WMTS (visuel global France) =================
    // ⚠️ nécessite vraie clé IGN

    const DGAC_KEY = "TA_CLE_IGN"; // ← remplace

    window.dgacWmtsLayer = L.tileLayer(
        `https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0` +
        `&LAYER=DGAC_RESTRICTIONS-UAS&STYLE=normal&TILEMATRIXSET=PM` +
        `&FORMAT=image/png&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}` +
        `&apikey=${DGAC_KEY}`,
        {
            pane:"dgacWmtsPane",
            opacity:0.5
        }
    ).addTo(map);

    // ================= OPENAIP CONTAINER =================

    window.openAipLayer = L.layerGroup().addTo(map);

    // ================= DGAC VECTEUR CLIQUABLE =================

    let dgacVector = null;

    if (window.loadDGACZones) {
        dgacVector = await window.loadDGACZones();

        if (dgacVector) {
            dgacVector.addTo(map);
            console.log("✅ DGAC vecteur chargé");
        }
    }

    // ================= LAYER CONTROL =================

    const baseMaps = {
        "Fond OSM": osmLayer
    };

    const overlays = {
        "Carte OACI IGN": oaciLayer,
        "DGAC Global": window.dgacWmtsLayer,
        "DGAC Cliquable": dgacVector,
        "Espaces aériens OpenAIP": window.openAipLayer
    };

    L.control.layers(baseMaps, overlays, {collapsed:false}).addTo(map);

    // ================= OPENAIP INIT =================

    setTimeout(() => {
        if(window.initOpenAIPAutoUpdate) initOpenAIPAutoUpdate();
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
