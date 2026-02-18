/**
 * MAP.JS — Drone OPS Tactical Map
 * OSM + IGN OACI + OpenAIP
 * Version production GitHub Pages stable
 */

let map = null;
let positionMarker = null;

let osmLayer = null;
let oaciLayer = null;


// ================= INIT MAP =================

function initMap(){

    if(!document.getElementById("map")) return;

    console.log("🗺️ Initialisation carte");

    // sécurité double init
    if(map) return;

    map = L.map("map",{
        zoomControl:true
    }).setView([window.latitude, window.longitude],10);

    // rendre accessible globalement
    window.map = map;


    // ================= PANE PRIORITÉ ZONES =================

    if(!map.getPane("zonesPane")){
        map.createPane("zonesPane");
        map.getPane("zonesPane").style.zIndex = 650;
    }


    // ================= OSM (fond sécurité)

    osmLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom:19,
            attribution:"© OpenStreetMap"
        }
    ).addTo(map);


    // ================= IGN OACI (overlay aviation)

    oaciLayer = L.tileLayer(
        "https://data.geopf.fr/private/tms/1.0.0/" +
        "GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI/{z}/{x}/{y}.jpeg" +
        "?apikey=8Y5CE2vg2zJMePOhqeHYhXx4fmI3uzpz",
        {
            opacity:0.7,
            maxZoom:16,
            attribution:"© IGN OACI"
        }
    ).addTo(map);


    // ================= OPENAIP GLOBAL LAYER (IMPORTANT)

    // 👉 toujours global sinon openaip.js plante
    window.openAipLayer = L.layerGroup().addTo(map);


    // ================= CONTROLE COUCHES

    L.control.layers(
        {
            "Fond OSM": osmLayer
        },
        {
            "Carte OACI IGN": oaciLayer,
            "Espaces aériens OpenAIP": window.openAipLayer
        },
        { collapsed:false }
    ).addTo(map);


    // ================= AUTO UPDATE OPENAIP

    if(typeof initOpenAIPAutoUpdate === "function"){
        initOpenAIPAutoUpdate();
    }

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

    // refresh airspaces
    if(typeof loadOpenAIPAirspaces === "function"){
        loadOpenAIPAirspaces(lat,lon);
    }
}


// ================= OPENAIP LAYER CONTROL (compat ancien code)

function setOpenAIPLayer(layer){

    if(!window.openAipLayer) return;

    try{
        window.openAipLayer.clearLayers();
        if(layer) window.openAipLayer.addLayer(layer);
    }catch(e){
        console.warn("OpenAIP layer error", e);
    }
}


// ================= EXPORT GLOBAL

window.initMap = initMap;
window.updateMapPosition = updateMapPosition;
window.setOpenAIPLayer = setOpenAIPLayer;
