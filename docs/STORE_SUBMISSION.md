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

**App Store** (сөзсүз керек):
- 6.9" iPhone (1320×2868) — **эң аз 3, көбү 10**
- 6.5" iPhone (1242×2688) — Apple сурашы мүмкүн

**Play** (сөзсүз керек):
- Телефон: эң аз **4**, 1080×1920 же чоңураак
- **Feature graphic: 1024×500** — ансыз чыгарууга болбойт
- Иконка: 512×512 PNG

Эмнени тартуу керек (эң жакшы 5): окуу жолу · сабактын суроосу · университет
лигасы · дүкөн жана сыйлык · серия майрамдоо.

### Сүрөттөмө үчүн эскертүү

Сүрөттөмөдө **«акысыз сыйлык», «утуп ал», «байге»** деген сөздөрдү
колдонбоңуз — алар жарнамалык-кумар текшерүүсүнө түшүрөт. Анын ордуна:
«окуп үйрөн», «монета топто», «университетиңиз үчүн упай чогулт».

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
