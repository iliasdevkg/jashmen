# Промпт: JashMen веб-колдонмосун Flutter'ге 1:1 которуу

> Төмөнкү текстти толугу менен көчүрүп, Claude'га (же башка AI'га) бериңиз.
> Репону да ачып бериңиз: `https://github.com/iliasdevkg/jashmen`

---

## КОНТЕКСТ

Менде `jashmenstudio.com` дарегинде иштеп турган React (Vite) веб-колдонмосу бар — кыргыз тилиндеги **каржы сабаттуулугу боюнча Duolingo стилиндеги окуу колдонмосу**. Сенин милдетиң — ошону **Flutter'де 1:1 кайталоо** (iOS + Android).

**Маанилүү:** backend'ди кайра жазуунун кереги ЖОК. Ал иштеп турат жана өзгөрбөйт. Сен Flutter клиентин гана жазасың, ал ошол эле REST API'ге кайрылат.

**Булак коду:** `https://github.com/iliasdevkg/jashmen`
- `src/` — React колдонмосу (сен кайталай турган нерсе)
- `src/pages/` — экрандар
- `src/components/` — компоненттер
- `src/locales/` — котормолор (ky/ru/en)
- `src/store.jsx` — абалды башкаруу
- `src/utils.js` — эсептөө логикасы (энергия, статус, тартип)
- `admin-api/routes.js` — API маршруттары (окуп үйрөн, өзгөртпө)

---

## ТАПШЫРМА

`jashmenstudio.com` веб-колдонмосунун **1:1 Flutter версиясын** жаз.

"1:1" деген эмнени билдирет:
- ✅ Ар бир экран, ар бир баскыч, ар бир абал (loading/error/empty/success)
- ✅ Ошол эле логика (XP, серия, энергия, монеталар, лига, жетишкендиктер)
- ✅ Ошол эле котормолор (кыргызча/орусча/англисче)
- ✅ Ошол эле түстөр, ошол эле анимациялардын мааниси
- ❌ Пиксель-пиксель көчүрүү ЭМЕС — нативдүү мобилдик сезим болушу керек

---

## BACKEND API — өзгөрбөйт

**Base URL:** `https://jashmenstudio.com/admin/api`

### Аутентификация
| Метод | Жол | Түшүндүрмө |
|---|---|---|
| POST | `/u/signup` | `{name, email, password}` → `{token, user}` |
| POST | `/u/login` | `{email, password}` → `{token, user}` |
| POST | `/u/refresh` | httpOnly cookie аркылуу → жаңы `{token}` |
| POST | `/u/logout` | сессияны жабат |

⚠️ **Маанилүү нюанс:** access token 15 мүнөт жашайт, refresh token **httpOnly cookie'де**. Веб-браузер аны автоматтык жиберет, ал эми **Flutter'де cookie'ни өзүң башкарышың керек** — `dio` + `cookie_jar` (`PersistCookieJar`) колдон, же backend командасы менен сүйлөшүп Bearer-refresh кошуп ал. Бул эң оңой унутулуп кала турган жер — 401 келгенде автоматтык refresh кылып, суроону кайталоо интерцептору болушу керек.

### Контент жана колдонуучу
| Метод | Жол | Auth | Түшүндүрмө |
|---|---|---|---|
| GET | `/public/content` | жок | Бүт контент (төмөндө схемасы) |
| GET | `/u/leaderboard` | жок | Лига таблицасы |
| GET | `/u/me` | ✅ | Колдонуучунун абалы |
| POST | `/u/me/lesson` | ✅ | Сабак бүттү → XP/монета берет |
| POST | `/u/me/daily` | ✅ | Күнүмдүк бонус |
| POST | `/u/me/buy` | ✅ | Дүкөндөн сатып алуу |
| POST | `/u/me/redeem` | ✅ | Сыйлык алмаштыруу |
| PATCH | `/u/me/state` | ✅ | Жөндөөлөрдү сактоо |
| POST | `/u/log-event` | ✅ | Аналитика |

