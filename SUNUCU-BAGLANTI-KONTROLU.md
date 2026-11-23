# FOREVYE ID — Canlı sunucu bağlantı kontrolü

Bu ZIP'in içindeki `forevye-id-main` projesi statik web istemcisidir. Gerçek kimlik API'si `config.js` içindeki `API_BASE` adresinde çalışan Cloudflare Worker'dır. Bu arşivde Worker kaynak kodu, `wrangler.toml`, D1 migration/şeması veya Cloudflare hesabına erişim bulunmadığından canlı Worker'ı bu projeden deploy etmek mümkün değildir.

## 1. Ön yüzden kontrol

1. `config.js` içinde `MOCK: false` olmalı.
2. `API_BASE` değeri, FOREVYE ID uçlarını gerçekten sunan Worker'ın tam HTTPS adresi olmalı; sondaki `/` kullanılmamalı.
3. Siteyi HTTPS üzerinden açın.
4. Sayfanın üstündeki **Kimlik sunucusu** durumu Worker ana adresine istek yapar. `HTTP 404` bile alan adının cevap verdiğini gösterir; `/identity/*` API uçlarının doğru olduğu anlamına gelmez.
5. Giriş veya kayıt sırasında `NETWORK` görünüyorsa Worker URL'si, DNS ve CORS; `TIMEOUT` görünüyorsa Worker günlükleri ve bağlı hizmetler incelenmelidir.

## 2. Cloudflare Worker kontrolü

Cloudflare Dashboard → Workers & Pages bölümünde `API_BASE` ile aynı Worker'ın bulunduğunu ve en son dağıtımın başarılı olduğunu doğrulayın. Worker adı veya `workers.dev` alt alan adı değiştiyse `config.js` güncellenmelidir.

Worker'ın CORS yanıtı en azından şu kuralları uygulamalıdır:

- `Access-Control-Allow-Origin`: yayınlanan FOREVYE ID sitesinin tam origin'i. Origin, protokol + alan adı + varsa porttur; sayfa yolu içermez.
- `Access-Control-Allow-Methods`: `GET, POST, PATCH, DELETE, OPTIONS`
- `Access-Control-Allow-Headers`: `Authorization, Content-Type`
- `OPTIONS` preflight isteğine gerçek API mantığına girmeden başarılı yanıt.
- CORS başlıkları başarı ve hata yanıtlarının tamamında bulunmalı; varsa `Vary: Origin` kullanılmalı.

`Authorization` başlığı kullanıldığı için yalnızca normal GET yanıtına CORS eklemek yetmez; `OPTIONS` da doğru yanıtlanmalıdır. Üretimde `*` yerine yalnızca gerçekten kullanılan origin'leri allowlist'e ekleyin.

## 3. Identity Worker yapılandırması

Önceki proje notlarında Identity servisinin Mikro-Klima Worker'ında çalıştığı belirtilmişti. Bu Worker kaynak kodu bu teslimde yoktur; dolayısıyla aşağıdakiler o projenin/Cloudflare ayarlarının içinde doğrulanmalıdır:

- `ID_ORIGIN` / CORS izin listesi, FOREVYE ID'nin gerçek yayın origin'ini göstermeli.
- E-posta doğrulaması kullanılıyorsa `RESEND_API_KEY` ve `EMAIL_FROM` secret/variable değerleri geçerli olmalı.
- Worker'ın kullandığı D1 veritabanı binding'i doğru veritabanına bağlı olmalı ve Identity şeması uygulanmış olmalı.
- Worker loglarında `500` veya D1 tablo/kolon hataları bulunmamalı.

## 4. Nexus uygulamasıyla bağlantı

Nexus Banka Worker'ında `ID_URL` FOREVYE ID web arayüzünü, `ID_API_URL` ise aynı Identity API Worker adresini göstermelidir. Bu iki değer farklı görevler içindir. Nexus callback'i sunucudan sunucuya `/identity/token/exchange` çağrısı yapar; tarayıcı CORS ayarı bu server-to-server çağrının yerini tutmaz.

## 5. Hızlı uç kontrolü

- `GET {API_BASE}/` cevap veriyorsa Worker adresi erişilebilirdir; kök rotanın `404` dönmesi tek başına sorun değildir.
- `GET {API_BASE}/identity/profile` token olmadan `401` veya `403` döndürüyorsa API rotası ve CORS erişilebilir durumdadır; bu, sağlık kontrolünde beklenen bir yanıttır.
- `404` üzerinde HTML/Cloudflare hata sayfası, yanlış Worker adresi veya eksik route ihtimalini artırır.
- Tarayıcı konsolunda `blocked by CORS policy` görünüyorsa Worker'ın origin/OPTIONS başlıkları düzeltilmelidir.

**Güvenlik:** Parolaları, API anahtarlarını, refresh token'ları veya kullanıcı verilerini tanılama çıktısına eklemeyin. Bunları ekran görüntüsü ya da herkese açık destek kaydında paylaşmayın.


## 2026-11-23 bağlantı yaması

- İstemcinin sağlık kontrolü artık `/` yerine `/identity/profile` yolunu sınar; kök sayfanın CORS/404 davranışı yanlış çevrimdışı uyarısına neden olmaz.
- Market `wrangler.toml` içindeki `ID_ORIGIN` değeri `https://mhaforevye.github.io` ile eşleşiyor. Ancak bu değişkenin bulunması Worker kodunun CORS başlıklarını otomatik eklediği anlamına gelmez.
- `/identity/*` için `OPTIONS` ve gerçek yanıt başlıklarını uygulayan middleware: `worker/identity-cors.mjs`. Mevcut Worker dispatcher'ına nasıl bağlanacağı: `MIKRO-KLIMA-WORKER-CORS-ENTEGRASYONU.md`.
- Mevcut Mikro-Klima Worker kaynak kodu / `worker/index.js` paylaşılmadığından bu middleware burada canlı Worker'a entegre edilip deploy edilmedi.
