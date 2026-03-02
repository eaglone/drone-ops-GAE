/**
 * MAP.JS — Drone OPS Tactical Map
 * VERSION GIE PRO — PRODUCTION READY
 *
 * RADAR ARCHITECTURE :
 *   PRIMARY  → Météo-France Package Radar v1 (mosaïque, 5 min, France officielle)
 *   FALLBACK → RainViewer (monde, animé, nowcast)
 *
 * ORDRE COUCHES :
 *   1. OSM (fond)
 *   2. OACI IGN
 *   3. DGAC officiel IGN
 *   4. DGAC vecteur cliquable (option)
 *   5. Radar météo (MF primaire ou RainViewer fallback)
 *   6. OpenAIP (top)
 */

// =====================================================
// CONFIGURATION GLOBALE — À ADAPTER
// =====================================================

const GIE_CONFIG = {

    // ⭐ MÉTÉO-FRANCE — collez votre nouveau token ici (JAMAIS dans un chat)
    MF_TOKEN: "VOTRE_NOUVEAU_TOKEN_ICI",

    // Endpoint Package Radar Météo-France
    MF_BASE_URL: "https://public-api.meteofrance.fr/public/DPPaquetRadar/v1",

    // Intervalle d'animation entre frames (ms)
    ANIMATION_INTERVAL: 1500,

    // Intervalle de rafraîchissement des données (ms) — 5 min
    REFRESH_INTERVAL: 300_000,

    // Opacité radar sur la carte
    RADAR_OPACITY: 0.72,

    // Nombre de frames historiques à conserver pour animation (RainViewer)
    RV_FRAMES_PAST: 12,
    RV_FRAMES_FUTURE: 4,

    // Nombre de tentatives retry avant fallback
    MAX_RETRY: 3,
};

// =====================================================
// ÉTAT GLOBAL
// =====================================================

let map = null;
let positionMarker = null;
let osmLayer = null;
let oaciLayer = null;

const radarState = {
    source: null,        // "meteofrance" | "rainviewer" | null
    layer: null,
    frames: [],          // pour RainViewer
    mfImages: [],        // pour MF : [{time, blob_url}]
    index: 0,
    timer: null,
    isPlaying: true,
    retryCount: 0,
};

// =====================================================
// MÉTÉO-FRANCE — PACKAGE RADAR MOSAÏQUE
// =====================================================

/**
 * Récupère le paquet mosaïque radar MF (dernier 1/4h, freq 5 min)
 * Retourne un tableau de {time: Date, url: string} prêts à afficher
 */
async function fetchMFRadarMosaique() {

    const url = `${GIE_CONFIG.MF_BASE_URL}/mosaique/paquet`;

    const res = await fetch(url, {
        headers: {
            "Authorization": `Bearer ${GIE_CONFIG.MF_TOKEN}`,
            "Accept": "application/json"
        },
        cache: "no-cache"
    });

    if (!res.ok) {
        throw new Error(`MF API ${res.status} — ${res.statusText}`);
    }

    const data = await res.json();

    // L'API retourne une liste de fichiers avec timestamps
    // Format attendu : [{validity_time, url} | {echeance, lien}]
    // On normalise quelle que soit la structure
    const items = Array.isArray(data) ? data : (data.items || data.files || []);

    if (!items.length) throw new Error("MF: paquet vide");

    // Tri chronologique
    items.sort((a, b) => {
        const ta = a.validity_time || a.echeance || "";
        const tb = b.validity_time || b.echeance || "";
        return ta.localeCompare(tb);
    });

    // Conversion en objets normalisés
    return items.map(item => ({
        time: new Date(item.validity_time || item.echeance || Date.now()),
        url: item.url || item.lien || item.href,
        type: "meteofrance"
    }));
}

/**
 * Initialise le radar Météo-France sur la carte.
 * Retourne true si succès, false si fallback nécessaire.
 */
