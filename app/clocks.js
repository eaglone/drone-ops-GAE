function initClocks() {
    setInterval(() => {
        const now = new Date();
        document.getElementById("clockLocal").textContent = "🕒 Local: " + now.toLocaleTimeString();
        document.getElementById("clockUTC").textContent = "🌍 UTC: " + now.toISOString().substr(11, 8) + "Z";
    }, 1000);
}
