/**
 * MAP.JS — Drone OPS Tactical Map
 * WMTS global + WFS dynamique cliquable
 */

let map = null;
let positionMarker = null;

let osmLayer = null;
let oaciLayer = null;
let dgacWmtsLayer = null;
let dgacVectorLayer = null;

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

    // ================= PANE VECTEUR DGAC =================

    map.createPane("zonesPane");
    map.getPane("zonesPane").style.zIndex = 650;

    // ================= OSM =================

    osmLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { maxZoom: 19 }
    ).addTo(map);

    // ================= OACI =================

    oaciLayer = L.tileLayer(
        "https://data.geopf.fr/private/tms/1.0.0/" +
        "GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI/{z}/{x}/{y}.jpeg" +
        "?apikey=8Y5CE2vg2zJMePOhqeHYhXx4fmI3uzpz",
        { opacity: 0.7 }
    );

    // ================= DGAC WMTS (FRANCE COMPLETE) =================
    // affichage global ultra rapide

  dgacWmtsLayer = L.tileLayer(
    "https://data.geopf.fr/wmts?" +
    "SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
    "&LAYER=DGAC_RESTRICTIONS-UAS" +
    "&STYLE=normal" +
    "&TILEMATRIXSET=PM" +
    "&FORMAT=image/png" +
    "&TILEMATRIX={z}" +
    "&TILEROW={y}" +
    "&TILECOL={x}",
    {
        opacity: 0.55,
        crossOrigin: true,   // 🔥 IMPORTANT
        referrerPolicy: "no-referrer"
    }
);


    // ================= DGAC VECTEUR CLIQUABLE =================

    if (typeof window.loadDGACZones === "function") {
        dgacVectorLayer = await window.loadDGACZones();
        dgacVectorLayer.addTo(map);
    }

    // ================= CHARGEMENT DYNAMIQUE WFS =================
    // vecteur seulement si zoom élevé

    map.on("moveend zoomend", () => {

        if (map.getZoom() < 9) {
            dgacVectorLayer?.clearLayers();
            return;
        }

        if (typeof window.loadDGACForBounds === "function") {
            window.loadDGACForBounds();
        }
    });

    // ================= OPENAIP =================

    window.openAipLayer = L.layerGroup().addTo(map);

    // ================= CONTROLE COUCHES =================

    L.control.layers(
        { "Fond OSM": osmLayer },
        {
            "Carte OACI IGN": oaciLayer,
            "DGAC Global": dgacWmtsLayer,
            "DGAC Cliquable": dgacVectorLayer,
            "Espaces aériens OpenAIP": window.openAipLayer
        },
        { collapsed: false }
    ).addTo(map);

    console.log("✅ MAP READY");
}

window.initMap = initMap;