### `/public/content` схемасы
```jsonc
{
  "modules": [{
    "id": "string",
    "title": "string",
    "color": "#1CB0F6",        // модулдун түсү — жол/түйүн ушундан боёлот
    "iconUrl": "string|null",  // админ жүктөгөн иконка, null болсо — өз иконкаң
    "partnerId": "string|null",
    "lessons": [{
      "id": "string",
      "title": "string",
      "iconUrl": "string|null",
      "cards": [                // сабактын мазмуну — ирети маанилүү
        { "type": "theory", "title": {"ky":"","ru":""}, "body": {"ky":"","ru":""}, "imageUrl": "" },
        { "type": "media",  "imageUrl": "" },
        { "type": "quiz",   "q": {"ky":"","ru":""}, "opts": [{"ky":"","ru":""}], "a": 0, "imageUrl": "" }
      ]
    }]
  }],
  "leagues":      [{ "id","name","iconUrl","color","minXp" }],
  "achievements": [{ "id","title","desc","iconUrl","xp","rule" }],
  "shop_items":   [{ "id","title","desc","price","effect" }],
  "partners":     [{ "id","name","logoUrl" }],
  "prizes":       [...],
  "limits":       { "dailyFreeLessons": 3, "dailyPrizeCap": 5 }
}
```

⚠️ Текст талаалары **эки тилдүү** (`{ky, ru}`). Эски контентте жөн эле `"string"` болушу мүмкүн — экөөнү тең иштете турган helper жаз (`ky` жок болсо fallback).

### Колдонуучунун абалы (`/u/me`)
```jsonc
{
  "xp": 0,
  "coins": 50,                 // "Jashmen Coins", баштапкы баланс
  "streak": 0,                 // катары менен күн
  "lessonsToday": 0,
  "energyDate": null,
  "bonusEnergyToday": 0,
  "completedLessons": [],      // сабак id'лери
  "achievements": [],
  "ownedShop": [],
  "settings": { "sound": true, "animations": true },
  "lastActiveDate": null,
  "hasStreakShield": false,
  "hasXpBoost": false,
  "vipBadge": false
}
```

---

## ЭКРАНДАР — баары керек

| # | Экран | React'те | Мазмуну |
|---|---|---|---|
| 1 | **Кирүү/Катталуу** | `AuthPage.jsx` | Логин + катталуу, каталарды көрсөтүү |
| 2 | **Окуу (башкы)** | `LearnPage.jsx` | ⭐ Эң татаал — төмөндө өзүнчө |
| 3 | **Сабак** | `LessonPage.jsx` | Карталар: теория → медиа → квиз, прогресс тилкеси, натыйжа |
| 4 | **Лига** | `LeaguePage.jsx` | Рейтинг таблицасы, лига значкалары |
| 5 | **Дүкөн** | `ShopPage.jsx` | Монетага сатып алуу, сыйлыктар |
| 6 | **Профиль** | `ProfilePage.jsx` | Статистика, жетишкендиктер, аватар |
| 7 | **Жөндөөлөр** | `SettingsPage.jsx` | Тил, тема, үн, анимация, чыгуу |

### ⭐ Окуу экраны (LearnPage) — эң маанилүү деталь

Duolingo сыяктуу **ийри-буйру жол** (winding path):
- Түйүндөр синус ийри сызыгы боюнча жайгашат (`nodePositions()` — `src/pages/LearnPage.jsx`)
- Түйүндөрдүн ортосунда **тегиз ийри сызык** (Catmull-Rom → cubic Bézier, `smoothPath()`)
- Түйүндүн 3 абалы: `locked` (кулпу), `completed` (белги), `available` (кийинки — чоңураак, "калкып турат")
- Акыркы сабак = **checkpoint** — башка формадагы кенен карта
- Модулдун башында — иконка менен аталыш
- Энергия түгөнсө — эскертүү баннери жана таймер

**Flutter'де:** `CustomPainter` менен жолду чий, түйүндөрдү `Stack` + `Positioned` менен кой. Логиканы `src/utils.js`'тен көчүр (`getLessonOrder`, `getLessonStatus`, `computeLiveEnergy`).

---

## БИЗНЕС-ЛОГИКА — так кайтала

`src/utils.js` файлын окуп, ушуларды 1:1 көчүр:

1. **Энергия:** күнүнө `limits.dailyFreeLessons` (демейде 3) бекер сабак. Түн ортосунда жаңырат. `computeLiveEnergy()` — калганын жана таймерди эсептейт.
2. **Сабактын статусу:** мурункусу бүтмөйүнчө кийинкиси кулпуланган. `getLessonStatus()`.
3. **Серия (streak):** катары менен күн. `hasStreakShield` — бир күн өткөрүп жиберүүнү кечирет.
4. **XP жана монета:** сабак бүткөндө сервер берет. `hasXpBoost` — көбөйтөт.
5. **Лига:** `xp` боюнча `leagues[].minXp` менен аныкталат.
6. **Жетишкендиктер:** сервер `rule` боюнча текшерет, клиент жөн гана көрсөтөт.

---

## ДИЗАЙН

