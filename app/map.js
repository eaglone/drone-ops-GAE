let map = null;
let positionMarker = null;

// couches globales
let allowedLayer;
let restrictionLayer;
let uasLayer;


// ================= INIT MAP =================

function initMap(){

    if (!document.getElementById("map")) return;

    map = L.map("map").setView([window.latitude, window.longitude], 10);

    // fond carte
    const osm = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19
    }).addTo(map);

    // priorité zones
    map.createPane("zonesPane");
    map.getPane("zonesPane").style.zIndex = 650;

    // groupes couches
    allowedLayer = L.layerGroup()
    restrictionLayer = L.layerGroup().addTo(map);
    uasLayer = L.layerGroup();

    // contrôle affichage
    L.control.layers(
        { "OpenStreetMap": osm },
        {
            "Limites départements": allowedLayer,
            "Restrictions": restrictionLayer,
            "Zones UAS": uasLayer
        },
        { collapsed:false }
    ).addTo(map);
}


// ================= UPDATE POSITION =================

function updateMapPosition(lat, lon){

    if(!map) return;

    map.flyTo([lat, lon], 11, {duration:0.6});

    if(positionMarker) map.removeLayer(positionMarker);

    positionMarker = L.circle([lat, lon], {
        radius:500,
        color:"#38bdf8",
        fillOpacity:0.15
    }).addTo(map);

    updateRadar?.(lat, lon);
}

