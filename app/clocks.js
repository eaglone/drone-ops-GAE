/**
 * CLOCKS.JS — Horloges Local + UTC
 * Version robuste production
 */

let clockInterval;


// ================= INIT CLOCKS =================

function initClocks(){

    const localEl = document.getElementById("localTime");
    const utcEl   = document.getElementById("utcTime");

    if(!localEl && !utcEl){
        console.warn("Clock elements introuvables");
        return;
    }

    updateClocks();

    if(clockInterval) clearInterval(clockInterval);

    clockInterval = setInterval(updateClocks, 1000);

    console.log("🕒 Clocks init OK");
}


// ================= UPDATE =================

function updateClocks(){

    const now = new Date();

    const local = now.toLocaleTimeString("fr-FR", {
        hour12:false
    });

    const utc =
        now.getUTCHours().toString().padStart(2,"0") + ":" +
        now.getUTCMinutes().toString().padStart(2,"0") + ":" +
        now.getUTCSeconds().toString().padStart(2,"0") + "Z";

    const localEl = document.getElementById("localTime");
    const utcEl   = document.getElementById("utcTime");

    if(localEl) localEl.textContent = local;
    if(utcEl)   utcEl.textContent   = utc;
}


// ================= EXPORT =================

window.initClocks = initClocks;
