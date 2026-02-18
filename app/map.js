/**
 * MAP.JS — Drone OPS Map Engine
 * OSM + IGN OACI + OpenAIP
 */

let map = null;
let positionMarker = null;


// ================= INIT MAP =================

function initMap(){

    if (!document.getElementById("map")) return;

    map = L.map("map",{
        zoomControl:true,
        preferCanvas:true
    }).setView([window.latitude, window.longitude], 9);


    // ===============================
    // ⭐ OPENSTREETMAP (fond détails)
    // ===============================

    const osm = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom:19,
            maxNativeZoom:19,
            attribution:"© OpenStreetMap"
        }
    ).addTo(map);


    // ===============================
    // ⭐ IGN OACI aviation overlay
    // ===============================

    const oaci = L.tileLayer(
        "https://data.geopf.fr/private/wmts?" +
        "SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
        "&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI" +
        "&STYLE=normal" +
        "&TILEMATRIXSET=PM" +
        "&FORMAT=image/jpeg" +
        "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}" +
        "&apikey=8Y5CE2vg2zJMePOhqeHYhXx4fmI3uzpz",
        {
            maxZoom:18,
            maxNativeZoom:14,
            opacity:0.85,
            attribution:"© IGN OACI",
            crossOrigin:true
        }
    ).addTo(map);

    // OACI au-dessus OSM
    oaci.bringToFront();


    // ===============================
    // ZONES PRIORITÉ
    // ===============================

    map.createPane("zonesPane");
    map.getPane("zonesPane").style.zIndex = 650;


    // ===============================
    // ⭐ OPENAIP INIT (ICI uniquement)
    // ===============================

    if(window.initOpenAIPAutoUpdate){
        initOpenAIPAutoUpdate();
    }

    if(window.loadOpenAIPAirspaces){
        loadOpenAIPAirspaces(window.latitude, window.longitude);
    }
}


// ================= UPDATE POSITION =================

function updateMapPosition(lat,lon){

    if(!map) return;

    map.flyTo([lat,lon],11,{duration:0.6});

    // marqueur position
    if(positionMarker) map.removeLayer(positionMarker);

    positionMarker = L.circle([lat,lon],{
        radius:500,
        color:"#38bdf8",
        fillOpacity:0.15
    }).addTo(map);

    // recharge airspaces
    if(window.loadOpenAIPAirspaces){
        loadOpenAIPAirspaces(lat,lon);
    }

    updateRadar?.(lat,lon);
}


// ================= EXPORT =================

window.initMap = initMap;
window.updateMapPosition = updateMapPosition;
