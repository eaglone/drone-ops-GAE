/**
 * MAP.JS — Drone OPS
 * Version stable GitHub + OACI + zones
 */

let map = null;
let positionMarker = null;


// =============================
// INIT MAP
// =============================

function initMap(){

    if(!document.getElementById("map")) return;

    console.log("INIT MAP...");

    map = L.map("map",{
        zoomControl:true
    }).setView(
        [window.latitude || 48.78, window.longitude || 2.22],
        10
    );

// ===============================
// ⭐ FOND OACI IGN AVEC TA CLÉ API
// ===============================

const oaciLayer = L.tileLayer(
  "https://data.geopf.fr/private/wmts?" +
  "SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
  "&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI" +
  "&STYLE=normal" +
  "&TILEMATRIXSET=PM" +
  "&FORMAT=image/jpeg" +
  "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}" +
  "&apikey=8Y5CE2vg2zJMePOhqeHYhXx4fmI3uzpz",
  {
    attribution:"© IGN — Carte OACI",
    maxZoom:18,
    minZoom:5,
    crossOrigin:true
  }
).addTo(map);


    // ===============================
    // PANES PRIORITÉ
    // ===============================

    // zones aériennes
    map.createPane("zonesPane");
    map.getPane("zonesPane").style.zIndex = 650;

    // position utilisateur
    map.createPane("markerPane");
    map.getPane("markerPane").style.zIndex = 700;


    // ===============================
    // CHARGEMENT ZONES
    // ===============================

    if(typeof loadAllZones === "function"){
        console.log("Chargement zones...");
        loadAllZones();
    }


    // ===============================
    // POSITION INITIALE
    // ===============================

    updateMapPosition(
        window.latitude || 48.78,
        window.longitude || 2.22
    );


    console.log("MAP READY");
}


// =============================
// UPDATE POSITION
// =============================

function updateMapPosition(lat, lon){

    if(!map) return;

    // déplacement doux
    map.flyTo([lat, lon], 11, {
        duration:0.6
    });

    // supprimer ancien marker
    if(positionMarker){
        map.removeLayer(positionMarker);
    }

    // cercle position
    positionMarker = L.circle([lat, lon],{
        pane:"markerPane",
        radius:500,
        color:"#38bdf8",
        weight:2,
        fillOpacity:0.15
    }).addTo(map);

    // radar pluie si présent
    if(typeof updateRadar === "function"){
        updateRadar(lat, lon);
    }

    console.log("Position MAJ:",lat,lon);
}


// =============================
// UTILITAIRE — CENTRER
// =============================

function centerMap(lat,lon,zoom=11){
    if(!map) return;
    map.setView([lat,lon],zoom);
}


// =============================
// EXPORT GLOBAL
// =============================

window.initMap = initMap;
window.updateMapPosition = updateMapPosition;
window.centerMap = centerMap;
