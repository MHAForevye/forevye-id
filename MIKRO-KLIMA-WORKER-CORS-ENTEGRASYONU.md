# Mikro-Klima Worker — FOREVYE ID CORS düzeltmesi

## Tespit

- FOREVYE ID istemcisinin API adresi: `https://mikroklimakontrolmerkezi.forevye.workers.dev`.
- Market projesindeki `wrangler.toml` zaten `ID_ORIGIN = "https://mhaforevye.github.io"` değerini içeriyor. Bu değer, ekrandaki GitHub Pages origin'iyle eşleşiyor.
- `ID_ORIGIN` tek başına CORS uygulamaz. Worker'ın JavaScript fetch katmanı, `/identity/*` isteklerinde `OPTIONS` preflight yanıtını ve gerçek yanıtların tamamını CORS başlıklarıyla döndürmelidir.
- Gönderilen Market arşivindeki `wrangler.toml`, `main = "worker/index.js"` diyor; ancak arşivde `worker/index.js` yok. Bu yüzden yalnızca mevcut statik Market arşiviyle Identity Worker'ı yeniden deploy etmek mümkün değil.

## Bu paketteki sunucu modülünü bağlama

`worker/identity-cors.mjs` dosyasını Mikro-Klima Worker kaynak deposuna kopyala. Mevcut Identity rotalarını silme veya bu modülle değiştirme. Var olan route dispatcher'ını aşağıdaki gibi sar:

```js
import { withIdentityCors } from "./identity-cors.mjs";

export default {
  async fetch(request, env, ctx) {
    return withIdentityCors(request, env, async (corsRequest) => {
      // Burada mevcut Worker router/dispatcher çağrılmalı.
      // Örnek: return router.fetch(corsRequest, env, ctx);
      return existingFetch(corsRequest, env, ctx);
    });
  }
};
```

`existingFetch` bir örnek isimdir; mevcut Worker'daki gerçek yönlendirici fonksiyonla değiştir. Eğer mevcut dışa aktarılan `fetch` bir router ise, yalnızca o çağrıyı middleware callback'ine taşı.

## Beklenen davranış

- `OPTIONS /identity/login` → `204` ve `Access-Control-Allow-Origin: https://mhaforevye.github.io`.
- İzin verilen yöntemler: `GET, POST, PATCH, PUT, DELETE, OPTIONS`.
- İzin verilen başlıklar: `Authorization, Content-Type, Accept`.
- Başarılı, `401`, `403` ve `500` dahil tüm `/identity/*` yanıtlarında doğru `Access-Control-Allow-Origin` bulunur.
- Farklı origin'ler `403` alır; rastgele origin yansıtılmaz.
- Aynı Worker'daki `/api/*` Market rotaları bu middleware tarafından değiştirilmez.

## Kontrol

1. `ID_ORIGIN` Cloudflare Worker Variables'ta `https://mhaforevye.github.io` olmalı.
2. Worker'ı gerçek kaynak deposundan deploy et.
3. Tarayıcıda FOREVYE ID üstündeki **Bağlantıyı sına** düğmesine bas. `/identity/profile` için HTTP `401` dönmesi bağlantının ve CORS'un çalıştığını gösterir; giriş yapılmadığı için bu beklenen yanıttır.
4. Giriş isteği başarısız olursa DevTools → Network'te `OPTIONS /identity/login` ve hemen ardından `POST /identity/login` isteklerini kontrol et.

> Bu paket CORS middleware modülünü ve istemci tanılamasını içerir. Worker'ın asıl kimlik doğrulama rotaları, D1 şeması ve deploy dosyası gönderilen arşivde bulunmadığından canlı Worker bu paketten tek başına yayınlanamaz.
