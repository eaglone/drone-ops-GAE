/**
 * MAP.JS — Drone OPS Tactical Map
 * STACK STABLE
 *
 * ORDRE COUCHES :
 * 1. OSM (fond)
 * 2. OACI IGN
 * 3. DGAC vecteur
 * 4. OpenAIP (top)
 */

let map = null;
let positionMarker = null;

let osmLayer = null;
let oaciLayer = null;
let rainRadarLayer = null;
// ================= RADAR PLUIE =================

async function initRainRadar(){

    if(rainRadarLayer) return rainRadarLayer;

    console.log("🌧️ init rain radar");

    try{
        const res = await fetch("https://api.rainviewer.com/public/weather-maps.json");
        const data = await res.json();

        const frame = data?.radar?.past?.slice(-1)[0]?.path;
        if(!frame) throw new Error("Radar indisponible");

        rainRadarLayer = L.tileLayer(
            `https://tilecache.rainviewer.com${frame}/256/{z}/{x}/{y}/2/1_1.png`,
            {
                opacity:0.55,
                pane:"airspacePane",
                attribution:"© RainViewer"
            }
        );

        return rainRadarLayer;

    }catch(e){
        console.warn("Radar indisponible", e);
        return null;
    }
}


// ================= INIT MAP =================

async function initMap(){

    if(!document.getElementById("map")) return;
    if(map) return;

    console.log("🗺️ Initialisation carte");

    map = L.map("map",{
        zoomControl:true,
        preferCanvas:true
    }).setView([
        window.latitude || 48.783057,
        window.longitude || 2.213649
    ],10);

    window.map = map;


    // ================= PANES (ordre rendu) =================

    // DGAC vecteur
    map.createPane("zonesPane");
    map.getPane("zonesPane").style.zIndex = 650;

    // OpenAIP au dessus
    map.createPane("airspacePane");
    map.getPane("airspacePane").style.zIndex = 700;


    // ================= OSM (BASE) =================

    osmLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom:19,
            attribution:"© OpenStreetMap"
        }
    ).addTo(map);


    // ================= OACI IGN =================
    // (clé IGN fonctionnelle)

    oaciLayer = L.tileLayer(
        "https://data.geopf.fr/private/wmts?" +
        "SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
        "&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI" +
        "&STYLE=normal" +
        "&TILEMATRIXSET=PM" +
        "&FORMAT=image/jpeg" +
        "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}" +
        "&apikey=8Y5CE2vg2zJMePOhqeHYhXx4fmI3uzpz",
        {
            opacity:0.7,
            maxZoom:18,
            attribution:"© IGN — Carte OACI"
        }
    ).addTo(map);
    
// ================= DGAC IGN WMTS (propre style cartes.gouv.fr) =================

const dgacIgnLayer = L.tileLayer(
  "https://data.geopf.fr/wmts?" +
  "SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
  "&LAYER=TRANSPORTS.DRONES.RESTRICTIONS" +
  "&STYLE=normal" +
  "&TILEMATRIXSET=PM" +
  "&FORMAT=image/png" +
  "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
  {
    opacity:0.75,
    attribution:"© IGN — Restrictions drones"
  }
);


    // ================= OPENAIP CONTAINER =================

    window.openAipLayer = L.layerGroup([],{
        pane:"airspacePane"
    }).addTo(map);


  // ================= DGAC VECTEUR (optionnel cliquable) =================

let dgacLayer = null;

if(typeof window.loadDGACZones === "function"){
    try{
        dgacLayer = await window.loadDGACZones();
        console.log("✅ DGAC vecteur prêt (non affiché)");
    }catch(e){
        console.warn("DGAC erreur", e);
    }
}

    // ================= CONTROLE COUCHES =================

    const baseMaps = {
        "Fond OSM": osmLayer
    };
const radarLayer = await initRainRadar();

const overlays = {
    "Carte OACI IGN": oaciLayer,
    "Restrictions drones IGN": dgacIgnLayer,
    "Espaces aériens OpenAIP": window.openAipLayer
};

const radarLayer = await initRainRadar();
if(radarLayer){
    overlays["Radar pluie"] = radarLayer;
}



if(dgacLayer){
    overlays["DGAC Zones cliquables (avancé)"] = dgacLayer;
}


    L.control.layers(baseMaps, overlays, {
        collapsed:false
    }).addTo(map);


    // ================= INIT OPENAIP =================

    setTimeout(()=>{
        if(typeof initOpenAIPAutoUpdate === "function"){
            initOpenAIPAutoUpdate();
        }
    },500);


    console.log("✅ MAP READY");
}


// ================= UPDATE POSITION =================

function updateMapPosition(lat,lon){

    if(!map || !lat || !lon) return;

    map.flyTo([lat,lon],11,{duration:0.6});

    if(positionMarker){
        map.removeLayer(positionMarker);
    }

    positionMarker = L.circle([lat,lon],{
        radius:500,
        color:"#38bdf8",
        weight:2,
        fillOpacity:0.15
    }).addTo(map);

    if(typeof loadOpenAIPAirspaces === "function"){
        loadOpenAIPAirspaces(lat,lon);
    }
}


// ================= OPENAIP SUPPORT =================

function setOpenAIPLayer(layer){

    if(!window.openAipLayer) return;

    try{
        window.openAipLayer.clearLayers();
        if(layer) window.openAipLayer.addLayer(layer);
    }
    catch(e){
        console.warn("OpenAIP layer error",e);
    }
}


// ================= EXPORT GLOBAL =================

window.initMap = initMap;
window.updateMapPosition = updateMapPosition;
window.setOpenAIPLayer = setOpenAIPLayer;
