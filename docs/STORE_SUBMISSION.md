# App Store жана Google Play'ге чыгаруу

JashMen'ди эки дүкөнгө тең жүктөө үчүн керектүү нерселердин баары. Бул файл
эки бөлүктөн турат:

1. **Кодго кирген нерселер** — жасалып бүттү, кайра жасоонун кереги жок
2. **Сиз жасашыңыз керек** — Apple/Google порталдарында, кол менен

Эң аягында **ар бир форманын жообу** даяр түрдө берилген — көчүрүп
коё берсеңиз болот.

---

## 0. Эң башкы эрежелер

Баш тартуунун себептеринин 90% ушул үчөөнөн келип чыгат:

| Эреже | Абалы |
|---|---|
| Аккаунт өчүрүү (App Store 5.1.1(v), Play Data deletion) | ✅ жасалды |
| Sign in with Apple (App Store 4.8) | ⚠️ код даяр, порталда күйгүзүү керек |
| Купуялык саясаты формадагы жооптор менен дал келүү | ✅ дал келет |

---

## 1. Кодго кирип бүткөн нерселер

### Аккаунт өчүрүү

Эки дүкөн тең муну талап кылат. Үч жерде иштейт:

- **Колдонмодо** — Орнотуулар → эң ылдыйда «Аккаунтту өчүрүү»
- **Сайтта** — ошол эле жерде
- **Ачык баракта** — <https://jashmenstudio.com/delete-account> (кирүүсүз ачылат)

Кокустан басууга жол бербөө үчүн: сырсөзү бар аккаунт **сырсөзүн кайра
жазат**; Google/Apple менен катталган аккаунт **«ӨЧҮР»** деп жазат.

**Эмне өчүрүлөт:** почта, ат, сүрөт, сырсөз, Google/Apple байланышы, бүткөн
сабактар, монеталар, купондордун коддору, бардык сессиялар.

**Эмне калат:** университеттин **жалпы упай саны** гана — ал бүт кампуска
таандык жана эч кимге байланышпайт. Себеби: аны алып салсак, сезонду 105 541
упай менен аяктаган вуздун жыйынтыгы кийин өзүнөн-өзү өзгөрүп, спонсорго
көрсөтүлгөн отчёт жалган болуп калмак.

> Формаларда «маалымат толук өчүрүлөбү?» деген суроого **«Ооба»** деп
> жооп бересиз. Анонимдештирилген жалпы сан жеке маалымат эмес — аны
> кайра адамга тагуу мүмкүн эмес, ошондуктан бул туура жооп.

### Платформа жөндөөлөрү

| Файл | Эмне өзгөрдү | Эмне үчүн |
|---|---|---|
| `ios/Runner/PrivacyInfo.xcprivacy` | **жаңы** | 2024-жылдын майынан бери милдеттүү; жоктугу жүктөөдө кармалат |
| `ios/Runner/Runner.entitlements` | **жаңы** | Sign in with Apple |
| `ios/Runner/Info.plist` | `ITSAppUsesNonExemptEncryption=false` | ар бир жүктөөдөгү шифрлөө суроосу жоголот |
| `ios/Runner/Info.plist` | iPad багыттары алынды, тик гана | Apple iPad'да текшерет — телефонго жасалган макет ал жерде баш тартууга алып келет |
| `project.pbxproj` | `TARGETED_DEVICE_FAMILY = 1` | iPhone гана |
| `AndroidManifest.xml` | `INTERNET` уруксаты | мурун плагинден кокустан келип жаткан — плагин алмашса релиз интернетсиз калмак |

### Sign in with Apple

Код даяр: `admin-api/appleAuth.js`, `POST /u/auth/apple`, колдонмодо баскыч.
Apple'дын үч өзгөчөлүгү эсепке алынган:

- ат **бир жолу гана** келет → биринчи жолу сакталат
- почта **жашырылган болушу мүмкүн** (`@privaterelay.appleid.com`) → кабыл алынат
- почта **кийинки жолу такыр келбейт** → аккаунт `sub` боюнча табылат

### Google баскычы iOS'то

