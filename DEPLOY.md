# JashMen — production deploy (VPS)

Кыскача: `jashmenstudio.com` GitHub'дон (`iliasdevkg/jashmen`) эмес, түз
эле VPS'ке Docker аркылуу иштейт. Бул файл — ошол серверди кантип иштетүү,
жаңылоо жана бузбай кармоо боюнча колдонмо.

## ⚠️ Firewall — ТИЙБӨӨ

**Бул сервер мурунтан эле негизги (upstream) firewall'дун артында турат.**
Сервердин өзүндө (`ufw`) кошумча firewall орнотуу/иштетүү **КЕРЕК ЭМЕС** —
бул өзүбүздү бөгөттөп коюуга алып келет (8-август күнү так ушундан улам
SSH бир нече саат жабылып калган болчу).

Эрежелер:
- `ufw enable`, `ufw default deny` — **эч качан колдонбоо**
- Эгер бир нерсе ачуу керек болсо — **гана `ufw allow <port>`** түрүндөгү
  кошумча эреже (allow-only), эч качан `deny`/`block` эрежесин кошпоо
- Порт ачуу/жабуу керек болсо — алгач негизги (upstream) firewall кайсы
  жерде башкарылганын агайдан/администратордон сура

## Архитектура

```
Client
  ↓ HTTPS(443)
Nginx Proxy Manager — агайдын тарабы, коомдук IP 178.217.174.176
(openresty; SSL ушул жерде бүтөт)
  ↓ HTTP(80) → 192.168.100.87
nginx — бул VPS, нативдүү (Docker эмес)
  ↓ proxy_pass → 127.0.0.1:3030
jashmen app — Docker контейнер
```

**Тармак топологиясы (маанилүү):**

| Нерсе | Мааниси |
|-------|---------|
| Коомдук IP `178.217.174.176` | **агайдын NPM'и**, биздин VPS эмес (`Server: openresty` кайтарат) |
| Биздин VPS'тин ички IP'си | **`192.168.100.87`** (`ens160`), gateway `192.168.100.1` |
| NPM'де болушу керек болгон proxy host | `jashmenstudio.com` → **`http://192.168.100.87:80`** |

SSH (54251-порт) NAT аркылуу биздин VPS'ке багытталган — ошондуктан SSH
коомдук IP менен иштейт, ал эми 80/443 порттору агайдын NPM'ине барат.

**⚠️ SSL бул серверде ЖОК жана керек эмес.** TLS сырткы proxy'де бүтөт, ал
бизге plain HTTP менен 80-портко жиберет. Ошондуктан бул VPS'те:

- ❌ certbot / Let's Encrypt сертификат — **керек эмес**
- ❌ `listen 443 ssl` — **керек эмес**
- ❌ http→https redirect — **керек эмес**
- ❌ NPM / кошумча reverse-proxy контейнер — **керек эмес**
- ✅ жөн гана nginx `listen 80` + `proxy_pass` → контейнер

(8-август сабагы: бир жолу мен ушул эле VPS'ке кошумча NPM орнотуп, 80/443
порттору боюнча сырткы proxy менен кагылышкам — сайт ошондон улам
404/timeout/504 аралашын берип турду. Андан кийин certbot менен өз
сертификатыбызды алууга аракет кылдым — ал да туура эмес болчу, анткени
Let's Encrypt'тин challenge'и бизге жетпейт, трафик сырткы proxy'де токтойт.
Эреже: **бул VPS'те SSL'ге тиешелүү эч нерсе кылбоо**.)

Бир гана Docker контейнер, `docker-compose.yml` менен башкарылат:

| Сервис    | Эмне кылат                                                        | Порт |
|-----------|--------------------------------------------------------------------|------|
| `jashmen` | Node/Express: frontend (dist/) + backend API (/admin/api)          | `127.0.0.1:3030` (сыртка ачык эмес, nginx гана жетет) |

nginx конфигурациясы репозиторийде: [deploy/nginx/jashmenstudio.com.conf](deploy/nginx/jashmenstudio.com.conf)
→ серверде `/etc/nginx/sites-available/jashmenstudio.com`

## Сервер

- IP: `178.217.174.176`, SSH порту: **54251**, колдонуучу: `studio_adm`
- Долбоор жайгашкан жер: `/opt/jashmen`
- Production сырлар: `/opt/jashmen/admin-api/.env.production` (серверде
  гана, git'ке эч качан коммит болбойт — `.gitignore`деги `.env*` эрежеси
  муну камсыз кылат)
- Кирүү: `ssh jashmen` (ачкыч менен, төмөндө кара)

## Серверге кирүү

```bash
ssh jashmen          # ~/.ssh/config'теги алиас — паролсуз, ачкыч менен
scp file jashmen:/tmp/
```

Ачкыч `~/.ssh/id_ed25519_jashmen`, ал сервердеги `authorized_keys`те. Пароль
керек эмес.

