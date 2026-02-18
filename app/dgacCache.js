const DB_NAME = "dgacCacheDB";
const STORE = "zones";

function openDB() {
    return new Promise((resolve, reject) => {

        const req = indexedDB.open(DB_NAME, 1);

        req.onupgradeneeded = e => {
            e.target.result.createObjectStore(STORE);
        };

        req.onsuccess = e => resolve(e.target.result);
        req.onerror = reject;
    });
}

export async function saveDGAC(data) {
    const db = await openDB();

    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({
        timestamp: Date.now(),
        data
    }, "dgac");
}

export async function loadDGAC() {
    const db = await openDB();

    return new Promise(resolve => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get("dgac");

        req.onsuccess = () => {
            const result = req.result;

            if (!result) return resolve(null);

            // cache 24h
            if (Date.now() - result.timestamp > 86400000)
                return resolve(null);

            resolve(result.data);
        };
    });
}