Мурун баскыч **көрүнүп, бирок иштебей** турган — бул App Store 2.1 боюнча
баш тартуу. Эми: иштей албаса, такыр көрүнбөйт. iPhone колдонуучусу
социалдык кирүүсүз калбайт — анын ордунда Apple баскычы турат.

---

## 2. Сиз жасашыңыз керек

### 2.1 Apple Developer порталы

1. **Certificates, Identifiers & Profiles → Identifiers**
   `com.jashmenstudio.jashmen` дегенди ачыңыз
2. **Sign in with Apple** дегенди белгилеңиз → Save
3. **Provisioning profile'ду кайра түзүңүз** (Xcode өзү да жасайт:
   Signing & Capabilities → Automatically manage signing)

> Бул кадамды өткөрүп жиберсеңиз, архив жүктөлбөйт. Ката билдирүүсү
> Apple sign-in жөнүндө эмес, «кол коюу» жөнүндө болот — ошондуктан
> себебин табуу кыйын.

4. Серверде `admin-api/.env.production` файлына кошуңуз:
   ```
   APPLE_BUNDLE_ID=com.jashmenstudio.jashmen
   ```
   Анан контейнерди кайра баштаңыз. Ансыз баскыч көрүнбөйт.

### 2.2 Google iOS кирүүсүн күйгүзүү (каалоо боюнча)

Азыр iOS'то Google баскычы жок — иштебей тургандыктан жашырылган.
Күйгүзүү үчүн:

1. Google Cloud Console → OAuth client → **iOS** түрү, bundle id
   `com.jashmenstudio.jashmen`
2. Серверге: `GOOGLE_CLIENT_ID_IOS=...`
3. `ios/Runner/Info.plist` ичиндеги `CFBundleURLTypes` блогун комментарийден
   чыгарып, **reversed client id** дегенди коюңуз
4. Кайра куруп, жүктөңүз

Ансыз да болот — Apple баскычы жетиштүү.

### 2.3 Android: AAB куруу

Play **APK кабыл албайт**, `.aab` керек:

```bash
cd mobile
flutter build appbundle --release
# build/app/outputs/bundle/release/app-release.aab
```

Кол коюу ачкычы `mobile/android/key.properties` файлында — ал git'ке
кирбейт. **Ачкычты жоготпоңуз**: жоготсоңуз колдонмону жаңырта албай
каласыз. Камдык көчүрмөсүн сактаңыз.

### 2.4 Версия номерин көтөрүү

`mobile/pubspec.yaml` → `version: 1.0.0+1`

- `1.0.0` — колдонуучу көргөн версия
- `+1` — **build номери**. Ар бир жүктөөдө сөзсүз чоңойушу керек, антпесе
  эки дүкөн тең кабыл албайт

---

## 3. Формалардын жооптору

### 3.1 Google Play → Data safety

| Суроо | Жооп |
|---|---|
| Маалымат чогултасызбы? | **Ооба** |
| Маалымат шифрленген каналда берилеби? | **Ооба** (HTTPS) |
| Колдонуучу маалыматын өчүртө алабы? | **Ооба** → URL: `https://jashmenstudio.com/delete-account` |

**Чогултулган маалымат:**

| Түрү | Чогултулат | Бөлүшүлөт | Милдеттүү | Максаты |
|---|---|---|---|---|
| Аты | Ооба | Жок | Ооба | App functionality, Account management |
| Email | Ооба | Жок | Ооба | App functionality, Account management |
| Колдонуучунун сүрөтү | Ооба | Жок | **Жок** | App functionality |
| Колдонмодогу аракеттер (прогресс) | Ооба | Жок | Ооба | App functionality |
| Колдонуучунун ID'си | Ооба | Жок | Ооба | App functionality, Account management |

**Баарына «Жок» деп жооп бериңиз:** жайгашуу, байланыш дептери, каржы
маалыматы, ден соолук, SMS, чалуулар, календарь, файлдар, микрофон, камера,
түзмөктүн ID'си, жарнама.

> Купуялык саясатынын шилтемеси: `https://jashmenstudio.com/privacy`

