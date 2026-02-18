/**
 * MAP.JS — Drone OPS Tactical Map
 * PRODUCTION STABLE
 * OSM + IGN OACI + OpenAIP Tiles + DGAC UAS
 */

let map = null;
let positionMarker = null;

let osmLayer = null;
let oaciLayer = null;

// ================= INIT MAP =================

async function initMap(){ // Ajout de async pour le chargement des zones

    if(!document.getElementById("map")) return;

    // évite double init
    if(map) return;

    console.log("🗺️ Initialisation carte");

    map = L.map("map",{
        zoomControl:true,
        preferCanvas:true // stabilité Leaflet
    }).setView([
        window.latitude || 48.783057,
        window.longitude || 2.213649
    ],10);

    window.map = map;

   // ================= PANE PRIORITÉ ZONES =================

if (!map.getPane("zonesPane")) {
    map.createPane("zonesPane");

    const pane = map.getPane("zonesPane");

    pane.style.zIndex = 650;           // au-dessus des tiles
    pane.style.pointerEvents = "auto"; // 🔥 autorise clics / hover
}

    // ================= FOND OSM (toujours safe)

    osmLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom:19,
            attribution:"© OpenStreetMap"
        }
    ).addTo(map);

    // ================= IGN OACI (overlay aviation)

    try{
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
    }
    catch(e){
        console.warn("OACI non disponible");
    }

    // ================= OPENAIP LAYER GLOBAL

    window.openAipLayer = L.layerGroup().addTo(map);

    // ================= CHARGEMENT COUCHE DGAC (MANUEL) =================

    let dgacLayer = null;
    if(typeof window.loadDGACZones === "function"){
        // On charge la couche mais on ne l'ajoute PAS à la map (.addTo(map))
        // On la récupère juste pour le menu
       dgacLayer = await window.loadDGACZones();

if (dgacLayer) {
    dgacLayer.addTo(map); // 🔥 active la couche
}


    // ================= CONTROLE COUCHES

    const baseMaps = {
        "Fond OSM": osmLayer
    };

    const overlays = {
        "Carte OACI IGN": oaciLayer,
        "Espaces aériens OpenAIP": window.openAipLayer
    };

    // Si la couche DGAC a bien été chargée, on l'ajoute aux overlays
    if(dgacLayer){
        overlays["Restrictions DGAC (UAS)"] = dgacLayer;
    }

    L.control.layers(baseMaps, overlays, {
        collapsed:false // Menu ouvert par défaut pour l'aspect tactique
    }).addTo(map);

    // ================= AUTO INIT OPENAIP

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

    // refresh OpenAIP tiles
    if(typeof loadOpenAIPAirspaces === "function"){
        loadOpenAIPAirspaces(lat,lon);
    }
}

// ================= OPENAIP LAYER CONTROL (legacy support)

function setOpenAIPLayer(layer){
    if(!window.openAipLayer) return;
    try{
        window.openAipLayer.clearLayers();
        if(layer) window.openAipLayer.addLayer(layer);
    }
    catch(e){
        console.warn("OpenAIP layer error", e);
    }
}

// ================= EXPORT GLOBAL
window.initMap = initMap;
window.updateMapPosition = updateMapPosition;
window.setOpenAIPLayer = setOpenAIPLayer;
