let map = null;
let positionMarker = null;

let osmLayer = null;
let oaciLayer = null;

async function initMap(){

    if(!document.getElementById("map")) return;
    if(map) return;

    console.log("🗺️ Initialisation carte");

    map = L.map("map", {
        zoomControl:true,
        preferCanvas:true
    }).setView([
        window.latitude || 48.783057,
        window.longitude || 2.213649
    ], 10);

    window.map = map;

    // ===============================
    // PANES (ordre couches)
    // ===============================

    map.createPane("basePane");
    map.getPane("basePane").style.zIndex = 200;

    map.createPane("oaciPane");
    map.getPane("oaciPane").style.zIndex = 300;

    map.createPane("dgacWmtsPane");
    map.getPane("dgacWmtsPane").style.zIndex = 400;

    map.createPane("zonesPane");
    map.getPane("zonesPane").style.zIndex = 650;
    map.getPane("zonesPane").style.pointerEvents = "auto";

    map.createPane("topPane");
    map.getPane("topPane").style.zIndex = 700;

    // ===============================
    // OSM BASE
    // ===============================

    osmLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            pane:"basePane",
            maxZoom:19,
            attribution:"© OpenStreetMap"
        }
    ).addTo(map);

    // ===============================
    // OACI IGN (WMTS PROPRE)
    // ===============================

    oaciLayer = L.tileLayer(
        "https://data.geopf.fr/private/wmts?" +
        "SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
        "&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI" +
        "&STYLE=normal&TILEMATRIXSET=PM" +
        "&FORMAT=image/jpeg" +
        "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}" +
        "&apikey=8Y5CE2vg2zJMePOhqeHYhXx4fmI3uzpz",
        {
            pane:"oaciPane",
            opacity:0.7,
            maxZoom:18,
            crossOrigin:true,
            attribution:"© IGN OACI"
        }
    ).addTo(map);

    // ===============================
    // DGAC WMTS GLOBAL (visuel)
    // ⚠️ clé IGN requise
    // ===============================

    const DGAC_KEY = "essentiels"; // ou ta vraie clé

    window.dgacWmtsLayer = L.tileLayer(
        "https://data.geopf.fr/wmts?" +
        "SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
        "&LAYER=TRANSPORTS.DRONES.RESTRICTIONS" +
        "&STYLE=normal&TILEMATRIXSET=PM" +
        "&FORMAT=image/png" +
        "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}" +
        "&apikey=" + DGAC_KEY,
        {
            pane:"dgacWmtsPane",
            opacity:0.5
        }
    ).addTo(map);

    // ===============================
    // DGAC VECTEUR CLIQUABLE
    // ===============================

    let dgacVector = null;

    if(typeof window.loadDGACZones === "function"){
        dgacVector = await window.loadDGACZones();
        if(dgacVector) dgacVector.addTo(map);
    }

    // ===============================
    // OPENAIP TOP LAYER
    // ===============================

    window.openAipLayer = L.layerGroup([], {pane:"topPane"}).addTo(map);

    if(typeof initOpenAIPAutoUpdate === "function"){
        initOpenAIPAutoUpdate();
    }

    // ===============================
    // CONTROLE COUCHES
    // ===============================

    const overlays = {
        "Carte OACI": oaciLayer,
        "DGAC Global": window.dgacWmtsLayer,
        "DGAC Cliquable": dgacVector,
        "Espaces aériens OpenAIP": window.openAipLayer
    };

    L.control.layers(
        { "Fond OSM": osmLayer },
        overlays,
        { collapsed:false }
    ).addTo(map);

    console.log("✅ MAP READY");
}

window.initMap = initMap;
