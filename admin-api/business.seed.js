// admin-api/business.seed.js — the starting copy for https://jashmenstudio.com/
//
// Every word and every picture on the business site, so none of it needs a
// deploy to change. The panel's "Бизнес бет" tab edits this; the shape is
// declared once in contentStore.js#BUSINESS_SECTIONS and this file fills it.
//
// THE SHAPE OF THE OFFER, so nothing edited later contradicts it: JashMen
// sells a SEASON — one campus, one sponsor, eight weeks, a report at the
// end. The six "Решения" tabs are audiences, not products; the products are
// the module, the prizes, the league pool and the integration.
//
// Trilingual like the rest of the site. The page opens in Russian because
// the reader is usually a marketing or CSR lead in Bishkek, and the visitor
// can switch to Kyrgyz or English in the navbar.
//
// Two things on that page are deliberately absent from this file, because
// they are facts rather than copy: the counters under "Продукт работает
// сегодня" come from GET /public/stats, and the logos under "Нам доверяют"
// are the real partners and campuses from the same content store.

export const SEED_BUSINESS = {
  // ── Navigation ─────────────────────────────────────────────────────────
  nav: {
    enabled: true,
    solutions: { ky: 'Чечимдер', ru: 'Решения', en: 'Solutions' },
    partners: { ky: 'Өнөктөштөр', ru: 'Партнёрам', en: 'Partners' },
    integration: { ky: 'Интеграция', ru: 'Интеграция', en: 'Integration' },
    impact: { ky: 'Таасири', ru: 'Влияние', en: 'Impact' },
    product: { ky: 'Продукт', ru: 'Продукт', en: 'The product' },
    forStudents: { ky: 'Студенттерге', ru: 'Для студентов', en: 'For students' },
    cta: { ky: 'Өнөктөш болуу', ru: 'Стать партнёром', en: 'Become a partner' },
  },

  // ── Hero ───────────────────────────────────────────────────────────────
  // Four lines because the design breaks the headline by hand; the last two
  // wear the gradient. Leaving a line blank simply removes it.
  hero: {
    enabled: true,
    line1: { ky: 'Жүрүм-турумду', ru: 'Финансовое', en: 'Financial education' },
    line2: { ky: 'өзгөрткөн', ru: 'образование,', en: 'that changes' },
    line3: { ky: 'каржылык', ru: 'которое меняет', en: 'what people' },
    line4: { ky: 'билим', ru: 'поведение', en: 'actually do' },
    lead: {
      ky: 'JashMen уюмдарга өз аудиториясын оюн аркылуу каржы сабаттуулугуна '
        + 'тартууга, биргелешкен модулдарды түзүүгө жана тажрыйбаны өз '
        + 'платформасына киргизүүгө жардам берет.',
      ru: 'Jashmen помогает организациям вовлекать свою аудиторию в '
        + 'финансовое обучение через игру, создавать совместные модули и '
        + 'интегрировать опыт в свои платформы.',
      en: 'Jashmen helps organisations draw their audience into financial '
        + 'learning through play, build modules together with us, and bring '
        + 'the experience into their own platforms.',
    },
    primaryCta: { ky: 'Өнөктөш болуу', ru: 'Стать партнёром', en: 'Become a partner' },
    secondaryCta: { ky: 'Чечимдерди көрүү', ru: 'Смотреть решения', en: 'See the solutions' },
    videoLabel: { ky: 'Видеону көрүү', ru: 'Смотреть видео', en: 'Watch the video' },
    // Empty on purpose. No video means no play button at all — a control
    // that opens nothing is worse than an empty hero. An image here replaces
    // the animated artwork.
    imageUrl: '',
    videoUrl: '',
    videoPoster: '',
  },

  // ── The four properties ────────────────────────────────────────────────
  strip: {
    enabled: true,
    items: [
      { id: 'interactive', icon: 'rocket', label: { ky: 'Интерактивдүү', ru: 'Интерактивно', en: 'Interactive' } },
      { id: 'measurable', icon: 'trending-up', label: { ky: 'Ченелет', ru: 'Измеримо', en: 'Measurable' } },
      { id: 'scalable', icon: 'layers', label: { ky: 'Масштабдалат', ru: 'Масштабируемо', en: 'Scalable' } },
      { id: 'integrable', icon: 'network', label: { ky: 'Интеграцияланат', ru: 'Интегрируемо', en: 'Integrable' } },
    ],
  },

  // ── Trust strip ────────────────────────────────────────────────────────
  // Only the label is copy. The marks themselves are the real partners and
  // campuses from the content store — typing a logo in here is how a
  // marketing page starts lying.
  trust: {
    enabled: true,
    label: { ky: 'Бизге ишенишет', ru: 'Нам доверяют', en: 'Trusted by' },
    empty: {
      ky: 'Алгачкы өнөктөштөр ушул жерде пайда болот',
      ru: 'Первые партнёры появятся здесь',
      en: 'The first partners will appear here',
    },
  },

  // ── Why ────────────────────────────────────────────────────────────────
  why: {
    enabled: true,
    title: { ky: 'Эмне үчүн JashMen', ru: 'Почему Jashmen', en: 'Why Jashmen' },
    note: {
      ky: 'Биз көрсөтүү сатпайбыз. Биз көнүмүш куруп жатабыз: студент '
        + 'колдонмону өзү, күн сайын ачат жана ошол жерде акча жөнүндө '
        + 'үйрөнөт — сиздин бренддин жанында.',
      ru: 'Мы не продаём показы. Мы строим привычку: студент открывает '
        + 'приложение сам, каждый день, и учится там про деньги — рядом с '
        + 'вашим брендом.',
      en: 'We do not sell impressions. We build a habit: a student opens the '
        + 'app on their own, every day, and learns about money there — next '
        + 'to your brand.',
    },
    items: [
      {
        id: 'habit', icon: 'flame',
        title: { ky: 'Көнүмүш, камтуу эмес', ru: 'Привычка, а не охват', en: 'A habit, not reach' },
        text: {
          ky: 'Бир күн өткөрсө серия күйүп кетет. Колдонмону эртең менен '
            + 'ачтырган ошол — баннер муну кыла албайт.',
          ru: 'Серия дней сгорает при пропуске. Это то, ради чего приложение '
            + 'открывают утром — и то, чего баннер не умеет.',
          en: 'Miss a day and the streak is gone. That is what gets the app '
            + 'opened in the morning — and what a banner cannot do.',
        },
      },
      {
        id: 'teaching', icon: 'book-open',
        title: { ky: 'Окутуу, жарнама эмес', ru: 'Обучение, а не реклама', en: 'Teaching, not advertising' },
        text: {
          ky: 'Сиздин темаңыз продукттун ичинде курска айланат: сабактар, '
            + 'тапшырмалар, текшерүү. Адам билим менен кетет, тажаган эмес.',
          ru: 'Ваша тема становится курсом внутри продукта: уроки, задания, '
            + 'проверка. Человек уходит со знанием, а не с раздражением.',
          en: 'Your subject becomes a course inside the product: lessons, '
            + 'exercises, checks. People leave knowing something, not annoyed.',
        },
      },
      {
        id: 'league', icon: 'trophy',
        title: { ky: 'Кампустар жарышат', ru: 'Соревнование кампусов', en: 'Campuses compete' },
        text: {
          ky: 'Жеке жыйынтык вуздун эсебине кошулат. Бир студент бүт тобун '
            + 'ээрчитип келет — сиз төлөп жаткан өсүш ушул.',
          ru: 'Личный результат идёт в счёт университета. Один студент '
            + 'приводит группу — это и есть рост, который вы оплачиваете.',
          en: 'A personal score counts towards the university. One student '
            + 'brings their whole group — that is the growth you are paying for.',
        },
      },
      {
        id: 'rewards', icon: 'coins',
        title: { ky: 'Көрүнгөн сыйлыктар', ru: 'Награды, которые видно', en: 'Rewards people can see' },
        text: {
          ky: 'Студент тапкан монеталарын сиздин сыйлыгыңызга жумшап, промокод '
            + 'алат. Бир код — бир берилген сыйлык, баары отчётто.',
          ru: 'Студент тратит заработанные монеты на ваш приз и получает '
            + 'промокод. Один код — одна выданная награда, всё в отчёте.',
          en: 'A student spends earned coins on your prize and gets a promo '
            + 'code. One code is one reward handed out, all of it in the report.',
        },
      },
      {
        id: 'proof', icon: 'shield-check',
        title: { ky: 'Текшерсе болгон сандар', ru: 'Цифры, которые можно проверить', en: 'Numbers you can verify' },
        text: {
          ky: 'Адамдар, сабактар, промокоддор жана кармалуу сезондун жүрүшүндө '
            + 'система тарабынан эсептелет. Отчёт аягында колго чогултулбайт.',
          ru: 'Люди, уроки, промокоды и удержание считаются системой по ходу '
            + 'сезона. Отчёт не собирается вручную перед сдачей.',
          en: 'People, lessons, promo codes and retention are counted by the '
            + 'system as the season runs, not assembled by hand at the end.',
        },
      },
    ],
  },

  // ── Solutions ──────────────────────────────────────────────────────────
  // One row per audience. `imageUrl` replaces the drawn scene beside the
  // card; left empty, the page draws its own.
  solutions: {
    enabled: true,
    title: { ky: 'Аудиторияңызга ылайыкталган чечимдер', ru: 'Решения под вашу аудиторию', en: 'Built around your audience' },
    note: {
      ky: 'Формат бирөө — кампустагы сезон. Өзгөргөнү: ага эмне үчүн '
        + 'кирериңиз жана аягында эмне аларыңыз.',
      ru: 'Формат один — сезон на кампусе. Меняется то, ради чего вы в него '
        + 'заходите и что получаете на выходе.',
      en: 'The format is one thing — a season on a campus. What changes is '
        + 'why you enter it and what you take away.',
    },
    cta: { ky: 'Форматты талкуулоо', ru: 'Обсудить формат', en: 'Talk about this format' },
    items: [
      {
        id: 'banks',
        tab: { ky: 'Банктарга', ru: 'Для банков', en: 'Banks' },
        title: {
          ky: 'Биринчи банк узакка калат',
          ru: 'Первый банк остаётся надолго',
          en: 'The first bank is the lasting one',
        },
        text: {
          ky: 'Үчүнчү курста ачылган карта, адатта, бүтүрүүдөн, биринчи '
            + 'жумуштан жана биринчи айлыктан да узак жашайт. Биз сизге '
            + 'студент акча жөнүндө биринчи жолу олуттуу ойлонгон учурда орун '
            + 'беребиз.',
          ru: 'Карта, оформленная на третьем курсе, обычно переживает выпуск, '
            + 'первую работу и первую зарплату. Мы даём вам место в тот '
            + 'момент, когда студент впервые всерьёз думает про деньги.',
          en: 'A card opened in third year usually outlives graduation, the '
            + 'first job and the first salary. We give you a place at the '
            + 'moment a student first thinks seriously about money.',
        },
        p1: {
          ky: 'Топтоо, насыя же карта боюнча модуль — сиздин редакцияңызда',
          ru: 'Модуль про накопления, кредит или карту — вашей редакции',
          en: 'A module on saving, credit or cards — edited by you',
        },
        p2: {
          ky: 'Колдонмонун дүкөнүндө сиздин промокоддоруңуз',
          ru: 'Ваши промокоды в магазине приложения',
          en: 'Your promo codes in the app’s shop',
        },
        p3: {
          ky: 'Тандалган кампустагы лиганын байге фонду',
          ru: 'Призовой фонд лиги на выбранном кампусе',
          en: 'A league prize pool on the campus you choose',
        },
        imageUrl: '',
      },
      {
        id: 'fintech',
        tab: { ky: 'Каржы уюмдарына', ru: 'Для фин. организаций', en: 'Financial services' },
        title: {
          ky: 'Сатардан мурун продуктту түшүндүрүү',
          ru: 'Объяснить продукт до того, как его продавать',
          en: 'Explain the product before selling it',
        },
        text: {
          ky: 'Камсыздандыруу, инвестиция, бөлүп төлөө — механикасын '
            + 'түшүнбөгөн адамга булардын баары начар сатылат. Сабак '
            + 'түшүндүрөт, дүкөн сынап көрүүгө биринчи себеп берет.',
          ru: 'Страхование, инвестиции, рассрочка — всё это плохо продаётся '
            + 'человеку, который не понимает механики. Урок объясняет, '
            + 'магазин даёт первый повод попробовать.',
          en: 'Insurance, investing, instalments — none of it sells to someone '
            + 'who does not understand the mechanics. The lesson explains; '
            + 'the shop gives them a first reason to try.',
        },
        p1: {
          ky: 'Категорияңызды нөлдөн түшүндүргөн курс',
          ru: 'Курс, объясняющий вашу категорию с нуля',
          en: 'A course that explains your category from zero',
        },
        p2: {
          ky: 'Колдонмодон сиздин арызыңызга өтүү',
          ru: 'Переход из приложения в вашу заявку',
          en: 'A hand-off from the app into your application form',
        },
        p3: {
          ky: 'Отчёт: адамдар так кайсы жерде түшүнбөй калат',
          ru: 'Отчёт: где именно люди перестают понимать',
          en: 'A report on exactly where people stop understanding',
        },
        imageUrl: '',
      },
      {
        id: 'universities',
        tab: { ky: 'Университеттерге', ru: 'Для университетов', en: 'Universities' },
        title: {
          ky: 'Программада жок каржы сабаттуулугу',
          ru: 'Финансовая грамотность, которой нет в программе',
          en: 'The financial literacy the curriculum skips',
        },
        text: {
          ky: 'Курс даяр, үч тилде, студенттер аны өздөрү өтүшөт. '
            + 'Университет өз атындагы лиганы жана кампус боюнча көрүнгөн '
            + 'жыйынтыкты алат.',
          ru: 'Курс уже готов, на трёх языках, и студенты проходят его сами. '
            + 'Университет получает лигу со своим именем и результат, '
            + 'который видно по кампусу.',
          en: 'The course already exists, in three languages, and students '
            + 'take it on their own. The university gets a league in its own '
            + 'name and a result visible across the campus.',
        },
        p1: { ky: 'Лигада өз таблицасы бар кампус', ru: 'Кампус со своей таблицей в лиге', en: 'Your campus with its own league table' },
        p2: {
          ky: 'Кыргызча, орусча жана англисче даяр курс',
          ru: 'Готовый курс на кыргызском, русском и английском',
          en: 'A ready course in Kyrgyz, Russian and English',
        },
        p3: { ky: 'Сезондун аягында вуз боюнча жыйынтык', ru: 'Итоги по вузу в конце сезона', en: 'Campus-level results at the end of the season' },
        imageUrl: '',
      },
      {
        id: 'media',
        tab: { ky: 'Медиага', ru: 'Для медиа', en: 'Media' },
        title: {
          ky: 'Өзү кайра келген аудитория',
          ru: 'Аудитория, которая возвращается сама',
          en: 'An audience that comes back on its own',
        },
        text: {
          ky: 'Медиа долбоорго эртең кайра келүүгө себеп керек. Серия, лига '
            + 'жана дүкөн — курулган үч себеп, ал эми сиздин контентиңиз '
            + 'курстун бир бөлүгүнө айланат.',
          ru: 'Медиапроекту нужен повод вернуться завтра. Серия, лига и '
            + 'магазин — это три встроенных повода, а ваш контент '
            + 'становится частью курса.',
          en: 'A media project needs a reason to return tomorrow. The streak, '
            + 'the league and the shop are three built-in reasons, and your '
            + 'content becomes part of the course.',
        },
        p1: { ky: 'Редакциялык темаңыз боюнча биргелешкен модуль', ru: 'Совместный модуль под вашу редакционную тему', en: 'A joint module on your editorial subject' },
        p2: { ky: 'Бүт сезон бою кампустун таблицасынын жанында бренд', ru: 'Ваш бренд рядом с таблицей кампуса весь сезон', en: 'Your brand beside the campus table all season' },
        p3: { ky: 'Эмнени аягына чейин окуп чыгышат — маалымат', ru: 'Данные о том, что дочитывают до конца', en: 'Data on what actually gets finished' },
        imageUrl: '',
      },
      {
        id: 'corporate',
        tab: { ky: 'Компанияларга', ru: 'Для корпораций', en: 'Employers' },
        title: {
          ky: 'Кызматкерлер жана стажёрлор үчүн программа',
          ru: 'Программа для сотрудников и стажёров',
          en: 'A programme for staff and interns',
        },
        text: {
          ky: 'Ошол эле продукт, жабык топ. Каржы сабаттуулугу онбординг же '
            + 'соцпакеттин бир бөлүгү катары — өз LMS'
            + 'иңиз жок жана жумуш күнүнүн аягындагы милдеттүү лекциясыз.',
          ru: 'Тот же продукт, закрытая группа. Финансовая грамотность как '
            + 'часть онбординга или соцпакета — без своей LMS и без '
            + 'обязательных лекций в конце рабочего дня.',
          en: 'The same product, a private group. Financial literacy as part '
            + 'of onboarding or benefits — with no LMS of your own and no '
            + 'mandatory lecture at the end of the working day.',
        },
        p1: { ky: 'Өз таблицасы бар жабык топ', ru: 'Закрытая группа с собственной таблицей', en: 'A private group with its own table' },
        p2: { ky: 'Ички темаларыңыз боюнча модуль', ru: 'Модуль под ваши внутренние темы', en: 'A module on your internal subjects' },
        p3: { ky: 'Колго чогултпастан өтүү боюнча отчёт', ru: 'Отчёт по прохождению без ручного сбора', en: 'Completion reporting with no manual collection' },
        imageUrl: '',
      },
      {
        id: 'ngo',
        tab: { ky: 'НПО жана мампрограммаларга', ru: 'Для NGO и госпрограмм', en: 'NGOs and public programmes' },
        title: {
          ky: 'Донорго көрсөтө турган жыйынтык',
          ru: 'Результат, который можно показать донору',
          en: 'A result you can show a donor',
        },
        text: {
          ky: 'Агартуу программасы адатта өткөрүлгөн иш-чаралар жөнүндө отчёт '
            + 'менен аяктайт. Бул жерде отчёт — система эсептеген адамдар, '
            + 'сабактар жана кармалуу жөнүндө.',
          ru: 'Просветительская программа обычно заканчивается отчётом про '
            + 'проведённые мероприятия. Здесь отчёт — про людей, уроки и '
            + 'удержание, посчитанные системой.',
          en: 'An education programme usually ends with a report about events '
            + 'held. Here the report is about people, lessons and retention, '
            + 'counted by the system.',
        },
        p1: { ky: 'Өлкө боюнча эмес, так кампустар боюнча камтуу', ru: 'Охват по конкретным кампусам, а не по стране', en: 'Reach on named campuses rather than across a country' },
        p2: { ky: 'Локализацияга чыгымсыз үч тилдеги сабактар', ru: 'Уроки на трёх языках без затрат на локализацию', en: 'Lessons in three languages with no localisation budget' },
        p3: { ky: 'Жүктөп алса болгон сезондун жыйынтыгы', ru: 'Выгружаемые итоги сезона', en: 'Exportable season results' },
        imageUrl: '',
      },
    ],
  },

  // ── Live counters ──────────────────────────────────────────────────────
  // Only the labels are copy; the numbers come from GET /public/stats.
  stats: {
    enabled: true,
    title: { ky: 'Продукт бүгүн иштеп жатат', ru: 'Продукт работает сегодня', en: 'The product works today' },
    note: {
      ky: 'Төмөнкү сандар бет жүктөлгөн учурда базадан окулат — өткөн '
        + 'кварталда кимдир бирөө жаңылаган слайддан эмес.',
      ru: 'Цифры ниже читаются из базы в момент загрузки страницы — не из '
        + 'слайда, который кто-то обновлял в прошлом квартале.',
      en: 'The figures below are read from the database as this page loads — '
        + 'not from a slide someone last updated a quarter ago.',
    },
    learnersLabel: { ky: 'колдонмодогу студент', ru: 'студентов в приложении', en: 'students in the app' },
    lessonsLabel: { ky: 'курстагы сабак', ru: 'уроков в курсе', en: 'lessons in the course' },
    modulesLabel: { ky: 'тематикалык модуль', ru: 'тематических модулей', en: 'subject modules' },
    universitiesLabel: { ky: 'лигадагы кампус', ru: 'кампусов в лиге', en: 'campuses in the league' },
    xpLabel: { ky: 'студенттер тапкан XP', ru: 'XP заработано студентами', en: 'XP earned by students' },
  },

  // ── Closing call to action ─────────────────────────────────────────────
  cta: {
    enabled: true,
    line1: { ky: 'Бир кампусту', ru: 'Возьмите один кампус', en: 'Take one campus' },
    line2: { ky: 'бир сезонго алыңыз', ru: 'на один сезон', en: 'for one season' },
    text: {
      ky: 'Стартан отчётко чейин сегиз жума. Иштесе — кийинки кампусту '
        + 'алабыз; иштебесе — сиз жылдык бюджетти эмес, бир сезонду '
        + 'жумшадыңыз.',
      ru: 'Восемь недель от старта до отчёта. Если сработало — берём '
        + 'следующий кампус; если нет — вы потратили один сезон, а не '
        + 'годовой бюджет.',
      en: 'Eight weeks from launch to report. If it worked, we take the next '
        + 'campus; if it did not, you spent one season rather than an annual '
        + 'budget.',
    },
    button: { ky: 'Арыз калтыруу', ru: 'Оставить заявку', en: 'Get in touch' },
    imageUrl: '',
  },

  // ── The application form ───────────────────────────────────────────────
  form: {
    enabled: true,
    title: { ky: 'Маселеңиз жөнүндө айтып бериңиз', ru: 'Расскажите про свою задачу', en: 'Tell us what you are trying to do' },
    note: {
      ky: 'Төрт талаа. Жумуш күнүнүн ичинде жооп берип, сүйлөшүүгө убакыт '
        + 'сунуштайбыз — рассылка эмес.',
      ru: 'Четыре поля. Ответим в течение рабочего дня и предложим время для '
        + 'разговора — не рассылку.',
      en: 'Four fields. We reply within one working day and propose a time to '
        + 'talk — not a mailing list.',
    },
    organization: { ky: 'Уюм', ru: 'Организация', en: 'Organisation' },
    organizationPh: { ky: 'Мисалы, MBANK', ru: 'Например, MBANK', en: 'e.g. MBANK' },
    contact: { ky: 'Байланыш адамы', ru: 'Контактное лицо', en: 'Contact person' },
    contactPh: { ky: 'Аты-жөнү', ru: 'Имя и фамилия', en: 'First and last name' },
    email: { ky: 'Email', ru: 'Email', en: 'Email' },
    emailPh: { ky: 'name@company.kg', ru: 'name@company.kg', en: 'name@company.kg' },
    phone: { ky: 'Телефон', ru: 'Телефон', en: 'Phone' },
    phonePh: { ky: '+996 ___ ______', ru: '+996 ___ ______', en: '+996 ___ ______' },
    optional: { ky: 'милдеттүү эмес', ru: 'необязательно', en: 'optional' },
    interest: { ky: 'Эмне кызыктырат', ru: 'Что интересует', en: 'What interests you' },
    iLeague: { ky: 'Кампустагы сезон', ru: 'Сезон на кампусе', en: 'A season on a campus' },
    iModule: { ky: 'Окуу модулу', ru: 'Обучающий модуль', en: 'A learning module' },
    iRewards: { ky: 'Дүкөндөгү сыйлыктар', ru: 'Призы в магазине', en: 'Prizes in the shop' },
    iIntegration: { ky: 'Башка же азырынча билбейм', ru: 'Другое или пока не знаю', en: 'Something else, or not sure yet' },
    message: { ky: 'Комментарий', ru: 'Комментарий', en: 'Message' },
    messagePh: {
      ky: 'Кайсы кампус, кайсы аудитория, кандай мөөнөт — сүйлөшүүгө '
        + 'даярданууга жардам берген нерсенин баары.',
      ru: 'Какой кампус, какая аудитория, какие сроки — что угодно, что '
        + 'поможет подготовиться к разговору.',
      en: 'Which campus, which audience, what timeline — anything that helps '
        + 'us prepare for the call.',
    },
    submit: { ky: 'Арыз жиберүү', ru: 'Отправить заявку', en: 'Send' },
    sending: { ky: 'Жиберилүүдө…', ru: 'Отправляем…', en: 'Sending…' },
    retry: { ky: 'Кайра аракет кылуу', ru: 'Попробовать ещё раз', en: 'Try again' },
    privacy: {
      ky: 'Форманы жөнөтүү менен арызга жооп берүү үчүн байланыш '
        + 'маалыматыңызды иштетүүгө макул болосуз.',
      ru: 'Отправляя форму, вы соглашаетесь на обработку контактных данных '
        + 'для ответа на заявку.',
      en: 'By sending this form you agree that we may use your contact '
        + 'details to reply to it.',
    },
    okTitle: { ky: 'Арыз жиберилди', ru: 'Заявка отправлена', en: 'Message sent' },
    okBody: {
      ky: 'Кайрылууңузду алдык жана жумуш күнүнүн ичинде көрсөткөн email '
        + 'дарегиңизге жооп беребиз.',
      ru: 'Мы получили ваше обращение и ответим на указанный email в течение '
        + 'рабочего дня.',
      en: 'We have it, and we will reply to the email you gave within one '
        + 'working day.',
    },
    okAgain: { ky: 'Дагы бирөө жиберүү', ru: 'Отправить ещё одну', en: 'Send another' },
    failBody: {
      ky: 'Жиберилген жок. Байланышты текшериңиз же түз бизге жазыңыз:',
      ru: 'Не отправилось. Проверьте соединение или напишите нам напрямую:',
      en: 'It did not send. Check your connection, or write to us directly:',
    },
  },

  // ── Footer ─────────────────────────────────────────────────────────────
  footer: {
    enabled: true,
    tagline: {
      ky: 'Кыргызстандын студенттери үчүн каржы сабаттуулугу — кыргызча, '
        + 'орусча жана англисче.',
      ru: 'Финансовая грамотность для студентов Кыргызстана — на кыргызском, '
        + 'русском и английском.',
      en: 'Financial literacy for students in Kyrgyzstan — in Kyrgyz, Russian '
        + 'and English.',
    },
    col1: { ky: 'Чечимдер', ru: 'Решения', en: 'Solutions' },
    col2: { ky: 'Компания', ru: 'Компания', en: 'Company' },
    col3: { ky: 'Продукт', ru: 'Продукт', en: 'Product' },
    newsTitle: { ky: 'Жаңылыктар', ru: 'Рассылка', en: 'Newsletter' },
    newsNote: {
      ky: 'Сезонго бир жолу — кампустарда эмне болгону жана кандай модулдар '
        + 'чыкканы. Спамсыз, чыгуу бир басууда.',
      ru: 'Раз в сезон — что получилось на кампусах и какие модули вышли. Без '
        + 'спама и без отписки в три клика.',
      en: 'Once a season — what happened on the campuses and which modules '
        + 'shipped. No spam, and unsubscribing takes one click.',
    },
    newsPlaceholder: { ky: 'Сиздин email', ru: 'Ваш email', en: 'Your email' },
    newsOk: { ky: 'Даяр — сиз тизмедесиз.', ru: 'Готово — вы в списке.', en: 'Done — you are on the list.' },
    newsBad: { ky: 'Дарегиңизди текшериңиз.', ru: 'Проверьте адрес.', en: 'Check the address.' },
    newsFail: { ky: 'Болбоду. Кайра аракет кылыңыз.', ru: 'Не получилось. Попробуйте ещё раз.', en: 'That did not work. Try again.' },
    apkLabel: { ky: 'Android колдонмосу (APK)', ru: 'Приложение для Android (APK)', en: 'Android app (APK)' },
    apkUrl: '',
    rights: {
      ky: '© JashMen Studio. Бишкек, Кыргызстан.',
      ru: '© JashMen Studio. Бишкек, Кыргызстан.',
      en: '© JashMen Studio. Bishkek, Kyrgyzstan.',
    },
    email: 'jashmenstudio@gmail.com',
    instagram: 'https://www.instagram.com/jashmen.studio/',
    // `col` picks the column, `href` where it goes. An href that starts with
    // `#` scrolls the page, `/` opens an app route, anything else is a link
    // out. A row whose href names a solutions tab id (#tab:banks) selects
    // that tab and scrolls to it.
    links: [
      { id: 'l1', col: '1', href: '#tab:banks', label: { ky: 'Банктарга', ru: 'Для банков', en: 'Banks' } },
      { id: 'l2', col: '1', href: '#tab:fintech', label: { ky: 'Каржы уюмдарына', ru: 'Для фин. организаций', en: 'Financial services' } },
      { id: 'l3', col: '1', href: '#tab:universities', label: { ky: 'Университеттерге', ru: 'Для университетов', en: 'Universities' } },
      { id: 'l4', col: '1', href: '#tab:media', label: { ky: 'Медиага', ru: 'Для медиа', en: 'Media' } },
      { id: 'l5', col: '2', href: '#solutions', label: { ky: 'Кантип иштейт', ru: 'Как это работает', en: 'How it works' } },
      { id: 'l6', col: '2', href: '#impact', label: { ky: 'Таасири', ru: 'Влияние', en: 'Impact' } },
      { id: 'l7', col: '2', href: '#product', label: { ky: 'Продукт бүгүн', ru: 'Продукт сегодня', en: 'The product today' } },
      { id: 'l8', col: '2', href: '#apply', label: { ky: 'Өнөктөш болуу', ru: 'Стать партнёром', en: 'Become a partner' } },
      { id: 'l9', col: '3', href: '/start', label: { ky: 'Аккаунт түзүү', ru: 'Создать аккаунт', en: 'Create an account' } },
      { id: 'l10', col: '3', href: '/login', label: { ky: 'Кирүү', ru: 'Войти', en: 'Sign in' } },
      { id: 'l11', col: '3', href: '/privacy.html', label: { ky: 'Купуялык', ru: 'Конфиденциальность', en: 'Privacy' } },
    ],
  },
};
