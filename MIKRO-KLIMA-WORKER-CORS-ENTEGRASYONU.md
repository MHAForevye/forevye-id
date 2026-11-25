# Mikro-Klima Worker — FOREVYE ID CORS (güncel durum)

## Özet
FOREVYE ID (`https://mhaforevye.github.io/forevye-id/`) ile Identity Worker'ı (`https://mikroklimakontrolmerkezi.forevye.workers.dev`)
**iki ayrı GitHub hesabı / iki ayrı Cloudflare hesabı** üzerinde çalışır. CORS izni artık Cloudflare değişkenlerine bağlı değildir:

- Mikro-Klima deposunda `worker/origins.js` → `PINNED_ORIGINS` iki GitHub origin'ini koda gömer:
  `https://mhaforevye.github.io` ve `https://frovyes.github.io`.
- `worker/index.js` bu adresleri `/identity/*` için **her zaman** izinli sayar (başarılı ve hata yanıtları dahil, `OPTIONS` → `204`).
  `ID_ORIGIN` / `MARKET_ORIGIN` / `ZP_ORIGIN` yalnızca **ek** adres ekler; silinse ya da yanlış olsa bile ID çalışır.
- Listede olmayan origin `403` alır; joker ve alt alan adı eşleşmesi yoktur.
- Ayrıntı, yeni site ekleme ve doğrulama: Mikro-Klima deposundaki `HESAPLAR-VE-ADRESLER.md`.

## Bu depodaki `worker/identity-cors.mjs`
Eski/yedek modüldür; **Worker'a eklemeyin** (Mikro-Klima Worker'ı CORS'u kendi içinde çözer, ikinci katman çakışabilir).

## Kontrol
1. Mikro-Klima deposunda `npm run deploy` (sonunda canlı doğrulama otomatik çalışır) ya da elle `npm run verify:live`.
2. `wrangler.toml` içindeki `account_id` doluysa deploy her zaman doğru Cloudflare hesabına gider.
3. FOREVYE ID'de gerçek bir giriş/kayıt dene; DevTools → Network'te `/identity/*` yanıtında `access-control-allow-origin` görünmeli.
4. Bankadan giriş için `sanal-banka` izin ekranını aç; izin sonrası banka callback'ine dönüldüğünü doğrula.
