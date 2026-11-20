/* FOREVYE ID — yapılandırma
 * Sunucuyu bağlarken yalnızca bu dosyayı değiştirmeniz yeterlidir.
 *
 *  MOCK: true  → sunucu yok; tarayıcıda (localStorage) çalışan demo arka uç.
 *  MOCK: false → API_BASE adresindeki gerçek Identity Service kullanılır.
 */
window.FOREVYE_CONFIG = {
  MOCK: true,
  API_BASE: "https://id-api.ornek.com",   // MOCK:false iken kullanılır, sonunda "/" olmasın
  GOOGLE_CLIENT_ID: "",                   // Google ile giriş için (MOCK:false iken)
  PASSWORD_MIN_LENGTH: 10,                // şartnamede belirtilmedi; öneri değeri
  PHOTO_MAX_BYTES: 2 * 1024 * 1024,       // şartname: 2 MB
  PHOTO_COOLDOWN_HOURS: 24,               // şartname: 24 saatte bir
  USERNAME_FIRST_WINDOW_HOURS: 48,        // şartname: ilk 48 saat
  USERNAME_FIRST_WINDOW_MAX_CHANGES: 2,   // şartname: en fazla 2 değişiklik
  USERNAME_COOLDOWN_DAYS: 15              // şartname: sonrasında 15 gün bekleme
};
