# FOREVYE ID — Güncel Ön Yüz Notu

- Ön yüz `MOCK: false` ayarıyla Mikro-Klima Identity Worker'ına bağlanır.
- Uygulama kataloğu ve hesap bağlantıları doğrudan `GET /identity/apps` uç noktasını kullanır.
- Banka girişi için `/baglan` izni, `sanal-banka` uygulama kimliği ve PKCE parametreleri kullanılır.
- Masa lambası `lamp.js` tarafından sayfaya eklenir; ışığı sabit sıcak sarıdır, yalnızca başlığı fare/dokunma veya ok tuşlarıyla hareket ettirilebilir. Son açı tarayıcıda saklanır.
- Sayfada sunucu durum göstergesi, bağlantı sınama bağlantısı veya tanı kopyalama düğmesi bulunmaz.

## Backend sınırı

Bu depo GitHub Pages için statik ön yüzü ve CORS entegrasyon notlarını içerir. Identity Worker'ın asıl kaynak kodu, D1 migration'ları ve Cloudflare dağıtım yapılandırması bu arşivde bulunmadığından canlı backend'in çalışma durumu yalnızca bu depodaki testlerle kanıtlanamaz. Gerçek hesap girişi, kayıt ve banka yetkilendirme işlemleri yayınlanmış Identity Worker üzerinden doğrulanmalıdır.