async function initMFRadar() {

    if (!GIE_CONFIG.MF_TOKEN || GIE_CONFIG.MF_TOKEN === "VOTRE_NOUVEAU_TOKEN_ICI") {
        console.warn("⚠️ Token MF non configuré → fallback RainViewer");
        return false;
    }

    try {
        console.log("🇫🇷 Init Radar Météo-France Package Mosaïque");

        const frames = await fetchMFRadarMosaique();
        radarState.mfImages = frames;
        radarState.source = "meteofrance";
        radarState.index = 0;

        // Crée une couche image (WMS-like) ou overlay selon format reçu
        // Si l'URL pointe vers une image PNG géoréférencée :
        // On utilise L.imageOverlay avec les bounds France métropole
        const FRANCE_BOUNDS = [[41.0, -5.5], [51.5, 10.0]];

        if (!radarState.layer) {
            radarState.layer = L.imageOverlay(
                frames[0].url,
                FRANCE_BOUNDS,
                {
                    pane: "weatherPane",
                    opacity: GIE_CONFIG.RADAR_OPACITY,
                    interactive: false,
                    attribution: "© Météo-France — Radar mosaïque officiel"
                }
            );
        } else {
            radarState.layer.setUrl(frames[0].url);
        }

        startRadarAnimation();
        updateRadarPanel();

        console.log(`✅ MF Radar prêt — ${frames.length} frames`);
        return true;

    } catch (e) {
        console.warn("❌ MF Radar échoué :", e.message);
        return false;
    }
}

// =====================================================
// RAINVIEWER — FALLBACK MONDIAL
// =====================================================

function buildRVUrl(path) {
    // 512px / Titan color (6) / Smooth / Snow
    return `https://tilecache.rainviewer.com${path}/512/{z}/{x}/{y}/6/1_1.png`;
}

async function fetchRVFrames() {

    const res = await fetch("https://api.rainviewer.com/public/weather-maps.json", {
        cache: "no-cache"
    });

    if (!res.ok) throw new Error(`RainViewer API ${res.status}`);

    const data = await res.json();

    const past = (data?.radar?.past || [])
        .slice(-GIE_CONFIG.RV_FRAMES_PAST)
        .map(f => ({ ...f, type: "past" }));

    const future = (data?.radar?.nowcast || [])
        .slice(0, GIE_CONFIG.RV_FRAMES_FUTURE)
        .map(f => ({ ...f, type: "nowcast" }));

    return [...past, ...future];
}

async function initRainViewer() {

    console.log("🌧️ Init RainViewer (fallback)");

    const frames = await fetchRVFrames();
    if (!frames.length) throw new Error("RainViewer: aucune frame");

    radarState.frames = frames;
    radarState.source = "rainviewer";
    radarState.index = 0;

    if (!radarState.layer) {
        radarState.layer = L.tileLayer(
            buildRVUrl(frames[0].path),
            {
                pane: "weatherPane",
                opacity: GIE_CONFIG.RADAR_OPACITY,
                maxNativeZoom: 10,
                maxZoom: 18,
                keepBuffer: 8,
                updateWhenIdle: true,
                updateWhenZooming: false,
                updateInterval: 200,
                detectRetina: true,
                crossOrigin: true,
                attribution: "© RainViewer (fallback)"
            }
        );
    }

    startRadarAnimation();
    updateRadarPanel();

    console.log(`✅ RainViewer prêt — ${frames.length} frames`);
}

// =====================================================
// ANIMATION RADAR (commune MF + RainViewer)
// =====================================================

function startRadarAnimation() {

    if (radarState.timer) clearInterval(radarState.timer);

    radarState.timer = setInterval(() => {
        if (!radarState.layer) return;
        stepRadar(1);
    }, GIE_CONFIG.ANIMATION_INTERVAL);

    radarState.isPlaying = true;
}

function stopRadarAnimation() {
    if (radarState.timer) {
        clearInterval(radarState.timer);
        radarState.timer = null;
    }
    radarState.isPlaying = false;
}

