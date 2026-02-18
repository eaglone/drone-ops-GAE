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

// Dans map.js

async function initRainRadar() {
    console.log("🌧️ Init New Radar via WMS");

    // On crée une couche WMS (plus stable que l'animation de Rainviewer)
    rainRadarLayer = L.tileLayer.wms("https://mesonet.agron.iastate.edu/cgi-bin/wms/nexrad/n0q.cgi", {
        layers: 'nexrad-n0q-900913',
        format: 'image/png',
        transparent: true,
        opacity: 0.5,
        pane: "weatherPane",
        attribution: "NEXRAD via Iowa State Univ"
    });

    // NOTE : Pour la France spécifiquement, si tu veux éviter Rainviewer, 
    // l'alternative visuelle la plus fiable est souvent de rester sur Rainviewer 
    // MAIS d'utiliser Open-Meteo pour les données de la colonne de droite.
    
    return rainRadarLayer;
}
function startRadarAnimation(){

    if(radarTimer) clearInterval(radarTimer);

    radarTimer = setInterval(()=>{

        if(!radarFrames.length || !rainRadarLayer) return;

        radarIndex = (radarIndex + 1) % radarFrames.length;

        // transition plus douce
        rainRadarLayer.setOpacity(0.0);

        setTimeout(()=>{
            rainRadarLayer.setUrl(
                buildRadarURL(radarFrames[radarIndex].path)
            );
            rainRadarLayer.setOpacity(0.7);
        }, 150);

    }, 1500); // 1.5 sec = fluide pro
}



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
