/**
 * MAIN.JS — Drone OPS Controller
 * Version optimisée production
 */

const REFRESH_INTERVAL = 900; // 15 min


// ================================
// POSITION PAR DÉFAUT (BASE OPS 78140)
// ================================

const DEFAULT_LAT = 48.783057;
const DEFAULT_LON = 2.213649;


// ================================
// INIT GLOBAL
// ================================

document.addEventListener("DOMContentLoaded", initApp);


function initApp(){

    console.log("🚀 Drone OPS INIT");

    initPosition();
    initModules();
    initMapSafe();

    updateAllSystems();
    startUpdateTimer(REFRESH_INTERVAL);
}


// ================================
// POSITION INITIALE
// ================================

function initPosition(){

    const cachedLat = localStorage.getItem("last_lat");
    const cachedLon = localStorage.getItem("last_lon");

    // première connexion → base OPS 78140
    window.latitude  = cachedLat ? parseFloat(cachedLat) : DEFAULT_LAT;
    window.longitude = cachedLon ? parseFloat(cachedLon) : DEFAULT_LON;

    // afficher adresse par défaut si première visite
    if(!cachedLat){
        const input = document.getElementById("addressInput");
        if(input) input.value = "Vélizy-Villacoublay (78140)";
    }
}


// ================================
// INIT MODULES
// ================================

function initModules(){
    safeCall("initClocks");
    safeCall("initAutocomplete");
    safeCall("initMeteo");
    safeCall("generateSoraChecklist");
    
    // Ajout des nouveaux modules
    safeCall("loadDGACZones");
    safeCall("loadNotam");
}


// ================================
// INIT MAP SAFE
// ================================

function initMapSafe(){

    if(typeof window.initMap === "function"){
        window.initMap();
    }else{
        console.warn("Map non chargée");
    }
}


// ================================
// UPDATE GLOBAL SYSTEMS
// ================================

window.updateAllMaps = updateAllSystems; // compat ancien code


function updateAllSystems(){

    const lat = window.latitude;
    const lon = window.longitude;

    if(!lat || !lon) return;

    console.log("📍 Update position:", lat, lon);

    // cache position
    localStorage.setItem("last_lat", lat);
    localStorage.setItem("last_lon", lon);

    // update carte
    if(typeof window.updateMapPosition === "function"){
        window.updateMapPosition(lat, lon);
    }

    // radar pluie
    if(typeof window.updateRadar === "function"){
        window.updateRadar(lat, lon);
    }

    // météo
    if(typeof window.loadMeteo === "function"){
        window.loadMeteo();
    }

    // checklist SORA
    if(typeof window.generateSoraChecklist === "function"){
        window.generateSoraChecklist();
    }
}


// ================================
// TIMER REFRESH GLOBAL
// ================================

function startUpdateTimer(duration){

    let timeLeft = duration;

    const bar   = document.getElementById("updateProgressBar");
    const label = document.getElementById("updateTimerLabel");

    if(window.syncInterval){
        clearInterval(window.syncInterval);
    }

    window.syncInterval = setInterval(()=>{

        timeLeft--;

        const m = Math.floor(timeLeft/60);
        const s = timeLeft % 60;

        // label timer
        if(label){
            label.textContent = `${m}:${s<10?"0":""}${s}`;
        }

        // barre progression
        if(bar){
            bar.style.width = (timeLeft/duration)*100 + "%";
            bar.style.backgroundColor =
                timeLeft < 60 ? "#ef4444" : "#38bdf8";
        }

        // refresh complet
        if(timeLeft <= 0){
            timeLeft = duration;
            updateAllSystems();
        }

    },1000);
}


// ================================
// SAFE CALL UTILITAIRE
// ================================

function safeCall(fnName){

    if(typeof window[fnName] === "function"){
        try{
            window[fnName]();
        }catch(e){
            console.error("Erreur module:", fnName, e);
        }
    }
}
