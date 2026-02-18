/**
 * MAP.JS — Drone OPS Tactical Map
 * OSM + IGN OACI + OpenAIP
 * Version stable GitHub Pages
 */

let map;
let positionMarker;

let osmLayer;
let oaciLayer;
let openAipLayer;


// ================= INIT MAP =================

function initMap(){

    if(!document.getElementById("map")) return;

    console.log("🗺️ Initialisation carte");

    map = L.map("map").setView(
        [window.latitude, window.longitude],
        10
    );

    window.map = map;


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


    // ================= OPENAIP (groupe dynamique)

    openAipLayer = L.layerGroup().addTo(map);


    // ================= CONTROLE COUCHES

    L.control.layers(
        { "Fond OSM": osmLayer },
        {
            "Carte OACI IGN": oaciLayer,
            "Espaces aériens OpenAIP": openAipLayer
        },
        { collapsed:false }
    ).addTo(map);


    // auto refresh OpenAIP si déplacement
    map.on("moveend", () => {
        const c = map.getCenter();
        loadOpenAIPAirspaces?.(c.lat, c.lng);
    });

    console.log("✅ MAP READY");
}


// ================= UPDATE POSITION =================

function updateMapPosition(lat,lon){

    if(!map || !lat || !lon) return;

    map.flyTo([lat,lon],11,{duration:0.6});

    if(positionMarker) map.removeLayer(positionMarker);

    positionMarker = L.circle([lat,lon],{
        radius:500,
        color:"#38bdf8",
        weight:2,
        fillOpacity:0.15
    }).addTo(map);

    loadOpenAIPAirspaces?.(lat,lon);
}


// ================= OPENAIP RENDER =================

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
