/**
 * CLOCKS — Local + Zulu Time
 */

function updateClocks(){

    const now = new Date();

    // heure locale
    const local = now.toLocaleTimeString("fr-FR",{
        hour12:false
    });

    // heure UTC (Zulu aviation)
    const zulu = now.toISOString().substring(11,19);

    const localEl = document.getElementById("localTime");
    const zuluEl  = document.getElementById("zuluTime");

    if(localEl) localEl.textContent = local;
    if(zuluEl)  zuluEl.textContent  = zulu + "Z";
}

function initClocks(){
    console.log("🕒 clocks init");
    updateClocks();
    setInterval(updateClocks,1000);
}

window.initClocks = initClocks;