function stepRadar(direction = 1) {

    const { source, layer } = radarState;
    if (!layer) return;

    if (source === "meteofrance") {

        const frames = radarState.mfImages;
        if (!frames.length) return;

        radarState.index = (radarState.index + direction + frames.length) % frames.length;

        layer.setOpacity(0);
        setTimeout(() => {
            layer.setUrl(frames[radarState.index].url);
            setTimeout(() => {
                layer.setOpacity(GIE_CONFIG.RADAR_OPACITY);
                updateRadarPanel();
            }, 120);
        }, 120);

    } else if (source === "rainviewer") {

        const frames = radarState.frames;
        if (!frames.length) return;

        radarState.index = (radarState.index + direction + frames.length) % frames.length;
        const frame = frames[radarState.index];

        layer.setOpacity(0);
        setTimeout(() => {
            layer.setUrl(buildRVUrl(frame.path));
            setTimeout(() => {
                layer.setOpacity(
                    frame.type === "nowcast"
                        ? GIE_CONFIG.RADAR_OPACITY * 0.8
                        : GIE_CONFIG.RADAR_OPACITY
                );
                updateRadarPanel();
            }, 120);
        }, 120);
    }
}

// =====================================================
// INIT RADAR — PRIMAIRE MF → FALLBACK RV
// =====================================================

async function initRadar() {

    try {
        const mfOk = await initMFRadar();
        if (!mfOk) {
            await initRainViewer();
        }
    } catch (e) {
        console.warn("MF échoué, tentative RainViewer :", e);
        try {
            await initRainViewer();
        } catch (e2) {
            console.error("❌ Aucun radar disponible :", e2);
        }
    }

    return radarState.layer;
}

// =====================================================
// AUTO-REFRESH (5 min)
// =====================================================

function startRadarAutoRefresh() {

    setInterval(async () => {
        console.log(`🔄 Refresh radar [${radarState.source}]`);

        try {
            if (radarState.source === "meteofrance") {

                const frames = await fetchMFRadarMosaique();
                if (frames.length) {
                    radarState.mfImages = frames;
                    console.log(`✅ MF: ${frames.length} frames rafraîchies`);
                }

            } else if (radarState.source === "rainviewer") {

                const frames = await fetchRVFrames();
                if (frames.length) {
                    radarState.frames = frames;
                    radarState.index = 0;
                    console.log(`✅ RV: ${frames.length} frames rafraîchies`);
                }
            }

            updateRadarPanel();

        } catch (e) {
            console.warn("⚠️ Refresh radar échoué :", e);
        }

    }, GIE_CONFIG.REFRESH_INTERVAL);
}

// =====================================================
// PANNEAU DE CONTRÔLE RADAR — UI TACTIQUE GIE
// =====================================================

function getRadarFrameInfo() {

    const { source, index, mfImages, frames, isPlaying } = radarState;

    if (source === "meteofrance" && mfImages.length) {
        const frame = mfImages[index];
        return {
            time: frame?.time?.toUTCString?.()?.slice(5, 22) + " UTC" || "--:-- UTC",
            type: "OFFICIEL MF",
            typeColor: "#22c55e",
            source: "Météo-France",
            isPlaying,
            total: mfImages.length,
            current: index + 1,
        };
    }

    if (source === "rainviewer" && frames.length) {
        const frame = frames[index];
        const isNowcast = frame?.type === "nowcast";
        return {
            time: frame?.time
                ? new Date(frame.time * 1000).toUTCString().slice(5, 22) + " UTC"
                : "--:-- UTC",
            type: isNowcast ? "▶ NOWCAST" : "◀ HISTORIQUE",
            typeColor: isNowcast ? "#f59e0b" : "#38bdf8",
            source: "RainViewer (fallback)",
            isPlaying,
            total: frames.length,
            current: index + 1,
        };
    }

    return { time: "--:-- UTC", type: "CHARGEMENT…", typeColor: "#64748b", source: "—", isPlaying: false, total: 0, current: 0 };
}

