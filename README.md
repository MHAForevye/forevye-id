# FOREVYE ID — Web Arayüzü

Statik HTML/CSS/JS uygulaması (derleme yok). İki modda çalışır:

- **Demo (MOCK: true)**: sunucu gerekmez, her şey tarayıcıda (localStorage). Sağ alttaki "📬 Demo posta" düğmesi, normalde e-postayla giden kodları gösterir.
- **Gerçek sunucu (MOCK: false)**: `config.js` içindeki `API_BASE` adresine şartnamenin 15. bölümündeki uçlarla bağlanır.

## Dosyalar
| Dosya | Görev |
|---|---|
| `index.html` | Tek sayfa kabuğu |
| `config.js` | Tek ayar noktası (mock/gerçek, API adresi, limitler) |
| `api.js` | Mock arka uç + gerçek API istemcisi |
| `app.js` | Ekranlar: kayıt, doğrulama, giriş, 2FA, profil, fotoğraf kırpma, güvenlik, uygulamalar, hesap silme |
| `style.css` | Tasarım |

## GitHub Pages'e açma
1. GitHub'da yeni repo aç, zip içindekileri repo köküne yükle.
2. Settings → Pages → Branch: `main` / `(root)` → Save.
3. Adres: `https://KULLANICI.github.io/REPO/`

## Sunucuyu bağlama
1. `config.js` içinde `MOCK: false` yap; `API_BASE` değerini FOREVYE ID uçlarını gerçekten sunan Worker'ın tam HTTPS adresiyle eşleştir (sonunda `/` olmasın). Varsayılan adres `https://mikroklimakontrolmerkezi.forevye.workers.dev` olarak korunmuştur; Cloudflare'da Worker'ın hâlâ bu ada deploy edildiği doğrulanmalıdır.
2. Worker CORS allowlist'ine yayınlanan Pages origin'ini ekle. `OPTIONS` preflight yanıtı; `GET, POST, PATCH, DELETE, OPTIONS` yöntemleri ve `Authorization, Content-Type` başlıklarına izin vermeli. CORS başlıkları hata yanıtlarında da bulunmalı.
3. Sunucu HTTPS (TLS) olmalı. DNS/Worker/route doğru olsa bile CORS izin listesinde Pages origin yoksa tarayıcı bağlantıyı engeller.
4. Sayfa üstündeki **Kimlik sunucusu** satırından bağlantıyı sınayın. Kök yolun 404 dönmesi Worker'ın cevap verdiğini gösterir; bu, `/identity/*` uçlarının doğru kurulduğunu tek başına kanıtlamaz.

### Bağlantı sorunlarını ayırma
- `NETWORK`: Tarayıcı Worker'a erişemedi veya CORS yanıtını okuyamadı. API adresi, Worker dağıtımı, DNS ve CORS birlikte kontrol edilmelidir.
- `TIMEOUT`: Worker belirlenen sürede yanıt vermedi. Cloudflare Worker günlüklerini ve bağlı D1 durumunu kontrol edin.
- `HTTP_404`: Alan adı yanıt veriyor ama istenen `/identity/*` rotası bu Worker sürümünde bulunmuyor olabilir.
- `HTTP_5xx`: Worker çalışıyor ancak sunucu tarafında hata oluşuyor; Worker günlükleri ve D1 binding/migration kontrol edilmelidir.

**Önemli:** Bu ön yüz ZIP'i Identity Worker kaynak kodunu, D1 migration/şema dosyalarını veya Cloudflare hesabını içermez. Bu nedenle CORS allowlist, `ID_ORIGIN`, `RESEND_API_KEY`, D1 şeması ve gerçek API rotaları Cloudflare tarafında ayrıca doğrulanmalıdır. Ayrıntılı liste: `SUNUCU-BAGLANTI-KONTROLU.md`.

### Beklenen uçlar
Şartname bölüm 15'teki uçlar kullanılır. **Şartnamede olmayıp benim eklediğim (varsayım) uçlar:**

- `POST /identity/token/refresh` — `{refreshToken}` → `{accessToken, refreshToken}`
- `POST /identity/email/resend` — doğrulama kodunu yeniden gönder
- `GET /identity/security-events` — güvenlik olayları listesi
- `PATCH|POST|DELETE /identity/apps/{appId}` — görünen ad / bağla / kaldır
- `DELETE /identity/oauth/google` — Google bağlantısını kaldır
- `DELETE /identity/account` — gövde: `{password, unlinkGoogle}`

Login yanıtı: `{accessToken, refreshToken}` veya 2FA için `{twoFactorRequired, method, challengeId}`; 2FA'nın ikinci adımı aynı `/identity/login` ucuna `{email, challengeId, code}` ile gelir. 2FA kurulumu `/identity/2fa/enable` ucuna önce `{method, password}`, sonra `{code}` ile gönderilir.

## Önemli notlar
- **Sunucu tarafı doğrulama şart.** Kullanıcı adı kuralları, 24 saatlik fotoğraf sınırı, 2 MB, içerik türü kontrolü, hız sınırlama ve 15 günlük bekleme gerçekte sunucuda uygulanmalıdır; arayüzdeki kontroller yalnızca kullanım kolaylığıdır.
- **Token saklama:** gerçek modda token'lar localStorage'dadır. Üretimde `HttpOnly; Secure; SameSite` çerez önerilir.
- **Mock güvenli değildir:** demo yalnızca arayüzü denemek içindir; gerçek kullanıcı verisi girmeyin.
- **Google ile giriş:** mock'ta sahte hesapla simüle edilir. Gerçek modda Google Identity Services bağlantısı henüz eklenmedi; `GOOGLE_CLIENT_ID` ve `api.js` içindeki `googleLogin` tamamlanmalı.
- **Authenticator:** QR kod üretilmiyor; gizli anahtar ve `otpauth://` bağlantısı gösteriliyor (elle ekleme).

## Şartnamedeki açık kararlar için benim seçimlerim (onay bekliyor)
- 2FA: aynı anda **tek yöntem** etkin; değiştirmek için kapat → yeniden aç.
- Kullanıcı adı: kayıtta istenmez, ilk girişten sonra Profil'den seçilir; **ilk seçim değişiklik hakkından sayılmaz**, 48 saatlik pencere ilk seçimden başlar.
- Parola kuralı: en az 10 karakter, harf+rakam (`PASSWORD_MIN_LENGTH`).
- Hesap silmede Google "kaldırma" seçeneği: yerel kayıt hesapla silinir, Google'daki izin kalır (kullanıcıya açıkça yazılır).
- E-posta erişim kaybı için alternatif kurtarma yoktur (şartnamede de açık karar).
- Yasal metinler yer tutucudur.
