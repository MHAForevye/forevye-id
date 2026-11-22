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