### 3.2 App Store Connect → App Privacy

`ios/Runner/PrivacyInfo.xcprivacy` файлы менен **дал келиши керек** —
Apple экөөнү салыштырат.

| Категория | Түрү | Байланышканбы | Трекингбы | Максаты |
|---|---|---|---|---|
| Contact Info | Email Address | Ооба | **Жок** | App Functionality |
| Contact Info | Name | Ооба | **Жок** | App Functionality |
| User Content | Photos or Videos | Ооба | **Жок** | App Functionality |
| Identifiers | User ID | Ооба | **Жок** | App Functionality |
| Usage Data | Product Interaction | Ооба | **Жок** | App Functionality |

**«Track this app's users across apps?» → Жок.** Колдонмодо жарнама да,
аналитика SDK да, атрибуция да жок.

### 3.3 Жаш курагы жана рейтинг

Тандалган аудитория: **13+**

| Дүкөн | Жооп |
|---|---|
| App Store Age Rating | **12+** (билим берүү, зордук-зомбулук жок, кумар оюну жок) |
| Play Content rating | Anketaны толтуруңуз → **Teen** чыгат |
| Play Target audience | **13–15, 16–17, 18+** белгилеңиз |
| Play Families policy | **Тиешеси жок** (13төн кичүүлөр максаттуу эмес) |

> Play'де «балдар максаттуу аудиториябы?» дегенге **Жок** деп жооп бериңиз —
> антпесе Families саясаты күчүнө кирип, көп кошумча талап пайда болот.

### 3.4 Кумар оюну (маанилүү)

Лига жана байге фонду жөнүндө суроо чыкса:

> Лига — **билимге негизделген жарыш**. Упай сабак бүтүрүү менен гана
> табылат. Катышуу **акысыз**, эч нерсе сатып алуунун кереги жок,
> кокустук жок. Монеталарды сатып алууга да, накталай акчага
> алмаштырууга да болбойт.

Бул кумар оюну эмес жана лотерея эмес. Эрежелер:
<https://jashmenstudio.com/terms>

### 3.5 Дүкөн ичиндеги сатып алуулар

**Жок.** Монеталар сабак бүтүрүү менен гана табылат, сатылбайт. Ошондуктан
Apple'дын IAP талабы (3.1.1) тиешелүү эмес.

---

## 4. Ресурстар

### Милдеттүү шилтемелер

| Кайда | URL |
|---|---|
| Купуялык саясаты | `https://jashmenstudio.com/privacy` |
| Колдонуу шарттары | `https://jashmenstudio.com/terms` |
| Аккаунт өчүрүү | `https://jashmenstudio.com/delete-account` |
| Колдоо | `jashmenstudio@gmail.com` |
| Маркетинг | `https://jashmenstudio.com` |

### Скриншоттор

Колдонмо экрандарын өзү тартат: `integration_test/store_screenshots_test.dart`.
Симуляторго терүү үчүн macOS'тун Accessibility уруксаты керек эмес.

Натыйжа: **1320×2868**, App Store'дун 6.9" талап кылган өлчөмү. Статус
тилкеси Apple'дын стандарты боюнча `9:41`, батарея толук.

**Маанилүү:** локалдык API менен иштейт, продакшн менен эмес. Скриншоттор
чыныгы адамдын аккаунтун талап кылбашы керек.

```bash
# 1. 6.9" симулятор (бир жолу)
xcrun simctl create "JashMen Shots 6.9" \
  com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max \
  com.apple.CoreSimulator.SimRuntime.iOS-26-4

# 2. Локалдык API таза seed менен
NODE_ENV=development JWT_SECRET=x ADMIN_PASSWORD=x PORT=3030 \
  TRUST_PROXY_HOPS=0 SIGNUP_RATE_LIMIT=500 node admin-api/server.js &

# 3. Прогресси бар колдонуучу жана лигадагы классташтар (signup + сабак бүтүрүү),
#    жана dailyFreeLessons=10 — болбосо энергия 0 болуп сабак башталбайт

# 4. Симуляторду тазалап, сааттын жазуусун коюу
xcrun simctl erase <id> && xcrun simctl boot <id>
xcrun simctl status_bar <id> override --time 9:41 --batteryState charged \
  --batteryLevel 100 --cellularBars 4 --wifiBars 3

# 5. Тест "SHOT:<аты>" деп жазат, хост ошондо simctl менен сүрөткө тартат
flutter drive --driver=test_driver/integration_test.dart \
  --target=integration_test/store_screenshots_test.dart -d <id> \
  --dart-define=API_BASE_URL=http://localhost:3030/admin/api \
  --dart-define=TEST_EMAIL=... --dart-define=TEST_PASSWORD=...
```