function createRadarPanel() {

    const panel = document.createElement("div");
    panel.id = "gie-radar-panel";

    Object.assign(panel.style, {
        position: "fixed",
        bottom: "24px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "linear-gradient(135deg, rgba(8,14,26,0.96) 0%, rgba(12,22,40,0.96) 100%)",
        border: "1px solid rgba(56,189,248,0.25)",
        borderRadius: "10px",
        padding: "10px 18px",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        zIndex: "9999",
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        fontSize: "11px",
        color: "#e2e8f0",
        backdropFilter: "blur(12px)",
        boxShadow: "0 4px 32px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
        userSelect: "none",
        whiteSpace: "nowrap",
    });

    const btn = (id, label, title, primary = false) => `
        <button id="${id}" title="${title}" style="
            background: ${primary ? "rgba(56,189,248,0.12)" : "transparent"};
            border: 1px solid rgba(56,189,248,0.2);
            color: #38bdf8;
            border-radius: 5px;
            padding: 4px 10px;
            cursor: pointer;
            font-family: inherit;
            font-size: 13px;
            transition: background 0.15s, border-color 0.15s;
        " onmouseover="this.style.background='rgba(56,189,248,0.22)'"
           onmouseout="this.style.background='${primary ? "rgba(56,189,248,0.12)" : "transparent"}'"
        >${label}</button>
    `;

    panel.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:2px; min-width:120px;">
            <span id="gie-radar-source" style="font-size:9px; color:#64748b; letter-spacing:1px; text-transform:uppercase;">—</span>
            <span id="gie-radar-type" style="font-weight:700; letter-spacing:1px; font-size:10px;">CHARGEMENT…</span>
        </div>
        <div style="width:1px; height:32px; background:rgba(56,189,248,0.15);"></div>
        ${btn("gie-prev", "◀", "Frame précédente")}
        ${btn("gie-play", "⏸", "Play / Pause", true)}
        ${btn("gie-next", "▶", "Frame suivante")}
        <div style="width:1px; height:32px; background:rgba(56,189,248,0.15);"></div>
        <div style="display:flex; flex-direction:column; gap:2px; align-items:flex-end;">
            <span id="gie-radar-timestamp" style="color:#94a3b8; letter-spacing:0.5px;">--:-- UTC</span>
            <span id="gie-radar-progress" style="font-size:9px; color:#475569;">— / —</span>
        </div>
    `;

    // Événements
    panel.querySelector("#gie-prev").onclick = () => {
        stopRadarAnimation();
        stepRadar(-1);
        panel.querySelector("#gie-play").textContent = "▶";
    };

    panel.querySelector("#gie-next").onclick = () => {
        stopRadarAnimation();
        stepRadar(1);
        panel.querySelector("#gie-play").textContent = "▶";
    };

    panel.querySelector("#gie-play").onclick = () => {
        if (radarState.isPlaying) {
            stopRadarAnimation();
            panel.querySelector("#gie-play").textContent = "▶";
        } else {
            startRadarAnimation();
            panel.querySelector("#gie-play").textContent = "⏸";
        }
    };

    document.body.appendChild(panel);
    return panel;
}

function updateRadarPanel() {

    let panel = document.getElementById("gie-radar-panel");
    if (!panel) panel = createRadarPanel();

    const info = getRadarFrameInfo();

    const typeEl = panel.querySelector("#gie-radar-type");
    const srcEl = panel.querySelector("#gie-radar-source");
    const tsEl = panel.querySelector("#gie-radar-timestamp");
    const progEl = panel.querySelector("#gie-radar-progress");
    const playBtn = panel.querySelector("#gie-play");

    if (typeEl) { typeEl.textContent = info.type; typeEl.style.color = info.typeColor; }
    if (srcEl) srcEl.textContent = info.source;
    if (tsEl) tsEl.textContent = info.time;
    if (progEl) progEl.textContent = info.total ? `${info.current} / ${info.total}` : "— / —";
    if (playBtn) playBtn.textContent = info.isPlaying ? "⏸" : "▶";
}

// =====================================================
// INIT MAP
// =====================================================

async function initMap() {

    if (!document.getElementById("map")) return;
    if (map) return;

    console.log("🗺️ Initialisation carte GIE Drone OPS");

    map = L.map("map", {
        zoomControl: true,
        preferCanvas: true
    }).setView([
        window.latitude || 48.783057,
        window.longitude || 2.213649
    ], 10);

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
            maxZoom: 19,
            attribution: "© OpenStreetMap"
        }
    ).addTo(map);

    // ================= OACI IGN

    oaciLayer = L.tileLayer(
        "https://data.geopf.fr/private/wmts?" +
        "SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
        "&LAYER=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-OACI" +
        "&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/jpeg" +
        "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}" +
        "&apikey=8Y5CE2vg2zJMePOhqeHYhXx4fmI3uzpz",
        {
            opacity: 0.7,
            maxZoom: 18,
            attribution: "© IGN — Carte OACI"
        }
    ).addTo(map);

    // ================= DGAC IGN OFFICIEL

    const dgacIgnLayer = L.tileLayer(
        "https://data.geopf.fr/wmts?" +
        "SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0" +
        "&LAYER=TRANSPORTS.DRONES.RESTRICTIONS" +
        "&STYLE=normal&TILEMATRIXSET=PM&FORMAT=image/png" +
        "&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}",
        {
            opacity: 0.75,
            attribution: "© IGN — Restrictions drones"
        }
    );

    // ================= OPENAIP

    window.openAipLayer = L.layerGroup([], {
        pane: "airspacePane"
    }).addTo(map);

    // ================= DGAC VECTEUR (optionnel)

    let dgacLayer = null;
    if (typeof window.loadDGACZones === "function") {
        try {
            dgacLayer = await window.loadDGACZones();
            console.log("✅ DGAC vecteur prêt");
        } catch (e) {
            console.warn("DGAC erreur", e);
        }
    }

    // ================= RADAR (MF primaire → RainViewer fallback)

    const radarLayer = await initRadar();
    if (radarLayer) radarLayer.addTo(map);

    // ================= CONTRÔLE COUCHES

    const baseMaps = {
        "Fond OSM": osmLayer
    };

    const overlays = {
        "Carte OACI IGN": oaciLayer,
        "Restrictions drones IGN": dgacIgnLayer,
        "Espaces aériens OpenAIP": window.openAipLayer,
    };

    if (radarLayer) {
        const label = radarState.source === "meteofrance"
            ? "Radar Météo-France officiel"
            : "Radar pluie animé (RainViewer)";
        overlays[label] = radarLayer;
    }

    if (dgacLayer) {
        overlays["DGAC Zones cliquables"] = dgacLayer;
    }

    L.control.layers(baseMaps, overlays, {
        collapsed: false
    }).addTo(map);

    // ================= AUTO-REFRESH

    startRadarAutoRefresh();

    // ================= OPENAIP AUTO UPDATE

    setTimeout(() => {
        if (typeof initOpenAIPAutoUpdate === "function") {
            initOpenAIPAutoUpdate();
        }
    }, 500);

    console.log(`✅ MAP READY — radar source: ${radarState.source || "aucun"}`);
}

// =====================================================
// UPDATE POSITION
// =====================================================

function updateMapPosition(lat, lon) {

    if (!map || !lat || !lon) return;

    map.flyTo([lat, lon], 11, { duration: 0.6 });

    if (positionMarker) {
        map.removeLayer(positionMarker);
    }

    positionMarker = L.circle([lat, lon], {
        radius: 500,
        color: "#38bdf8",
        weight: 2,
        fillOpacity: 0.15
    }).addTo(map);

    if (typeof loadOpenAIPAirspaces === "function") {
        loadOpenAIPAirspaces(lat, lon);
    }
}

// =====================================================
// OPENAIP SUPPORT
// =====================================================

function setOpenAIPLayer(layer) {

    if (!window.openAipLayer) return;

    try {
        window.openAipLayer.clearLayers();
        if (layer) window.openAipLayer.addLayer(layer);
    } catch (e) {
        console.warn("OpenAIP layer error", e);
    }
}

// =====================================================
// EXPORT GLOBAL
// =====================================================

window.initMap = initMap;
window.updateMapPosition = updateMapPosition;
window.setOpenAIPLayer = setOpenAIPLayer;
window.radarState = radarState;   // debug console
window.GIE_CONFIG = GIE_CONFIG;   // accès config runtime
