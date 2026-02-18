/**
 * MAP.JS — Drone OPS Tactical Map
 * VERSION STABLE IGN + OACI + OPENAIP
 */

let map = null;
let positionMarker = null;

let ignPlan;
let ignOACI;
let openAipLayer;


// ================= INIT MAP =================

function initMap(){

    const mapDiv = document.getElementById("map");
    if(!mapDiv) return;

    map = L.map("map").setView([window.latitude || 48.85, window.longitude || 2.35], 10);

    window.map = map;


    // =============================
    // PRIORITÉ ZONES
    // =============================

    map.createPane("zonesPane");
    map.getPane("zonesPane").style.zIndex = 650;


    // =============================
    // IGN PLAN (URL CORRECTE LEAFLET)
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
            attribution:"© IGN GeoPF",
            crossOrigin:true
        }
    ).addTo(map);


    // =============================
    // OACI
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
            maxZoom:15,
            crossOrigin:true
        }
    );


    // =============================
    // OPENAIP
    // =============================

    openAipLayer = L.layerGroup();


    // =============================
    // CONTROLE COUCHES
    // =============================

    L.control.layers(
        {
            "IGN Plan": ignPlan,
            "Carte OACI": ignOACI
        },
        {
            "Espaces aériens": openAipLayer
        },
        { collapsed:false }
    ).addTo(map);


    // =============================
    // AUTO OACI SELON ZOOM
    // =============================

    map.on("zoomend",()=>{

        if(map.getZoom() >= 12){
            if(!map.hasLayer(ignOACI)) ignOACI.addTo(map);
        }else{
            if(map.hasLayer(ignOACI)) map.removeLayer(ignOACI);
        }

    });

    console.log("✅ MAP INIT OK");
}


// ================= UPDATE POSITION =================

function updateMapPosition(lat,lon){

    if(!map) return;

    map.flyTo([lat,lon],11,{duration:0.6});

    if(positionMarker) map.removeLayer(positionMarker);

    positionMarker = L.circle([lat,lon],{
        radius:500,
        color:"#38bdf8",
        weight:2,
        fillOpacity:0.15
    }).addTo(map);

    if(typeof loadOpenAIPAirspaces==="function"){
        loadOpenAIPAirspaces(lat,lon);
    }
}


// ================= EXPORT GLOBAL =================

window.initMap = initMap;
window.updateMapPosition = updateMapPosition;
