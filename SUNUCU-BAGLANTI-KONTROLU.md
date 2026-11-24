# FOREVYE ID — Sunucu bağlantısı ve yayın kontrolü

Bu proje GitHub Pages üzerinde çalışan statik ön yüzdür. Kimlik işlemleri `config.js` içindeki `API_BASE` adresindeki Cloudflare Worker üzerinden yürür. Bu repoda Identity Worker'ın tam kaynak kodu veya D1 migration dosyaları yoktur.

## Üretim ayarları

- `MOCK: false` olmalı.
- `API_BASE`, `/identity/*` uçlarını sunan HTTPS Worker adresi olmalı; sonunda `/` bulunmamalı.
- Worker CORS allowlist'inde `https://mhaforevye.github.io` origin'i bulunmalı.
- `OPTIONS` preflight, `GET, POST, PATCH, DELETE, OPTIONS` yöntemleri ve `Authorization, Content-Type` başlıkları desteklenmeli. Başarılı ve hatalı yanıtların tümünde CORS başlıkları bulunmalı.
- D1 binding ve Identity şeması gerçek Identity Worker'ın kullandığı veritabanında hazır olmalı. E-posta doğrulaması etkinse e-posta sağlayıcısının secret/variable ayarları da Worker tarafında tanımlanmalı.

## Banka entegrasyonu

Nexus Banka Worker'ında: `ID_URL=https://mhaforevye.github.io/forevye-id` ve `ID_API_URL=https://mikroklimakontrolmerkezi.forevye.workers.dev` olmalıdır. Banka `sanal-banka` uygulama kimliği ile `/#/baglan` sayfasını açar; ID izin ekranından sonra callback'e tek kullanımlık kod döner ve banka bu kodu sunucudan sunucuya token exchange ile doğrular.

Nexus tarafındaki `migrations/0003_forevye_id.sql` migration'ı bankanın kendi D1 veritabanına uygulanmış olmalıdır. Bu migration `id_states`, `id_links` ve `id_pending` tablolarını sağlar.

## Gerçek akışla doğrulama

1. FOREVYE ID'de kayıt veya giriş yapın; e-posta doğrulaması ve varsa 2FA tamamlanmalı.
2. Oturum açtıktan sonra Profil ve Uygulamalarım sayfalarının gerçek hesap bilgileriyle yüklendiğini kontrol edin.
3. Nexus Banka'da FOREVYE ID ile giriş başlatın.
4. ID tarafında `sanal-banka` uygulama adını ve izin kapsamlarını görün; izin verin.
5. Bankanın callback adresine döndüğünü ve banka oturumunun açıldığını doğrulayın. Aynı doğrulanmış e-posta ile eski banka hesabı varsa hesap birleştirme akışı uygulanır; aksi durumda banka ilk kurulum adımına yönlendirir.

Sunucu durumu arayüzde ayrı bir panel olarak gösterilmez; bağlantı gerçek kullanıcı işlemleri sırasında kurulur. Bir hata oluşursa tarayıcı DevTools → Network üzerinden ilgili `/identity/*` isteğinin HTTP yanıtı, `OPTIONS` preflight sonucu ve CORS başlıkları incelenebilir.

## Hata ayrımı

- `NETWORK`: Worker'a erişim, DNS veya CORS sorunu olabilir.
- `TIMEOUT`: Worker yanıt vermemiştir; Cloudflare günlükleri ve bağımlı servisler incelenmelidir.
- `HTTP_404`: İstenen `/identity/*` rotası Worker'da bulunmuyor veya yanlış API adresi kullanılıyor olabilir.
- `HTTP_5xx`: Worker veya D1 tarafında sunucu hatası olabilir.

**Canlı doğrulama notu:** Yerel testler gerçek Identity Worker'a bağlanmaz; bu repoda Identity backend kaynak kodu yoktur. Canlı kullanıcı girişi, CORS, D1 ve e-posta sağlayıcısı yalnızca yayımlanmış Worker üzerinde gerçek hesapla doğrulanabilir.
