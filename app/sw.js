self.addEventListener("fetch", e => {

    if(e.request.url.includes("tile.openstreetmap")){
        e.respondWith(
            caches.open("tiles").then(cache =>
                cache.match(e.request).then(res =>
                    res || fetch(e.request).then(r=>{
                        cache.put(e.request,r.clone());
                        return r;
                    })
                )
            )
        );
    }
});
