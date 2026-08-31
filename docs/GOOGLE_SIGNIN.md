# Sign in with Google — setup

Код даяр жана деплой болгон, бирок `GOOGLE_CLIENT_ID` коюлмайынча
**өчүк**: Google баскычы такыр көрүнбөйт жана `POST /u/auth/google` 503
кайтарат. Email/пароль менен кирүү мурункудай иштей берет.

Бул документ — ошол ачкычтарды кантип алуу.

---

## 1. Google Cloud долбоору

1. [console.cloud.google.com](https://console.cloud.google.com) → жогорудан
   **Select a project** → **NEW PROJECT**
2. Аты: `JashMen` → **CREATE**

## 2. OAuth consent screen

**APIs & Services → OAuth consent screen**

| Талаа | Мааниси |
|---|---|
| User Type | **External** |
| App name | `JashMen` |
| User support email | `jashmenstudio@gmail.com` |
| App logo | `public/logo.png` (милдеттүү эмес) |
| Application home page | `https://jashmenstudio.com` |
| Privacy policy link | `https://jashmenstudio.com/privacy` |
| Developer contact | `jashmenstudio@gmail.com` |

**Scopes:** `email`, `profile`, `openid` — башкасы керек эмес.

> ⚠️ Publishing status **Testing** бойдон калса, «Test users» тизмесиндеги
> 100 аккаунт гана кире алат. Баары үчүн ачуу керек болсо —
> **PUBLISH APP**. Биз сурай турган scope'тор «sensitive» эмес, ошондуктан
> Google'дун текшерүүсү (verification) талап кылынбайт.

## 3. Web client ID

**APIs & Services → Credentials → CREATE CREDENTIALS → OAuth client ID**

- Application type: **Web application**
- Name: `JashMen Web`

**Authorized JavaScript origins** — так ушулар (порт менен, аягында `/` жок):

```
https://jashmenstudio.com
http://localhost:5173
```

**Authorized redirect URIs** — **бош калтырыңыз.**
Google Identity Services `id_token` режиминде redirect колдонбойт; бул
талаа authorization-code агымы үчүн гана. Биз кодду эмес, тактамасын
(id_token) алабыз.

**CREATE** → чыккан `Client ID` (`...apps.googleusercontent.com`) —
бул `GOOGLE_CLIENT_ID`.

## 4. Серверге коюу

```bash
ssh -p 54251 studio_adm@178.217.174.176
cd /opt/jashmen
nano admin-api/.env.production      # GOOGLE_CLIENT_ID=... кошуңуз
docker compose restart jashmen
```

Текшерүү:
```bash
curl https://jashmenstudio.com/admin/api/public/config
# {"googleClientId":"...apps.googleusercontent.com"}  → баскыч көрүнөт
```

---

## Мобилдик колдонмо

Мобилдик баскыч да `GET /public/config`тен окуйт — башкача айтканда
серверде `GOOGLE_CLIENT_ID` коюлганда, **колдонмону кайра курбастан**,
кийинки ачылышында эле баскыч пайда болот. `--dart-define` дагы иштейт,
бирок ал эми милдеттүү эмес (сервер жооп бербей турган учур үчүн гана).

iOS менен Android web client ID'ди колдоно албайт — Google ар бирине
өзүнчө талап кылат.

### iOS

1. Credentials → **CREATE CREDENTIALS → OAuth client ID → iOS**
2. Bundle ID: `com.jashmenstudio.jashmen`
3. Чыккан **iOS client ID** жана **Reversed client ID** алынат
4. `mobile/ios/Runner/Info.plist` ичиндеги даяр `CFBundleURLTypes` блогун
   комментарийден чыгарып, ага **reversed client ID**'ди коюңуз
   (`com.googleusercontent.apps.…`). Бул бирден-бир build-time жөндөө:
   iOS URL scheme'ди колдонмо ачылганда окуйт, аны серверден берүү мүмкүн
   эмес.
5. Серверге: `GOOGLE_CLIENT_ID_IOS=<iOS client ID>` — колдонмо аны
   `/public/config`тен өзү алат

### Android

1. Signing ачкычтын SHA-1'ин алуу:
   ```bash
   keytool -list -v -keystore ~/jashmen-upload.jks -alias upload
   ```
2. Credentials → **OAuth client ID → Android**
3. Package name: `com.jashmenstudio.jashmen`, SHA-1: жогоркусу
4. Android өзүнчө audience талап кылбайт — id_token'ди **web** client
   ID'ге сурайт, ошондуктан колдонмодо да, backend'де да кошумча эч нерсе
   керек эмес

### Куруу

Эч кандай кошумча флагсыз:

```bash
flutter build appbundle --release
```

Эгер сервер `/public/config`ти азырынча бербей турса, эски жол дагы бар:

```bash
flutter build appbundle --release \
  --dart-define=GOOGLE_SERVER_CLIENT_ID=<WEB client ID> \
  --dart-define=GOOGLE_IOS_CLIENT_ID=<iOS client ID>
```

> `GOOGLE_SERVER_CLIENT_ID` — бул **web** client ID (iOS/Android эмес).
> Google ошону `audience` кылып id_token берет, ал эми backend так ошону
> күтөт.

---

## Кантип иштейт

```
Клиент                          Backend
──────                          ───────
Google менен кирүү
  ↓ id_token
POST /u/auth/google  ─────────→ verifyIdToken(audience: [web, ios, android])
                                  ↓ email_verified === true текшерүү
                                  ↓ колдонуучуну табуу / байлаштыруу / түзүү
                                ← { token, user } + httpOnly refresh cookie
Сессия — email/пароль
менен киргендей эле
```

**id_token сакталбайт жана логго жазылбайт** — верификациядан кийин ошол
замат унутулат. Сервер өзүнүн JWT'син берет, калганынын баары мурункудай.

### Аккаунттарды байлаштыруу

| Абал | Натыйжа |
|---|---|
| Google `sub` мурун байланышкан | Кирет |
| Ошол email пароль менен катталган | **Автоматтык байлашат**, пароль сакталат — эки жол менен тең кирсе болот |
| Мындай email жок | Жаңы аккаунт түзүлөт, паролсуз |

Автоматтык байлаштыруу коопсуз, анткени `email_verified !== true` болсо
токен таптакыр четке кагылат — башкача айтканда Google ошол почта
чын эле бул адамдыкы деп тастыктаган.

⚠️ Паролсуз аккаунт `/u/login` аркылуу кире албайт — ага «бул аккаунт
Google аркылуу түзүлгөн» деген түшүнүктүү жооп кайтат.

---

## Rate limiting

Google кошулганда, буга чейин таптакыр жок болгон коргоо да кошулду
([rateLimit.js](../admin-api/rateLimit.js)):

| Endpoint | Чектөө |
|---|---|
| `/u/login`, `/u/auth/google` | 15 мүнөттө 20 |
| `/u/signup` | 1 сааттa 10 |
| `/admin/api/admin/login` | 15 мүнөттө 10 |

Эсептөө `req.ip` боюнча, ал үчүн `server.js`те `trust proxy = 2`
(агайдын NPM + биздин nginx). Бир нече replica иштетилсе, эсептегичти
Redis'ке которуу керек — болбосо ар бир replica өз чегин санайт.
