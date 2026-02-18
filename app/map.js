/**
 * MAP.JS — Drone OPS Tactical Map
 * Version Production Stable
 * IGN + OACI + OpenAIP + Layers Control
 */

let map = null;
let positionMarker = null;

let ignPlan;
let ignOACI;
let openAipLayer;


// ================= INIT MAP =================

function initMap(){

    if (!document.getElementById("map")) return;

    // création carte
    map = L.map("map", {
        zoomControl: true
    }).setView([window.latitude, window.longitude], 10);

    // rendre accessible globalement (IMPORTANT)
    window.map = map;


    // =============================
    // PRIORITÉ ZONES
    // =============================

    map.createPane("zonesPane");
    map.getPane("zonesPane").style.zIndex = 650;


    // =============================
    // IGN PLAN (fond principal)
    // =============================

    ignPlan = L.tileLayer(
        "https://data.geopf.fr/wmts?" +
        "SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
        "&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLAN.IGN" +
        "&STYLE=normal" +
        "&TILEMATRIXSET=PM" +
        "&FORMAT=image/png" +
        "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}" +
        "&apikey=8Y5CE2vg2zJMePOhqeHYhXx4fmI3uzpz",
        {
            maxZoom:18,
            attribution:"© IGN GeoPF"
        }
    ).addTo(map);


    // =============================
    // CARTE OACI AÉRONAUTIQUE
    // =============================

    ignOACI = L.tileLayer(
        "https://data.geopf.fr/wmts?" +
        "SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
        "&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI" +
        "&STYLE=normal" +
        "&TILEMATRIXSET=PM" +
        "&FORMAT=image/jpeg" +
        "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}" +
        "&apikey=8Y5CE2vg2zJMePOhqeHYhXx4fmI3uzpz",
        {
            opacity:0.7,
            maxZoom:15
        }
    );


    // =============================
    // OPENAIP GROUP (vide au départ)
    // =============================

    openAipLayer = L.layerGroup();


    // =============================
    // CONTROLE COUCHES (checkbox)
    // =============================

    L.control.layers(
        {
            "IGN Plan": ignPlan,
            "Carte OACI": ignOACI
        },
        {
            "Espaces aériens OpenAIP": openAipLayer
        },
        {
            collapsed:false
        }
    ).addTo(map);


    // =============================
    // AUTO OACI SELON ZOOM
    // =============================

    map.on("zoomend",()=>{

        const zoom = map.getZoom();

        // afficher OACI à partir zoom mission
        if(zoom >= 12){
            if(!map.hasLayer(ignOACI)){
                ignOACI.addTo(map);
            }
        }else{
            if(map.hasLayer(ignOACI)){
                map.removeLayer(ignOACI);
            }
        }
    });


    // =============================
    // AUTO UPDATE OPENAIP
    // =============================

    if(typeof initOpenAIPAutoUpdate === "function"){
        initOpenAIPAutoUpdate();
    }

}


// ================= UPDATE POSITION =================

function updateMapPosition(lat, lon){

    if(!map || !lat || !lon) return;

    map.flyTo([lat, lon], 11, {
        duration:0.6
    });

    // marker position
    if(positionMarker){
        map.removeLayer(positionMarker);
    }

    positionMarker = L.circle([lat, lon],{
        radius:500,
        color:"#38bdf8",
        weight:2,
        fillOpacity:0.15
    }).addTo(map);

    // recharge OpenAIP
    if(typeof loadOpenAIPAirspaces === "function"){
        loadOpenAIPAirspaces(lat, lon);
    }

    // radar pluie
    if(typeof updateRadar === "function"){
        updateRadar(lat, lon);
    }
}


// ================= OPENAIP LAYER CONTROL =================

function setOpenAIPLayer(layer){

    if(!openAipLayer) return;

    openAipLayer.clearLayers();

    if(layer){
        openAipLayer.addLayer(layer);
    }
}


// ================= EXPORT GLOBAL =================

window.initMap = initMap;
window.updateMapPosition = updateMapPosition;
window.setOpenAIPLayer = setOpenAIPLayer;