**Күнүмдүк деплой `sudo`'суз иштейт:** `studio_adm` `docker` тобунда жана
`/opt/jashmen`дин ээси. `sudo` бир гана хост деңгээлиндеги өзгөртүүлөргө
керек (nginx конфигурациясы, пакет орнотуу) — анда пароль сурайт, ал
`~/Desktop/1.txt` файлында.

## Жаңылоо (deploy)

Учурда GitHub'го `git push` иштебей жатат (`IliasBekazarov` аккаунтунун
`iliasdevkg/jashmen` репозиторийине жазуу укугу жок — collaborator катары
кошуу керек). Ошондуктан азыркы жаңылоо жолу — түз tar/scp:

```bash
# Локалдо, долбоордун түбүндө:
npm run build            # dist/ жана admin/ жаңыртылат

tar czf /tmp/jashmen-deploy.tar.gz \
  --exclude=node_modules --exclude=.git --exclude=dist \
  --exclude=admin-api/data --exclude=.vite --exclude=.gstack \
  --exclude=.vercel --exclude=.env.local --exclude=admin-api/.env \
  --exclude=mobile \
  .

scp /tmp/jashmen-deploy.tar.gz jashmen:/tmp/

ssh jashmen '
  set -e
  # /opt is root-owned, so staging must live in the user home.
  rm -rf ~/jashmen_stage && mkdir -p ~/jashmen_stage
  tar xzf /tmp/jashmen-deploy.tar.gz -C ~/jashmen_stage

  # --delete clears stale files; the two excludes are what must survive
  # a release: production secrets and runtime data.
  rsync -a --delete \
    --exclude=admin-api/.env.production \
    --exclude=admin-api/data \
    ~/jashmen_stage/ /opt/jashmen/

  rm -rf ~/jashmen_stage
  cd /opt/jashmen && docker compose up -d --build
'
```

⚠️ `/opt/jashmen`ди бүтүндөй `mv` кылууга **болбойт** — `/opt` root'ко
таандык, ошондуктан жанына жаңы папка түзө албайсың. Ичиндегисин
`rsync` менен алмаштыруу керек.

Дайындар `jashmen_data` Docker volume'унда — `/opt/jashmen` алмашканы менен
жоголбойт.

GitHub push түзөтүлгөндөн кийин, идеалдуу жол: сервердеги `/opt/jashmen`'ди
`git clone`/`git pull`'го которуу — азырынча tar/scp менен иштейбиз.

## Секреттерди алмаштыруу (rotate)

```bash
ssh jashmen
cd /opt/jashmen
nano admin-api/.env.production   # керектүү маанини алмаштыр
docker compose restart jashmen
```

## nginx конфигурациясын жаңылоо

```bash
scp deploy/nginx/jashmenstudio.com.conf jashmen:/tmp/jashmenstudio.com.conf

ssh jashmen '
  sudo cp /tmp/jashmenstudio.com.conf /etc/nginx/sites-available/jashmenstudio.com &&
  sudo nginx -t && sudo systemctl reload nginx
'
```

`nginx -t` ийгиликсиз болсо — **reload кылба**, эски конфигурация иштей
берет; алгач катаны оңдо.

## Маселе чыкса (troubleshooting)

```bash
ssh jashmen

# 1. Контейнер иштеп жатабы (127.0.0.1:3030->3030/tcp көрүнүшү керек)
cd /opt/jashmen && docker compose ps
docker compose logs -f jashmen

# 2. App түз жооп берип жатабы (nginx'ти айланып өтүп)
curl -s http://127.0.0.1:3030/admin/api/health        # → {"ok":true}

# 3. nginx аркылуу жооп берип жатабы — Host башы МИЛДЕТТҮҮ
#    (server_name jashmenstudio.com, ансыз nginx 404 берет)
curl -s -H "Host: jashmenstudio.com" http://localhost/admin/api/health

# 4. nginx өзү тирүүбү
sudo systemctl status nginx
sudo tail -n 50 /var/log/nginx/error.log

# 5. Так NPM көрө турган сурам — ички IP аркылуу
curl -s -H "Host: jashmenstudio.com" http://192.168.100.87/admin/api/health
```

**Эгер 1–5 баары жакшы, бирок сайт сырттан ачылбаса** — маселе бул VPS'те
эмес. Текшер: сырттан `curl -sv http://178.217.174.176/ 2>&1 | grep Server`
эмне кайтарат?

- `Server: nginx/1.24.0 (Ubuntu)` → бул биздики, маселе бизде
- `Server: openresty` → бул **агайдын NPM'и**, трафик бизге жетпей ошол
  жерде токтоп жатат. Ал жагы агайдын тарабы: NPM'деги `jashmenstudio.com`
  proxy host'унун forward target'и **`http://192.168.100.87:80`** болушу
  керек (коомдук IP эмес — ал NPM'дин өзү, өзүнө өзү кайрылып калат).

**SSH такыр кирбей калса** (бул мурун бир жолу болгон): firewall'га
эч кандай өзгөртүү киргизбе — упstream firewall жагынан текшер, же
console/VNC аркылуу түз кир.
