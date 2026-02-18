/**
 * MAP.JS — Drone OPS Tactical Map
 * VERSION STABLE PRODUCTION
 * IGN + OACI + OpenAIP
 */

let map = null;
let positionMarker = null;

let ignPlan = null;
let ignOACI = null;

// ⭐ IMPORTANT → pas de redeclaration si déjà créé ailleurs
window.openAipLayer = window.openAipLayer || null;


// =====================================================
// FIX WMTS IGN (inversion Y GeoPF)
// =====================================================

L.TileLayer.WMTS = L.TileLayer.extend({
    getTileUrl: function (coords) {
        return L.Util.template(this._url, {
            z: coords.z,
            x: coords.x,
            y: (Math.pow(2, coords.z) - coords.y - 1)
        });
    }
});


// =====================================================
// INIT MAP
// =====================================================

function initMap() {

    const mapDiv = document.getElementById("map");

    if (!mapDiv) {
        console.error("❌ DIV #map introuvable");
        return;
    }

    console.log("🗺️ Initialisation carte");

    // création carte
    map = L.map("map", {
        zoomControl: true
    }).setView([window.latitude, window.longitude], 10);

    window.map = map;


    // =============================
    // PRIORITÉ ZONES
    // =============================

    map.createPane("zonesPane");
    map.getPane("zonesPane").style.zIndex = 650;


    // =============================
    // IGN PLAN (fond principal)
    // =============================

    ignPlan = new L.TileLayer.WMTS(
        "https://data.geopf.fr/wmts?" +
        "SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
        "&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLAN.IGN" +
        "&STYLE=normal" +
        "&TILEMATRIXSET=PM" +
        "&FORMAT=image/png" +
        "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}" +
        "&apikey=8Y5CE2vg2zJMePOhqeHYhXx4fmI3uzpz",
        {
            tileSize: 256,
            maxZoom: 18,
            attribution: "© IGN GeoPF"
        }
    ).addTo(map);


    // =============================
    // CARTE OACI
    // =============================

    ignOACI = new L.TileLayer.WMTS(
        "https://data.geopf.fr/wmts?" +
        "SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
        "&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI" +
        "&STYLE=normal" +
        "&TILEMATRIXSET=PM" +
        "&FORMAT=image/jpeg" +
        "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}" +
        "&apikey=8Y5CE2vg2zJMePOhqeHYhXx4fmI3uzpz",
        {
            opacity: 0.7,
            maxZoom: 15
        }
    );


    // =============================
    // OPENAIP GROUP
    // =============================

    if (!window.openAipLayer) {
        window.openAipLayer = L.layerGroup().addTo(map);
    }


    // =============================
    // CONTROLE COUCHES
    // =============================

    L.control.layers(
        {
            "IGN Plan": ignPlan,
            "Carte OACI": ignOACI
        },
        {
            "Espaces aériens OpenAIP": window.openAipLayer
        },
        { collapsed: false }
    ).addTo(map);


    // =============================
    // OACI AUTO ZOOM
    // =============================

    map.on("zoomend", () => {

        const z = map.getZoom();

        if (z >= 12) {
            if (!map.hasLayer(ignOACI)) {
                map.addLayer(ignOACI);
            }
        } else {
            if (map.hasLayer(ignOACI)) {
                map.removeLayer(ignOACI);
            }
        }
    });

    console.log("✅ MAP READY");
}


// =====================================================
// UPDATE POSITION
// =====================================================

function updateMapPosition(lat, lon) {

    if (!map || !lat || !lon) return;

    map.flyTo([lat, lon], 11, { duration: 0.6 });

    if (positionMarker) {
        map.removeLayer(positionMarker);
    }

    positionMarker = L.circle([lat, lon], {
        radius: 500,
        color: "#38bdf8",
        weight: 2,
        fillOpacity: 0.15
    }).addTo(map);

    // recharge openAIP si présent
    if (typeof loadOpenAIPAirspaces === "function") {
        loadOpenAIPAirspaces(lat, lon);
    }
}


// =====================================================
// EXPORT GLOBAL
// =====================================================

window.initMap = initMap;
window.updateMapPosition = updateMapPosition;
