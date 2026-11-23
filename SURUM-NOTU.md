# FOREVYE ID — Ön Yüz Sürüm Notu (22 Kasım 2026)

Bu sürüm yalnızca **ön yüzü** kapsar. Identity Worker ve D1 şeması pakette olmadığından backend (OIDC, Registry, grant) bu teslimde YOKTUR.

## Değişen dosyalar
| Dosya | Değişiklik |
|---|---|
| `api.js` | Sabit `APPS` dizisi kaldırıldı. `catalog()` → `GET /v1/catalog/apps`, `apps()` → `GET /v1/me/apps`; uç yoksa (404) eski `/identity/apps` adaptörüne düşer. Yanıt şekli tek biçime normalleştirilir (dizi veya `{items,total,...}`). Scope'lar `openid`, `profile:read` gibi makine adlarıyla; eski `kimlik/bakiye/...` adları geriye uyumlu. Mock: katalog artık DB içinde, **kayıtta otomatik uygulama izni verilmez**, olmayan uygulamaya bağlanma reddedilir. |
| `app.js` | "Uygulamalarım" ekranı API'den dinamik kart ızgarası: arama, kategori filtresi, sayfalama, durum rozetleri (Bağlı / Bağlı değil / Askıda / Yeni izin gerekiyor), "Aç", izin listesi. Demo kutusuna "Katalogu 60 uygulamaya çıkar" düğmesi. |
| `style.css` | Füme + amber masa lambası teması (mor/mavi gradient yok), responsive uygulama ızgarası, lamba stilleri, `prefers-reduced-motion`. |
| `index.html` | `lamp.js` eklendi, tema rengi güncellendi. |
| `lamp.js` (yeni) | Etkileşimli SVG masa lambası: başlık sürükleme + ←/→ klavye, açık/kapalı (switch rolü), 3 parlaklık, varsayılana dön, ~40 sn düşük genlikli salınım, sekme arka plandayken ve reduced-motion'da durur. Yalnızca UI tercihi `localStorage`'a yazılır. Lamba kapalıyken arayüz tam işlevsel; <1400 px'te sahne gizlenir, kumanda kalır. |

## Doğrulananlar (mock + headless Chromium)
- 6 → 60 uygulamada arayüz bozulmaz; arama, kategori, sayfalama çalışır.
- Yeni kullanıcıda hiçbir uygulamaya otomatik grant yok; grant kaldırmak yalnızca o uygulamayı etkiler.
- Lamba: sürükleme, aç/kapat, konsol hatası yok.

## YAPILMADI / backend gerektirir (brifing Faz 0–5)
- Registry, grant tabloları, `/oauth/*`, OIDC discovery/JWKS, PKCE doğrulama, tek kullanımlık code, refresh rotation, SSO çerezi, global logout, admin paneli, SDK.
- `fid_tokens` hâlâ `localStorage`'da: HttpOnly cookie/BFF ancak sunucu tarafı gelince kaldırılabilir.
- Gerçek sunucudaki `/v1/*` uçları henüz yok; ön yüz 404'te eski `/identity/apps`'e düşer. Gerçek uç davranışı test EDİLMEDİ.
- `assets/forevye-id-cover.png` ön yüze eklenmedi.

## 23 Kasım 2026 — Tasarım sadeleştirme (yalnızca ön yüz)
- `lamp.js` **silindi**; `index.html`'den script satırı, `style.css`'ten lamba sahnesi/kumandası, radial ışık, parlama (glow) ve `--lamp-*` değişkenleri kaldırıldı. Giriş, profil, güvenlik ve uygulama kataloğu işlevleri değişmedi (`app.js`/`api.js` dokunulmadı).
- Düz koyu füme zemin, ince çizgi, amber yalnızca ana eylem/odakta. `prefers-reduced-motion` korunuyor.
- **Hâlâ YAPILMADI:** Identity/Mikro-Klima Worker kaynağı bu paketlerde yok; Registry, grant, PKCE code exchange, refresh rotation backend'i uygulanmadı ve "SSO tamamlandı" denemez.


## 23 Kasım 2026 — Sunucu bağlantısı ve istemci dayanıklılığı
- `api.js`: API adresi HTTPS olarak doğrulanır ve sondaki `/` normalize edilir; her istek ve sağlık kontrolüne zaman aşımı eklenir. Ağ/CORS, timeout, 404 ve 5xx mesajları ayrıştırılır. JSON dışı hata yanıtları da okunur. Eşzamanlı 401 yanıtları tek bir refresh işlemini paylaşır; geçersiz refresh token temizlenir, bağlantı kesintisinde token gereksiz yere silinmez. Kök URL sağlık kontrolü eklendi (404 yanıtı da Worker'ın erişilebilir olduğunu gösterir).
- `config.js`: `API_TIMEOUT_MS` ve `HEALTH_TIMEOUT_MS` ayarları eklendi.
- `app.js`, `index.html`, `style.css`: sayfanın üstünde canlı sunucu durumu ve tekrar deneme eylemi eklendi.
- `README.md`: Cloudflare CORS/Worker/route kontrol listesi ve hata kodu açıklamaları eklendi.
- **Backend notu:** Bu kaynak arşivinde Identity Worker ve D1 şeması bulunmadığından sunucu tarafı rota/CORS/DNS değişikliği veya deploy yapılmadı.
- `SUNUCU-BAGLANTI-KONTROLU.md` (yeni): Cloudflare Worker, CORS, D1, ID_ORIGIN ve Nexus ID_URL/ID_API_URL için yayın kontrol listesi.


## 2026-11-23 — bağlantı ve CORS teşhisi
- Sağlık denetimi kök URL yerine `GET /identity/profile` kullanacak şekilde düzeltildi. `401/403` geçerli bir API yanıtı olarak çevrimiçi kabul edilir.
- `/identity/*` Worker uçları için allowlist tabanlı CORS middleware ve testleri eklendi.
- Worker modülünün entegrasyon adımları belgelendi. Gerçek Mikro-Klima Worker kaynak kodu teslim edilen arşivde bulunmadığı için canlı dağıtım yapılmadı.


## 23 Kasım 2026 — Uygulamalar sayfası hata yönetimi
- `app.js`: `/uygulamalar` artık profil veya uygulama listesi istekleri başarısız olduğunda tüm uygulamayı genel hata ekranına düşürmez. Sayfa içinde yeniden deneme, hata kodu, API adresi ve başarısız uçları gösterir; tanı bilgisini kopyalayabilir. Gerçek sunucu verisi gelmeden sahte uygulama/bağlantı durumu oluşturmaz.
- `api.js`: yeni Registry uçları `404/405` döndürdüğünde eski `/identity/apps` adaptörüne geçilir; arama, kategori ve sayfalama parametreleri eski uca da aktarılır. Ağ, oturum ve 5xx hatalarında sessiz fallback yapılmaz. İki Registry rotası da yoksa iki denemenin ayrıntısı korunur. HTTP/ağ hataları hangi URL'de oluştuğunu taşır.
- `style.css`: uygulama listesinin yükleniyor ve hata durumları için ayrı görünüm eklendi.
- **Backend gereksinimi devam ediyor:** Identity Worker'da `GET /v1/me/apps` veya `GET /identity/apps` ve profil/oturum rotaları gerçekten bulunmalı. Bu ön yüz paketi sunucu rotası yaratmaz ve Cloudflare'a deploy yapmaz.