### Түстөр
```dart
// Негизги
const primary   = Color(0xFF1CB0F6);  // көк — негизги акцент
const success   = Color(0xFF58CC02);  // жашыл — туура жооп, бүткөн
const danger    = Color(0xFFFF4B4B);  // кызыл — ката
const warning   = Color(0xFFFF9600);  // сары — серия/от
const purple    = Color(0xFFCE82FF);

// Күңүрт тема (демейки)
const bgDark    = Color(0xFF0F172A);
const cardDark  = Color(0xFF1E293B);
const borderDk  = Color(0xFF334155);

// Жарык тема ("bright mode")
const bgLight   = Color(0xFFF8FAFC);
const cardLight = Color(0xFFFFFFFF);
```

⚠️ **Эки тема тең керек** — веб-колдонмодо "bright mode" которгучу бар (`useBrightMode`).

### Кыймыл (motion)
Веб-версия `framer-motion` колдонот. Flutter'де ошол эле сезимди бер:
- Баскыч басканда: `scale 0.9` (spring)
- Кийинки сабактын түйүнү: жай "калкыган" анимация (bob)
- Экран которулганда: жумшак өтүү
- **Анимация маани берүү үчүн, кооздук үчүн эмес**
- `settings.animations = false` болсо — баарын өчүр

### Типографика
- Аталыштар: калың (w800), тыгыз
- Иерархия дароо окулушу керек
- Аралыктар: 4px тутуму (4, 8, 12, 16, 24, 32)

---

## ТЕХНИКАЛЫК ТАЛАПТАР

```yaml
# Сунушталган стек — башкасын тандасаң, себебин жаз
dependencies:
  flutter_riverpod: ^2.x      # абалды башкаруу
  dio: ^5.x                   # HTTP
  cookie_jar: ^4.x            # refresh cookie үчүн (МИЛДЕТТҮҮ)
  dio_cookie_manager: ^3.x
  go_router: ^14.x            # навигация
  flutter_secure_storage: ^9.x # access token
  cached_network_image: ^3.x  # iconUrl сүрөттөрү
  intl: ^0.19.x               # ky/ru/en
```

**Милдеттүү:**
- ✅ Null-safety, `dynamic` колдонбо
- ✅ Ар бир API жообу үчүн typed модель (`freezed` же кол менен)
- ✅ Ар бир экранда: loading (skeleton, жөн эле spinner эмес), error (кайталоо баскычы менен), empty (маанилүү текст)
- ✅ Оффлайн: тармак жок болсо түшүнүктүү билдирүү
- ✅ 401 → автоматтык refresh → суроону кайталоо
- ✅ Кыргызча, орусча, англисче (`src/locales/` файлдарынан көчүр)
- ✅ Accessibility: `Semantics`, тийүү аймагы ≥44px

**Тыюу салынат:**
- ❌ `// TODO`, `placeholder`, жасалма маалымат
- ❌ Backend'ди өзгөртүү
- ❌ Иштебей турган код

---

## ИШТИН ТАРТИБИ

Баарын бир жолу жазба. Ушундай тартипте жүр, ар бир этаптан кийин мага көрсөт:

1. **Изилдөө** — репону оку, API'ди сына (`curl https://jashmenstudio.com/admin/api/public/content`), суроолоруң болсо азыр бер
2. **Скелет** — долбоордун түзүлүшү, моделдер, API кабаты, auth (refresh менен кошо)
3. **Экран 1-2** — Кирүү + Окуу (ийри жол менен)
4. **Экран 3** — Сабак (карталар, квиз, натыйжа)
5. **Экран 4-7** — Лига, Дүкөн, Профиль, Жөндөөлөр
6. **Жылмалоо** — анимациялар, темалар, i18n, каталарды иштетүү
7. **Куруу** — Android APK + iOS build, скриншоттор

**Ар бир этапта:** эмне бүткөнүн, эмне калганын, кандай чечим кабыл алганыңды жаз.

---

## СЫНОО ҮЧҮН

Иштеп турган сервер: `https://jashmenstudio.com`

```bash
# Контентти көрүү
curl https://jashmenstudio.com/admin/api/public/content | jq

# Тест аккаунт түзүү
curl -X POST https://jashmenstudio.com/admin/api/u/signup \
  -H 'Content-Type: application/json' \
  -d '{"name":"Test","email":"test@example.com","password":"test1234"}'
```

---

## БАШТАЛЫШ

Алгач репону изилде жана мага айт:
1. Түшүнүксүз жерлер барбы?
2. Кайсы бөлүгү эң татаал деп ойлойсуң?
3. Сунушталган стек менен макулсуңбу, же башкасын сунуштайсыңбы жана эмне үчүн?

Андан кийин 2-этаптан башта.