Сүрөттөр `simctl io <id> screenshot` менен, Flutter'дин өз тартуусу менен
эмес: экинчиси статус тилкесин бош тилке кылып тартат.

**Симуляторду ар жолу `erase` кылыңыз.** Мурунку сеанстан калган Keychain
токени тестти чаташтырат.


---

## 5. Чыгаруудан мурунку тизме

```
□ pubspec.yaml → build номери көтөрүлдү
□ Серверде APPLE_BUNDLE_ID коюлду, контейнер кайра башталды
□ Apple Developer'де Sign in with Apple күйгүзүлдү
□ Provisioning profile кайра түзүлдү
□ flutter test  → баары өттү
□ node --test admin-api/*.test.mjs  → баары өттү
□ Үч барак ачылат: /privacy /terms /delete-account
□ Колдонмодон аккаунт өчүрүү иштейт
□ Скриншоттор даяр (App Store 3+, Play 4+ жана feature graphic)
□ flutter build appbundle --release   (Play)
□ flutter build ipa                   (App Store)
```

---

## 6. Текшерүүчүгө жазыла турган нот (review notes)

Тесттик аккаунт бербей эле болот — каттоо акысыз жана дароо. Бирок ушуну
жазып койсоңуз, текшерүү тезирээк өтөт:

```
Account deletion: Settings → "Аккаунтту өчүрүү" (bottom of the screen).
It asks for the password, or for the word ӨЧҮР on accounts created with
Google/Apple. Also available without signing in at
https://jashmenstudio.com/delete-account

The app has no in-app purchases. Coins are earned by completing lessons
and cannot be bought, sold or exchanged for money.

The university league is a skill-based contest: points come from completing
lessons, entry is free, and no purchase is required. Rules:
https://jashmenstudio.com/terms

Sign in with Apple is offered alongside Google, per Guideline 4.8.
```

---

# App Store: кадам-кадам менен

> Бул бөлүм Apple Developer Program төлөнгөндөн кийинки так тартип.
> Ар бир кадам мурункусу бүткөндөн кийин гана иштейт.

## Кадам 1 — Xcode'го Apple ID менен кирүү ⛔ БУЛ ЖОКСУЗ ЭЧ НЕРСЕ БОЛБОЙТ

Азыр машинада эсеп жок. Архив куруу так ушуга урунуп токтойт:

```
Error (Xcode): No Accounts: Add a new account in Accounts settings.
```

Кантип:

1. **Xcode** → жогорку менюдан **Xcode → Settings** (же `⌘ ,`)
2. **Accounts** кыстырмасы → ылдый сол жактагы **+** → **Apple ID**
3. **Төлөм жасаган Apple ID** менен кириңиз (2FA коду телефонуңузга келет)

> ⚠️ Машинадагы бар сертификат `akeevbelek391@gmail.com` дегенге таандык.
> Эгер сиз башка Apple ID менен төлөгөн болсоңуз — **ошол жаңысы менен**
> кириңиз, антпесе команда дал келбей калат.

4. Киргенден кийин **Manage Certificates…** → **+** → **Apple Distribution**

## Кадам 2 — Команда ID'син текшерүү

Долбоордо `DEVELOPMENT_TEAM = JS7RNK46AF` деп жазылган. Кирген эсебиңиздин
команда ID'си башка болсо, ал иштебейт.

Xcode → Settings → Accounts → эсебиңиз → команданын жанында ID жазылат
(10 белги). Башка болсо:

