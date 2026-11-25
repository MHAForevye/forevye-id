# FOREVYE ID — Kimlik Merkezi

FOREVYE ekosistemindeki uygulamalar için ortak kimlik hesabı arayüzüdür. Bu repo GitHub Pages üzerinde yayımlanan statik ön yüzü içerir.

## Çalışma ayarları

`config.js` içinde üretim için `MOCK: false` ve `API_BASE` olarak Identity Worker adresi kullanılır. Varsayılan API adresi `https://mikroklimakontrolmerkezi.forevye.workers.dev` şeklindedir. `API_BASE` sonunda `/` olmamalıdır.

## Sayfalar ve özellikler

- E-posta/parola ile kayıt ve giriş, e-posta doğrulama ve parola sıfırlama
- İki aşamalı doğrulama ve profil/güvenlik ayarları
- Merkezi kullanıcı adı ve profil fotoğrafı
- Bağlı uygulama listesi, izin kapsamları, görünen ad ve bağlantıyı kaldırma
- `sanal-banka` için PKCE tabanlı uygulama yetkilendirme ekranı (`/#/baglan`)
- Sabit sıcak sarı ışıklı masa lambası: başlığı fareyle, dokunarak veya ok tuşlarıyla hareket ettirilebilir; açı tarayıcıda hatırlanır

Arayüzde kalıcı sunucu durumu, bağlantı sınama düğmesi veya teknik tanı kopyalama eylemi bulunmaz. Kullanıcıya yalnızca ilgili işlem başarısız olduğunda sade bir hata ve yeniden deneme olanağı sunulur.

## GitHub Pages

1. Dosyaları repo köküne yükleyin.
2. Settings → Pages → Branch `main`, folder `/(root)` seçip kaydedin.
3. FOREVYE ID adresi `https://mhaforevye.github.io/forevye-id/` olmalıdır.

## Worker ve CORS

Identity API Worker `API_BASE` adresinde çalışmalıdır (Mikro-Klima Worker'ı). İki GitHub hesabının origin'leri (`https://mhaforevye.github.io`, `https://frovyes.github.io`) Worker'ın **kendi kodunda sabittir** (`MikroKlimaKontrolMerkezi/worker/origins.js`); Cloudflare panelindeki `ID_ORIGIN` gibi değişkenler yalnızca ek adres içindir. `OPTIONS` istekleri, `GET, POST, PATCH, DELETE, OPTIONS` yöntemleri ve `Authorization, Content-Type` başlıkları desteklenir; CORS başlıkları hata yanıtlarında da bulunur. Ayrıntılar `MIKRO-KLIMA-WORKER-CORS-ENTEGRASYONU.md` ve `SUNUCU-BAGLANTI-KONTROLU.md` içindedir.

## Nexus Banka bağlantısı

Nexus Banka Worker'ı `ID_URL` ile bu GitHub Pages arayüzünü, `ID_API_URL` ile Identity API Worker'ını kullanır. Banka `sanal-banka` uygulama kimliği ve PKCE ile bir giriş isteği başlatır. Kullanıcı FOREVYE ID'de oturum açıp izin verdiğinde tek kullanımlık yetkilendirme kodu banka callback adresine döner; banka kodu sunucudan sunucuya `POST /identity/token/exchange` çağrısıyla doğrular. ID parolası bankaya gönderilmez.

## Backend kapsamı ve doğrulama sınırı

Bu repo statik ön yüzü, istemci API katmanını ve CORS entegrasyon notlarını içerir. Identity Worker'ın tam kimlik doğrulama kaynak kodu, D1 migration dosyaları ve Cloudflare dağıtım ayarları bu ZIP'te değildir. Bu nedenle yerel testler istemci sözleşmesini, yetkilendirme isteği üretimini ve banka callback'inin simüle edilmiş yanıtla bağlanmasını doğrular; canlı Identity Worker erişimini veya gerçek kullanıcıyla uçtan uca girişi tek başına kanıtlamaz. Canlı doğrulama için gerçek giriş/kayıt ve banka izin akışının yayımlanmış Worker üzerinde tamamlanması gerekir.
