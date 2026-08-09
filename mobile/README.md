# JashMen — мобилдик колдонмо (Flutter)

`jashmenstudio.com` веб-колдонмосунун iOS + Android версиясы. Ошол эле
backend'ди колдонот — API өзгөртүлгөн жок.

## Архитектура

```
lib/
├── main.dart                    # ApiClient + SharedPreferences даярдап, колдонмону иштетет
└── src/
    ├── app.dart                 # тема, локаль, 5 өтмөктүү навигация
    ├── api/api_client.dart      # Dio + cookie jar + 401→refresh→retry
    ├── core/
    │   ├── i18n.dart            # ky/ru/en + мазмундагы {ky,ru} талааларын чечүү
    │   ├── logic.dart           # src/utils.js'тен 1:1 порт
    │   └── theme.dart           # веб-колдонмонун түстөрү, эки тема
    ├── models/                  # /public/content жана /u/me схемалары
    ├── screens/                 # 7 экран
    ├── state/providers.dart     # Riverpod: session, content, preferences
    └── widgets/states.dart      # loading (skeleton) / error / empty
```

### Эң маанилүү техникалык чечим — refresh cookie

Веб-версияда refresh token `httpOnly` cookie'де жүрөт жана браузер аны
автоматтык жиберет. Flutter андай кылбайт, ошондуктан
`PersistCookieJar` дискте сакталат ([api_client.dart](lib/src/api/api_client.dart)).
Ансыз колдонуучу колдонмону ар жапканда чыгып калмак.

401 келгенде: бир жолу refresh → сурам кайра жиберилет. Бир нече сурам
чогуу 401 алса, refresh **бир гана жолу** аткарылат (`_refreshInFlight`).

## Иштетүү

```bash
cd mobile
flutter pub get
flutter run                        # туташкан түзмөк/симулятор
flutter run -d "iPhone 16"         # белгилүү симулятор
```

## Куруу

```bash
# Android — Play Console'го жүктөлүүчү формат
flutter build appbundle --release

# Android — түз орнотуу үчүн
flutter build apk --release

# iOS — Xcode'до архивдөө үчүн
flutter build ipa --release
```

## Дүкөнгө чыгаруу — эмне талап кылынат

Бул кадамдар **аккаунт ээсинен** гана аткарылат (документ, төлөм, инсандыкты
ырастоо талап кылынат):

### Google Play

1. [Play Console](https://play.google.com/console) аккаунту — **$25**, бир жолу
2. Upload key түзүү:
   ```bash
   keytool -genkey -v -keystore ~/jashmen-upload.jks \
     -keyalg RSA -keysize 2048 -validity 10000 -alias upload
   ```
   ⚠️ Бул файлды жана паролун **жоготпоо керек** — жоготсоңуз, колдонмону
   жаңылай албай каласыз.
3. `android/key.properties` түзүү (git'ке кирбейт):
   ```properties
   storePassword=...
   keyPassword=...
   keyAlias=upload
   storeFile=/Users/<сиз>/jashmen-upload.jks
   ```
4. `flutter build appbundle --release` → `build/app/outputs/bundle/release/app-release.aab`
5. Play Console'до: колдонмо түзүү → .aab жүктөө → сүрөттөмө, скриншоттор,
   купуялык саясаты (privacy policy URL керек) → текшерүүгө жиберүү

### App Store

1. [Apple Developer Program](https://developer.apple.com/programs/) — **$99/жыл**
2. Xcode → Signing & Capabilities → Team тандоо (аккаунт кошулгандан кийин)
3. `flutter build ipa --release`
4. Xcode Organizer же Transporter аркылуу App Store Connect'ке жүктөө
5. App Store Connect'те: сүрөттөмө, скриншоттор (6.7" жана 6.5"),
   купуялык саясаты → текшерүүгө жиберүү

### Экөөнө тең керек

- **Купуялык саясаты (Privacy Policy)** — жеке маалымат чогултулгандыктан
  (email, аты) милдеттүү. `jashmenstudio.com/privacy` барагын жасоо керек.
- **Скриншоттор** — ар бир экрандын сүрөтү, бир нече өлчөмдө
- **Сүрөттөмө** — кыргызча + орусча + англисче

## Веб-версия менен байланыш

| Веб | Мобилка |
|---|---|
| `src/utils.js` | `lib/src/core/logic.dart` |
| `src/locales/*.js` | `lib/src/core/i18n.dart` |
| `src/pages/LearnPage.jsx` | `lib/src/screens/learn_screen.dart` |
| `src/pages/LessonPage.jsx` | `lib/src/screens/lesson_screen.dart` |
| `src/store.jsx` | `lib/src/state/providers.dart` |

⚠️ Бизнес-логика эки жерде кайталанат. `src/utils.js` өзгөрсө,
`lib/src/core/logic.dart` да өзгөрүшү керек — болбосо мобилка сабакты
ачык деп көрсөтүп, сервер аны четке кагат.