```bash
cd mobile
grep -rn "JS7RNK46AF" ios/Runner.xcodeproj/project.pbxproj
# үч жерде тең жаңы ID'ге алмаштырыңыз
```

## Кадам 3 — Sign in with Apple'ды күйгүзүү

<https://developer.apple.com/account> → **Certificates, Identifiers & Profiles**
→ **Identifiers** → `com.jashmenstudio.jashmen`

**Sign in with Apple** дегенди белгилеңиз → **Save**.

> Идентификатор тизмеде жок болсо, Xcode аны 4-кадамда өзү түзөт.

## Кадам 4 — Архивди куруу

```bash
cd mobile
flutter build ipa
```

Ийгиликтүү болсо: `build/ios/ipa/jashmen.ipa`

Кол коюу катасы чыкса, Xcode'дон ачып туураңыз:

```bash
open ios/Runner.xcworkspace
```
→ **Runner** → **Signing & Capabilities** → **Automatically manage signing**
белгиленген, **Team** тандалган болушу керек. Ал жерде **Sign in with Apple**
да көрүнүшү керек.

## Кадам 5 — App Store Connect'те колдонмо түзүү

<https://appstoreconnect.apple.com> → **My Apps** → **+** → **New App**

| Талаа | Мааниси |
|---|---|
| Platforms | iOS |
| Name | `JashMen` |
| Primary Language | Russian (же Kyrgyz жок болсо English) |
| Bundle ID | `com.jashmenstudio.jashmen` |
| SKU | `jashmen-ios-001` (каалаган уникалдуу сап) |
| User Access | Full Access |

## Кадам 6 — Жүктөө

```bash
xcrun altool --upload-app -f build/ios/ipa/jashmen.ipa \
  -t ios -u СИЗДИН@APPLE.ID --password app-тиешелүү-сырсөз
```

App-specific password'ду <https://account.apple.com> → Sign-In and Security →
App-Specific Passwords дегенден аласыз.

**Же жөнөкөйүрөөк:** App Store Connect'тин **Transporter** колдонмосун
Mac App Store'дон бекер жүктөп, `.ipa` файлды сүйрөп таштасаңыз болот.

Жүктөлгөндөн кийин **20–40 мүнөт** иштетилет, анан билд App Store
Connect'те көрүнөт.

## Кадам 7 — Барактын маалыматын толтуруу

Даяр тексттер төмөндө — көчүрүп коё бериңиз.

## Кадам 8 — Текшерүүгө жөнөтүү

**Add for Review** → **Submit**. Жооп адатта **24–48 сааттын** ичинде келет.

---

# App Store барагы үчүн даяр тексттер

## Аталышы (30 белгиге чейин)

```
JashMen — каржы сабаттуулугу
```

Орусча башкы тил болсо:
```
JashMen: финансы для студентов
```

## Subtitle (30 белгиге чейин)

```
Учись деньгам через игру
```

## Promotional text (170 белги, качан болбосун өзгөртсө болот)

```
Короткие уроки о деньгах на кыргызском, русском и английском. Серия дней,
монеты и лига между университетами — учись каждый день и собирай очки для
своего вуза.
```

## Description

```
JashMen — приложение, которое учит обращаться с деньгами. Короткие уроки,
задания и мгновенная проверка: пять минут в день вместо учебника.

УРОКИ, КОТОРЫЕ ДОХОДЯТ
Накопления, банковские карты, кредиты, защита от мошенников, основы
инвестиций. Каждая тема — это несколько коротких уроков с примерами из
жизни в Кыргызстане, а не абстрактные схемы.

НА ТРЁХ ЯЗЫКАХ
Кыргызский, русский и английский. Язык переключается в один тап, прогресс
остаётся общим.

СЕРИЯ, КОТОРАЯ ДЕРЖИТ
Занимайтесь каждый день — серия растёт. Пропустили день, и она сгорает.
Это простое правило и есть причина вернуться завтра.

ЛИГА УНИВЕРСИТЕТОВ
Выберите свой вуз, и заработанные очки идут в его общий счёт. Один студент
тянет за собой группу, а кампусы соревнуются между собой весь сезон.

МОНЕТЫ И НАГРАДЫ
За пройденные уроки начисляются монеты. Их нельзя купить — только заработать.
В магазине монеты обмениваются на настоящие призы от партнёров.

БЕСПЛАТНО, БЕЗ РЕКЛАМЫ
Никакой рекламы, никаких встроенных покупок, никакой слежки. Мы не продаём
ваши данные и не подключаем аналитические SDK.

—
Уроки носят общеобразовательный характер и не являются персональной
финансовой консультацией.

Условия: https://jashmenstudio.com/terms
Конфиденциальность: https://jashmenstudio.com/privacy
Удаление аккаунта: https://jashmenstudio.com/delete-account
```

