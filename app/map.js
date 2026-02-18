/**
 * MAP.JS — Drone OPS Tactical Map
 * OpenStreetMap + OACI + OpenAIP
 * VERSION PRODUCTION STABLE
 */

let map = null;
let positionMarker = null;

let osmLayer;
let oaciLayer;
let openAipLayer;


// ================= INIT MAP =================

function initMap(){

    console.log("🗺️ Initialisation carte");

    if (!document.getElementById("map")) return;

    map = L.map("map", {
        zoomControl:true
    }).setView([window.latitude, window.longitude], 10);

    window.map = map;


    // =============================
    // PRIORITÉ ZONES (overlay)
    // =============================

    map.createPane("zonesPane");
    map.getPane("zonesPane").style.zIndex = 650;


    // =============================
    // OPENSTREETMAP (FOND PRINCIPAL)
    // =============================

    osmLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom:19,
            attribution:"© OpenStreetMap"
        }
    ).addTo(map);


    // =============================
    // CARTE OACI (IGN AÉRONAUTIQUE)
    // =============================

    oaciLayer = L.tileLayer(
        "https://data.geopf.fr/wmts?" +
        "SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
        "&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI" +
        "&STYLE=normal" +
        "&TILEMATRIXSET=PM" +
        "&FORMAT=image/jpeg" +
        "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}" +
        "&apikey=8Y5CE2vg2zJMePOhqeHYhXx4fmI3uzpz",
        {
            opacity:0.65,
            maxZoom:15,
            attribution:"© IGN OACI"
        }
    );


    // =============================
    // OPENAIP AIRSPACES
    // =============================

    openAipLayer = L.layerGroup().addTo(map);


    // =============================
    // CONTROLE COUCHES UTILISATEUR
    // =============================

    L.control.layers(
        {
            "OpenStreetMap": osmLayer,
            "Carte OACI": oaciLayer
        },
        {
            "Espaces aériens OpenAIP": openAipLayer
        },
        { collapsed:false }
    ).addTo(map);


    // =============================
    // AUTO OACI SELON ZOOM
    // =============================
    // → évite pollution visuelle zoom bas

    map.on("zoomend",()=>{

        const z = map.getZoom();

        if(z >= 11){
            if(!map.hasLayer(oaciLayer)){
                oaciLayer.addTo(map);
            }
        }else{
            if(map.hasLayer(oaciLayer)){
                map.removeLayer(oaciLayer);
            }
        }

    });


    // =============================
    // AUTO LOAD OPENAIP
    // =============================

    if(typeof initOpenAIPAutoUpdate === "function"){
        initOpenAIPAutoUpdate();
    }

    console.log("✅ MAP READY");
}


// ================= UPDATE POSITION =================

function updateMapPosition(lat, lon){

    if(!map || !lat || !lon) return;

    map.flyTo([lat, lon], 11, {duration:0.6});

    if(positionMarker){
        map.removeLayer(positionMarker);
    }

    positionMarker = L.circle([lat, lon],{
        radius:500,
        color:"#38bdf8",
        weight:2,
        fillOpacity:0.15
    }).addTo(map);

    if(typeof loadOpenAIPAirspaces === "function"){
        loadOpenAIPAirspaces(lat, lon);
    }

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
