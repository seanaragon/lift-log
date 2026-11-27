// Lift Log offline worker. Only app files are cached here; workouts live in the page's own storage and are never touched.
const CACHE='liftlog-v2';
const CORE=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','apple-touch-icon.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET')return;
  // opening the app: get the newest version when online (4 s limit), otherwise the saved copy
  if(req.mode==='navigate'){
    e.respondWith((async()=>{
      const c=await caches.open(CACHE);
      try{
        const ctl=new AbortController(), t=setTimeout(()=>ctl.abort(),4000);
        const res=await fetch(req.url,{signal:ctl.signal,cache:'no-store',credentials:'same-origin'});
        clearTimeout(t);
        if(res&&res.ok){c.put('index.html',res.clone());return res;}
      }catch(err){}
      return (await c.match('index.html'))||(await c.match('./'))||new Response('Offline',{status:503,headers:{'Content-Type':'text/plain'}});
    })());
    return;
  }
  // icons and fonts: answer from the phone first, refresh in the background when online
  e.respondWith(caches.open(CACHE).then(async c=>{
    const key=req;
    const hit=await c.match(key);
    const net=fetch(req).then(res=>{if(res&&(res.ok||res.type==='opaque'))c.put(key,res.clone());return res;}).catch(()=>null);
    if(hit){e.waitUntil(net);return hit;}
    const res=await net; return res||new Response('Offline',{status:503,headers:{'Content-Type':'text/plain'}});
  }));
});
