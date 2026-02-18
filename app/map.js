/**
 * MAP.JS — Drone OPS Tactical Map
 * VERSION PRO STABLE — PRODUCTION READY
 *
 * ORDRE COUCHES :
 * 1. OSM (fond)
 * 2. OACI IGN
 * 3. DGAC officiel IGN
 * 4. DGAC vecteur cliquable (option)
 * 5. Radar météo animé
 * 6. OpenAIP (top)
 */

let map = null;
let positionMarker = null;

let osmLayer = null;
let oaciLayer = null;

let rainRadarLayer = null;
let radarFrames = [];
let radarIndex = 0;
let radarTimer = null;


// =====================================================
// RADAR PLUIE ANIMÉ PRO
// =====================================================
// Remplace ton ancienne fonction initRainRadar
async function initRainRadar() {
    console.log("🛰️ Utilisation du Radar Officiel Météo-France (Data.gouv)");

    // URL stable issue de ta capture d'écran
    const radarImageUrl = "https://www.data.gouv.fr/api/1/datasets/r/87668014-3d50-4074-9ba3-c4ef92882bd7";

    // Définition des bornes géographiques de la mosaïque France
    // (A ajuster selon le fichier de métadonnées du package)
    const imageBounds = [[51.5, -5.5], [41.0, 10.0]]; 

    if (rainRadarLayer) {
        map.removeLayer(rainRadarLayer);
    }

    // On utilise ImageOverlay car Météo-France fournit souvent des images entières (mosaïques)
    rainRadarLayer = L.imageOverlay(radarImageUrl, imageBounds, {
        opacity: 0.6,
        pane: "weatherPane",
        interactive: false,
        attribution: "© Météo-France via Data.gouv"
    });

    return rainRadarLayer;
}

// Pour l'animation, Météo-France étant une image fixe mise à jour,
// on se contente de recharger l'image toutes les 5 min avec un timestamp pour éviter le cache.
setInterval(() => {
    if (rainRadarLayer) {
        const newUrl = "https://www.data.gouv.fr/api/1/datasets/r/87668014-3d50-4074-9ba3-c4ef92882bd7?t=" + Date.now();
        rainRadarLayer.setUrl(newUrl);
        console.log("🔄 Radar Météo-France actualisé");
    }
}, 300000); // 5 minutes
// =====================================================
// INIT MAP
// =====================================================

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


    // ================= PANES (ordre rendu)

    map.createPane("zonesPane");
    map.getPane("zonesPane").style.zIndex = 650;

    map.createPane("weatherPane");
    map.getPane("weatherPane").style.zIndex = 675;

    map.createPane("airspacePane");
    map.getPane("airspacePane").style.zIndex = 700;


    // ================= OSM BASE

    osmLayer = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom:19,
            attribution:"© OpenStreetMap"
        }
    ).addTo(map);


    // ================= OACI IGN

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


    // ================= DGAC IGN OFFICIEL

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


    // ================= OPENAIP

    window.openAipLayer = L.layerGroup([],{
        pane:"airspacePane"
    }).addTo(map);


    // ================= DGAC VECTEUR (optionnel)

    let dgacLayer = null;

    if(typeof window.loadDGACZones === "function"){
        try{
            dgacLayer = await window.loadDGACZones();
            console.log("✅ DGAC vecteur prêt");
        }catch(e){
            console.warn("DGAC erreur", e);
        }
    }


    // ================= RADAR METEO

    const radarLayer = await initRainRadar();


    // ================= CONTROLE COUCHES

    const baseMaps = {
        "Fond OSM": osmLayer
    };

    const overlays = {
        "Carte OACI IGN": oaciLayer,
        "Restrictions drones IGN": dgacIgnLayer,
        "Espaces aériens OpenAIP": window.openAipLayer
    };

    if(radarLayer){
        overlays["Radar pluie animé"] = radarLayer;
    }

    if(dgacLayer){
        overlays["DGAC Zones cliquables"] = dgacLayer;
    }

    L.control.layers(baseMaps, overlays, {
        collapsed:false
    }).addTo(map);


    // ================= AUTO REFRESH RADAR (5 min)

    setInterval(async ()=>{
        console.log("🔄 refresh radar");
        radarFrames = [];
        radarIndex = 0;
        await initRainRadar();
    }, 300000);


    // ================= INIT OPENAIP

    setTimeout(()=>{
        if(typeof initOpenAIPAutoUpdate === "function"){
            initOpenAIPAutoUpdate();
        }
    },500);

    console.log("✅ MAP READY");
}


// =====================================================
// UPDATE POSITION
// =====================================================

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


// =====================================================
// OPENAIP SUPPORT
// =====================================================

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


// =====================================================
// EXPORT GLOBAL
// =====================================================

window.initMap = initMap;
window.updateMapPosition = updateMapPosition;
window.setOpenAIPLayer = setOpenAIPLayer;
