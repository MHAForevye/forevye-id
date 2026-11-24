/* FOREVYE ID — yapılandırma
 * Sunucuyu bağlarken yalnızca bu dosyayı değiştirmeniz yeterlidir.
 *
 *  MOCK: true  → sunucu yok; tarayıcıda (localStorage) çalışan demo arka uç.
 *  MOCK: false → API_BASE adresindeki gerçek Identity Service kullanılır.
 *
 *  Identity Service = Mikro-Klima Worker'ı (/identity/*). Sunucu tarafında: wrangler.toml → ID_ORIGIN bu sitenin adresi olmalı,
 *  gizli değerler RESEND_API_KEY (+ EMAIL_FROM) ayarlanmalı, schema.sql D1'e uygulanmalı. Bkz. mikro-klima/BAGLANTI-FOREVYE.md
 */
window.FOREVYE_CONFIG = {
  MOCK: false,
  API_BASE: "https://mikroklimakontrolmerkezi.forevye.workers.dev",   // Kimlik API Worker adresi; HTTPS, sonunda "/" olmamalı
  API_TIMEOUT_MS: 12000,                 // İstek başına üst sınır; takılı kalan istekler arayüzü kilitlemez
  GOOGLE_CLIENT_ID: "",                   // Google ile giriş için (MOCK:false iken)
  PASSWORD_MIN_LENGTH: 10,                // şartnamede belirtilmedi; öneri değeri
  PHOTO_MAX_BYTES: 1900000,               // şartname 2 MB; sunucu (D1 satır sınırı) 1,9 MB'a kadar kabul eder. İstemci fotoğrafı zaten küçültüp kırpar
  PHOTO_COOLDOWN_HOURS: 24,               // şartname: 24 saatte bir
  USERNAME_FIRST_WINDOW_HOURS: 48,        // şartname: ilk 48 saat
  USERNAME_FIRST_WINDOW_MAX_CHANGES: 2,   // şartname: en fazla 2 değişiklik
  USERNAME_COOLDOWN_DAYS: 15              // şartname: sonrasında 15 gün bekleme
};
