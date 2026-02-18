/**
 * OPENAIP.JS — Aviation Airspaces Tiles Overlay
 * Version PRO STABLE (GitHub Pages safe)
 * Utilise OpenAIP Tiles API (PNG)
 */

const OPENAIP_KEY = "db8fd47e611ac318fc7716c10311d4f2";

let openAipTiles = null;


// =============================
// INIT OPENAIP TILES
// =============================

function initOpenAIPLayer(){

    if(!window.map || !window.openAipLayer) return;

    console.log("✈️ Initialisation OpenAIP tiles");

    // sécurité pane
    if(!map.getPane("zonesPane")){
        map.createPane("zonesPane");
        map.getPane("zonesPane").style.zIndex = 650;
    }

    // éviter double chargement
    if(openAipTiles) return;

    openAipTiles = L.tileLayer(
        "https://{s}.api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png?apiKey=" + OPENAIP_KEY,
        {
            subdomains:["a","b","c"],
            pane:"zonesPane",
            opacity:0.75,
            maxZoom:18,
            attribution:'© <a href="https://www.openaip.net">OpenAIP</a>'
        }
    );

    window.openAipLayer.addLayer(openAipTiles);
}


// =============================
// UPDATE POSITION (compat MAP.JS)
// =============================

function loadOpenAIPAirspaces(){
    // plus besoin de fetch — tiles auto
    if(!openAipTiles) initOpenAIPLayer();
}


// =============================
// AUTO UPDATE MAP
// =============================

function initOpenAIPAutoUpdate(){

    if(!window.map) return;

    initOpenAIPLayer();

    // recharge si toggle layer
    map.on("overlayadd", e=>{
        if(e.name?.includes("OpenAIP")){
            initOpenAIPLayer();
        }
    });
}


// =============================
// EXPORT GLOBAL
// =============================

window.initOpenAIPLayer = initOpenAIPLayer;
window.loadOpenAIPAirspaces = loadOpenAIPAirspaces;
window.initOpenAIPAutoUpdate = initOpenAIPAutoUpdate;
