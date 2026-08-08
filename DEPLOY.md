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
Client → HTTPS(443) → Nginx Proxy Manager (Docker) → HTTP → jashmen app (Docker, ички порт 3030)
```

Эки Docker контейнер, `docker-compose.yml` менен башкарылат:

| Сервис    | Эмне кылат                                                        | Тышка ачык порт |
|-----------|--------------------------------------------------------------------|------------------|
| `npm`     | Nginx Proxy Manager — SSL (Let's Encrypt), reverse proxy           | 80, 443 (админ UI 81 — **localhost гана**) |
| `jashmen` | Node/Express: frontend (dist/) + backend API (/admin/api)          | Жок (ички тармак аркылуу гана, NPM аны `jashmen:3030` деп табат) |

## Сервер

- IP: `178.217.174.176`, SSH порту: **54251**, колдонуучу: `studio_adm`
- Долбоор жайгашкан жер: `/opt/jashmen`
- Production сырлар: `/opt/jashmen/admin-api/.env.production` (серверде
  гана, git'ке эч качан коммит болбойт — `.gitignore`деги `.env*` эрежеси
  муну камсыз кылат)
- Логин/пароль ушул файлда сакталбайт — агайдан же долбоордун ээсинен сура

## Жаңылоо (deploy)

Учурда GitHub'го `git push` иштебей жатат (`IliasBekazarov` аккаунтунун
`iliasdevkg/jashmen` репозиторийине жазуу укугу жок — collaborator катары
кошуу керек). Ошондуктан азыркы жаңылоо жолу — түз tar/scp:

```bash
# Локалдо, долбоордун түбүндө:
tar czf /tmp/jashmen-deploy.tar.gz \
  --exclude=node_modules --exclude=.git --exclude=dist \
  --exclude=admin-api/data --exclude=.vite --exclude=.gstack \
  --exclude=.vercel --exclude=.env.local --exclude=admin-api/.env \
  .

scp -P 54251 /tmp/jashmen-deploy.tar.gz studio_adm@178.217.174.176:/tmp/

ssh -p 54251 studio_adm@178.217.174.176 '
  rm -rf /opt/jashmen_new && mkdir /opt/jashmen_new &&
  tar xzf /tmp/jashmen-deploy.tar.gz -C /opt/jashmen_new &&
  cp /opt/jashmen/admin-api/.env.production /opt/jashmen_new/admin-api/.env.production &&
  rm -rf /opt/jashmen && mv /opt/jashmen_new /opt/jashmen &&
  cd /opt/jashmen && docker compose up -d --build
'
```

GitHub push түзөтүлгөндөн кийин, идеалдуу жол: сервердеги `/opt/jashmen`'ди
`git clone`/`git pull`'го которуу — азырынча tar/scp менен иштейбиз.

## Секреттерди алмаштыруу (rotate)

```bash
ssh -p 54251 studio_adm@178.217.174.176
cd /opt/jashmen
nano admin-api/.env.production   # керектүү маанини алмаштыр
docker compose restart jashmen
```

## NPM админ панелине кирүү

Порт 81 сыртка ачык эмес (коопсуздук үчүн). SSH tunnel аркылуу гана:

```bash
ssh -p 54251 -L 8181:localhost:81 studio_adm@178.217.174.176
# андан кийин браузерде: http://localhost:8181
```

## Маселе чыкса (troubleshooting)

```bash
ssh -p 54251 studio_adm@178.217.174.176
cd /opt/jashmen
docker compose ps               # контейнерлер иштеп жатабы
docker compose logs -f jashmen  # backend логдору
docker compose logs -f npm      # reverse proxy логдору
```

**SSH такыр кирбей калса** (бул мурун бир жолу болгон): firewall'га
эч кандай өзгөртүү киргизбе — упstream firewall жагынан текшер, же
console/VNC аркылуу түз кир.
