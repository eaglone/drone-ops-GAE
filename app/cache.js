/**
 * CACHE.JS — Smart API cache
 */

const CACHE_DURATION = 10 * 60 * 1000; // 10 min

async function cachedFetch(key, url, options={}){

    const cached = localStorage.getItem(key);

    if(cached){
        const data = JSON.parse(cached);
        if(Date.now() - data.time < CACHE_DURATION){
            return data.value;
        }
    }

    const res = await fetch(url, options);
    const json = await res.json();

    localStorage.setItem(key, JSON.stringify({
        time:Date.now(),
        value:json
    }));

    return json;
}

window.cachedFetch = cachedFetch;

