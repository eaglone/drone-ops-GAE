const REFRESH_INTERVAL = 900;

document.addEventListener("DOMContentLoaded", () => {

    initClocks?.();
    initMeteo?.();
    initAutocomplete?.();

    const cachedLat = localStorage.getItem("last_lat");
    const cachedLon = localStorage.getItem("last_lon");

    window.latitude  = cachedLat ? parseFloat(cachedLat) : 48.78;
    window.longitude = cachedLon ? parseFloat(cachedLon) : 2.22;

    initMap();
    loadAllZones();

    updateRadar(window.latitude, window.longitude); // ⭐ radar

    startUpdateTimer(REFRESH_INTERVAL);
});