## Keywords (100 белги, үтүр менен, боштуксуз)

```
финансы,деньги,обучение,студент,кыргызча,накопления,бюджет,грамотность,уроки,банк,карта,инвестиции
```

## Support URL

```
https://jashmenstudio.com
```

## Marketing URL

```
https://jashmenstudio.com
```

## Copyright

```
2026 JashMen Studio
```

## Category

- Primary: **Education**
- Secondary: **Finance**

## What's New (биринчи версия)

```
Первая версия JashMen.
```

---

# Скриншоттор

App Store сөзсүз талап кылат. **6.9" iPhone** үчүн эң аз **3**, көбү 10.

Кантип алуу:

```bash
# 1. Симуляторду көтөрүү (6.9" = iPhone 17 Pro Max же 16 Pro Max)
xcrun simctl list devices available | grep "Pro Max"
xcrun simctl boot "iPhone 17 Pro Max"
open -a Simulator

# 2. Колдонмону иштетүү
cd mobile && flutter run -d "iPhone 17 Pro Max"

# 3. Кирип, ар бир экранды ачып, сүрөткө тартуу
xcrun simctl io booted screenshot ~/Desktop/shot-1-learn.png
xcrun simctl io booted screenshot ~/Desktop/shot-2-lesson.png
xcrun simctl io booted screenshot ~/Desktop/shot-3-league.png
xcrun simctl io booted screenshot ~/Desktop/shot-4-shop.png
xcrun simctl io booted screenshot ~/Desktop/shot-5-streak.png
```

Эмнени тартуу керек (ушул беш экран эң жакшы сүйлөйт):

1. **Окуу жолу** — модулдар жана сабактар көрүнгөн башкы экран
2. **Сабактын суроосу** — жооп тандап жаткан учур
3. **Университет лигасы** — таблица жана упайлар
4. **Дүкөн** — сыйлыктар жана монеталар
5. **Серия майрамдоо** — «3 күндүк серия!» экраны

> Экрандын өлчөмү 1320×2868 болушу керек. `xcrun simctl io` так ошондой
> берет — кол менен кесүүнүн кереги жок.


---

# Кол коюу: эмне үчүн Release колго коюлган

`Release` конфигурациясы **Manual** кол коюуда: `Apple Distribution` +
профиль `JashMen AppStore`. `Debug` автоматтык бойдон калган.

**Себеби:** автоматтык кол коюу архивди *Development* профили менен жасайт,
ал үчүн командада кеминде бир катталган iPhone керек. Дистрибуция профили
түзмөк талап кылбайт.

**Профиль жаңыртуу керек болгондо** (жылына бир жолу, 2027-09-24де бүтөт):
developer.apple.com → Profiles → `JashMen AppStore` → Edit → Generate →
Download → эки жолу басып орнотуңуз. Андан кийин `flutter build ipa`.

**iPhone кошулса**, автоматтык кол коюуга кайтса болот: `CODE_SIGN_STYLE`
жана `PROVISIONING_PROFILE_SPECIFIER` дегенди Release'тен алып салыңыз.

Bundle id iOS үчүн `com.jashmenstudio.app` (Android: `com.jashmenstudio.jashmen`).
Серверде `APPLE_BUNDLE_ID` ушуга дал келиши керек.
