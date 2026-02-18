/**
 * CLOCKS.JS — Local + Zulu Time
 */

function updateClocks(){

    const now = new Date();

    // ===== LOCAL =====
    const local = now.toLocaleTimeString("fr-FR",{
        hour12:false
    });

    // ===== ZULU / UTC =====
    const zulu = now.toISOString().substring(11,19);

    const localEl = document.getElementById("localTime");
    const zuluEl = document.getElementById("zuluTime");

    if(localEl) localEl.textContent = local;
    if(zuluEl) zuluEl.textContent = zulu;
}

function initClocks(){
    updateClocks();
    setInterval(updateClocks,1000);
}

window.initClocks = initClocks;
