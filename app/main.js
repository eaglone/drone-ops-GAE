/**
 * MAIN.JS — Drone OPS Controller
 * Version optimisée production
 */
// navigator.serviceWorker.register("sw.js")

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

async function initApp(){ // Ajout de async ici
    console.log("🚀 Drone OPS INIT");

    initPosition();
    initModules();
    
    // On attend l'initialisation de la carte qui gère maintenant les couches
    await initMapSafe();

    updateAllSystems();
    startUpdateTimer(REFRESH_INTERVAL);
}

// ================================
// POSITION INITIALE
// ================================
function initPosition(){
    const cachedLat = localStorage.getItem("last_lat");
    const cachedLon = localStorage.getItem("last_lon");

    window.latitude  = cachedLat ? parseFloat(cachedLat) : DEFAULT_LAT;
    window.longitude = cachedLon ? parseFloat(cachedLon) : DEFAULT_LON;

    if(!cachedLat){
        const input = document.getElementById("addressInput");
        if(input) input.value = "Vélizy-Villacoublay (78140)";
    }
}

// ================================
// INIT MODULES
// ================================
function initModules(){

    // laisse le DOM finir de charger tous les scripts
    setTimeout(()=>{

        safeCall("initClocks");
        safeCall("initAutocomplete");
        safeCall("initMeteo");
        safeCall("generateSoraChecklist");
        safeCall("loadNotam");

    },100);
}


// ================================
// INIT MAP SAFE
// ================================
async function initMapSafe(){ // Devenu async
    if(typeof window.initMap === "function"){
        await window.initMap(); // On attend que la map charge les couches (DGAC incluse)
    } else {
        console.warn("Map non chargée");
    }
}

// ================================
// UPDATE GLOBAL SYSTEMS
// ================================
window.updateAllMaps = updateAllSystems;

function updateAllSystems(){
    const lat = window.latitude;
    const lon = window.longitude;

    if(!lat || !lon) return;

    console.log("📍 Update position:", lat, lon);

    localStorage.setItem("last_lat", lat);
    localStorage.setItem("last_lon", lon);

    if(typeof window.updateMapPosition === "function"){
        window.updateMapPosition(lat, lon);
    }

    if(typeof window.updateRadar === "function"){
        window.updateRadar(lat, lon);
    }

    if(typeof window.loadMeteo === "function"){
        window.loadMeteo();
    }

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

    if(window.syncInterval) clearInterval(window.syncInterval);

    window.syncInterval = setInterval(()=>{
        timeLeft--;
        const m = Math.floor(timeLeft/60);
        const s = timeLeft % 60;

        if(label) label.textContent = `${m}:${s<10?"0":""}${s}`;

        if(bar){
            bar.style.width = (timeLeft/duration)*100 + "%";
            bar.style.backgroundColor = timeLeft < 60 ? "#ef4444" : "#38bdf8";
        }

        if(timeLeft <= 0){
            timeLeft = duration;
            updateAllSystems();
        }
    }, 1000);
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

// ================================
// SERVICE WORKER (désactivé temporairement)
// ================================

// if ("serviceWorker" in navigator) {
//     navigator.serviceWorker.register("sw.js")
//         .then(() => console.log("Service Worker: Registered"))
//         .catch(err => console.error("Service Worker: Error", err));
// }
