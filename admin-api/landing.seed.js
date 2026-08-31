// admin-api/landing.seed.js
//
// The marketing page at https://jashmenstudio.com/ — every word of it.
//
// Until this existed a signed-out visitor landed straight on the onboarding
// slides and then the sign-in wall, so the only thing a human (or a crawler)
// could learn about JashMen was whatever fit in index.html's <head>. The
// landing page fixes that, and lives here rather than in the frontend for
// the same reason the university league moved server-side: marketing copy
// changes far more often than code ships.
//
// Shape rules, identical to the rest of contentStore:
//   • every human-readable string is trilingual `{ky, ru?, en?}` (ky required)
//   • `icon` is a slug from shared/lessonIcons.js, validated on write
//   • each section carries `enabled` so a section can be hidden without
//     deleting the copy that took someone an afternoon to write
//
// The numbers on the page are NOT here on purpose — learners, lessons and
// campuses come from GET /public/stats, computed from the live database.
// Hand-written stats on a landing page go stale within a week.

export const SEED_LANDING = {
  hero: {
    enabled: true,
    eyebrow: {
      ky: 'Кыргызча каржы сабаттуулугу',
      ru: 'Финансовая грамотность на кыргызском',
      en: 'Financial literacy in Kyrgyz',
    },
    title: {
      ky: 'Акча башкарууну оюн аркылуу үйрөн',
      ru: 'Учись управлять деньгами через игру',
      en: 'Learn to manage money through play',
    },
    subtitle: {
      ky: 'Күнүнө 5 мүнөт — кыска сабактар, реалдуу мисалдар жана университеттер ортосундагы жарыш. Толугу менен акысыз.',
      ru: '5 минут в день — короткие уроки, реальные примеры и соревнование между университетами. Полностью бесплатно.',
      en: 'Five minutes a day — short lessons, real examples and a contest between universities. Completely free.',
    },
    primaryCta: { ky: 'Акысыз баштоо', ru: 'Начать бесплатно', en: 'Start free' },
    secondaryCta: { ky: 'Кирүү', ru: 'Войти', en: 'Sign in' },
    // The mint diamond pinned to the device mock-up. `badgeStat` names which
    // live counter from GET /public/stats fills it, so the number can never
    // drift from reality the way a typed-in "200+ partners" would; 'none'
    // takes the badge off the page.
    badgeStat: 'universities',
    badgeLabel: { ky: 'университет лигада', ru: 'университетов в лиге', en: 'universities in the league' },
  },

  // The lemon-yellow strip that scrolls under the hero. Short phrases only —
  // it moves, so nothing longer than about three words survives being read.
  ribbon: {
    enabled: true,
    items: [
      { id: 'r1', text: { ky: 'КЫСКА САБАКТАР', ru: 'КОРОТКИЕ УРОКИ', en: 'SHORT LESSONS' } },
      { id: 'r2', text: { ky: 'КҮНҮНӨ 5 МҮНӨТ', ru: '5 МИНУТ В ДЕНЬ', en: 'FIVE MINUTES A DAY' } },
      { id: 'r3', text: { ky: 'АКЫСЫЗ', ru: 'БЕСПЛАТНО', en: 'FREE' } },
      { id: 'r4', text: { ky: 'ҮЧ ТИЛДЕ', ru: 'НА ТРЁХ ЯЗЫКАХ', en: 'THREE LANGUAGES' } },
      { id: 'r5', text: { ky: 'УНИВЕРСИТЕТ ЛИГАСЫ', ru: 'УНИВЕРСИТЕТСКАЯ ЛИГА', en: 'UNIVERSITY LEAGUE' } },
      { id: 'r6', text: { ky: 'ЧЫНЫГЫ БАЙГЕЛЕР', ru: 'РЕАЛЬНЫЕ ПРИЗЫ', en: 'REAL PRIZES' } },
    ],
  },

  stats: {
    enabled: true,
    title: { ky: 'Жандуу сандар', ru: 'Живые цифры', en: 'Live numbers' },
    subtitle: {
      ky: 'Ушул саамдагы чыныгы маалымат — колдо жазылган эмес.',
      ru: 'Реальные данные прямо сейчас — не написанные вручную.',
      en: 'Real data right now — nothing hand-written.',
    },
    learnersLabel: { ky: 'Окуучу', ru: 'Учеников', en: 'Learners' },
    lessonsLabel: { ky: 'Сабак', ru: 'Уроков', en: 'Lessons' },
    universitiesLabel: { ky: 'Университет', ru: 'Университетов', en: 'Universities' },
    xpLabel: { ky: 'Чогултулган XP', ru: 'Собрано XP', en: 'XP earned' },
  },

  features: {
    enabled: true,
    title: { ky: 'Эмне үйрөнөсүң', ru: 'Чему ты научишься', en: 'What you’ll learn' },
    subtitle: {
      ky: 'Теория эмес — эртең эле колдоно турган нерселер.',
      ru: 'Не теория — то, что применишь уже завтра.',
      en: 'Not theory — things you can use tomorrow.',
    },
    items: [
      {
        id: 'budget',
        icon: 'wallet',
        title: { ky: 'Бюджет түзүү', ru: 'Составление бюджета', en: 'Budgeting' },
        text: {
          ky: 'Кирешең кайда кетип жатканын көр, ай сайын үнөмдөй турган сумманы аныкта.',
          ru: 'Увидь, куда уходят деньги, и определи сумму, которую можешь откладывать каждый месяц.',
          en: 'See where your money goes and work out how much you can set aside each month.',
        },
      },
      {
        id: 'saving',
        icon: 'piggy-bank',
        title: { ky: 'Үнөмдөө', ru: 'Накопления', en: 'Saving' },
        text: {
          ky: 'Максат кой, аны кичине кадамдарга бөл жана «күтүлбөгөн чыгым» фондун чогулт.',
          ru: 'Поставь цель, разбей её на шаги и собери подушку безопасности.',
          en: 'Set a goal, break it into steps and build an emergency fund.',
        },
      },
      {
        id: 'invest',
        icon: 'trending-up',
        title: { ky: 'Инвестиция', ru: 'Инвестиции', en: 'Investing' },
        text: {
          ky: 'Депозит, акция, облигация деген эмне жана тобокелдик кайдан чыгат — жөнөкөй тил менен.',
          ru: 'Что такое депозит, акция и облигация и откуда берётся риск — простым языком.',
          en: 'Deposits, shares, bonds and where risk actually comes from — in plain language.',
        },
      },
      {
        id: 'credit',
        icon: 'credit-card',
        title: { ky: 'Насыя жана карта', ru: 'Кредиты и карты', en: 'Credit and cards' },
        text: {
          ky: 'Пайыздык чен кантип эсептелет, ашыкча төлөм канча болот жана карызга кантип батпайсың.',
          ru: 'Как считается процентная ставка, сколько ты переплатишь и как не увязнуть в долгах.',
          en: 'How interest is calculated, what you really overpay, and how to stay out of debt.',
        },
      },
      {
        id: 'safety',
        icon: 'shield-check',
        title: { ky: 'Каржы коопсуздугу', ru: 'Финансовая безопасность', en: 'Staying safe' },
        text: {
          ky: 'Алдамчылардын ыкмаларын тааны, жеке маалыматыңды жана картаңды корго.',
          ru: 'Распознавай схемы мошенников, защищай свои данные и карту.',
          en: 'Recognise scams and protect your data and your card.',
        },
      },
      {
        id: 'bank',
        icon: 'landmark',
        title: { ky: 'Банк кызматтары', ru: 'Банковские услуги', en: 'Banking' },
        text: {
          ky: 'Эсеп ачуудан баштап которууга чейин — банк менен туура иштешүүнү үйрөн.',
          ru: 'От открытия счёта до переводов — научись правильно работать с банком.',
          en: 'From opening an account to transfers — how to work with a bank properly.',
        },
      },
    ],
  },

  steps: {
    enabled: true,
    title: { ky: 'Кантип иштейт', ru: 'Как это работает', en: 'How it works' },
    subtitle: {
      ky: 'Үч кадам, отуз секунд.',
      ru: 'Три шага, тридцать секунд.',
      en: 'Three steps, thirty seconds.',
    },
    items: [
      {
        id: 'signup',
        icon: 'rocket',
        title: { ky: 'Каттал', ru: 'Зарегистрируйся', en: 'Sign up' },
        text: {
          ky: 'Google аркылуу бир басууда же почта менен. Карта да, төлөм да талап кылынбайт.',
          ru: 'Через Google в одно нажатие или по почте. Ни карты, ни оплаты.',
          en: 'One tap with Google, or by email. No card, no payment.',
        },
      },
      {
        id: 'learn',
        icon: 'book-open',
        title: { ky: 'Күн сайын окуп тур', ru: 'Учись каждый день', en: 'Learn every day' },
        text: {
          ky: 'Кыска сабак, дароо жооп жана күнүмдүк серия — адат ушундан башталат.',
          ru: 'Короткий урок, мгновенная обратная связь и ежедневная серия — так формируется привычка.',
          en: 'A short lesson, instant feedback and a daily streak — that is how the habit sticks.',
        },
      },
      {
        id: 'compete',
        icon: 'flame',
        title: { ky: 'Жарышка кир', ru: 'Соревнуйся', en: 'Compete' },
        text: {
          ky: 'XP топто, лигада көтөрүл жана университетиңди чемпион кыл.',
          ru: 'Набирай XP, поднимайся в лиге и приведи свой университет к победе.',
          en: 'Earn XP, climb the league and carry your university to the top.',
        },
      },
    ],
  },

  uni: {
    enabled: true,
    title: { ky: 'Университет лигасы', ru: 'Университетская лига', en: 'University league' },
    subtitle: {
      ky: 'Университетиңди тандап, курсташтарың менен бирге XP чогулт. Эң мыкты кампус байгени алат.',
      ru: 'Выбери свой университет и собирай XP вместе с однокурсниками. Лучший кампус забирает приз.',
      en: 'Pick your university and earn XP alongside your classmates. The best campus takes the prize.',
    },
    cta: { ky: 'Лигага кошулуу', ru: 'Присоединиться к лиге', en: 'Join the league' },
    prizeLabel: { ky: 'Байге фонду', ru: 'Призовой фонд', en: 'Prize pool' },
  },

  // The logos come from the admin's own partner list (Module Б) — whoever is
  // in there with a logo uploaded, and nobody else. There is no place to
  // type a partner count in by hand, on purpose.
  partners: {
    enabled: true,
    title: { ky: 'Бизге ишенгендер', ru: 'Нам доверяют', en: 'Trusted by' },
  },

  gamification: {
    enabled: true,
    title: { ky: 'Окуу — түйшүк эмес', ru: 'Учиться — не скучно', en: 'Learning without the grind' },
    subtitle: {
      ky: 'Ар бир туура жооп сени алдыга жылдырат.',
      ru: 'Каждый правильный ответ двигает тебя вперёд.',
      en: 'Every correct answer moves you forward.',
    },
    items: [
      {
        id: 'xp',
        icon: 'star',
        title: { ky: 'XP', ru: 'XP', en: 'XP' },
        text: {
          ky: 'Ар бир сабак үчүн упай. Катасыз бүтүрсөң — кошумча бонус.',
          ru: 'Очки за каждый урок. Без ошибок — дополнительный бонус.',
          en: 'Points for every lesson, with a bonus for a flawless run.',
        },
      },
      {
        id: 'streak',
        icon: 'flame',
        title: { ky: 'Серия', ru: 'Серия', en: 'Streak' },
        text: {
          ky: 'Катары менен канча күн окуганың. Үзүлбөсүн — коргоочу сатып ала аласың.',
          ru: 'Сколько дней подряд ты учишься. Не дай прерваться — есть защита.',
          en: 'How many days in a row you show up. Buy a shield so it never breaks.',
        },
      },
      {
        id: 'coins',
        icon: 'coins',
        title: { ky: 'Монета', ru: 'Монеты', en: 'Coins' },
        text: {
          ky: 'Сабактан жана күнүмдүк кирүүдөн жыйналат, дүкөндө жумшалат.',
          ru: 'Копятся за уроки и ежедневный вход, тратятся в магазине.',
          en: 'Earned from lessons and daily visits, spent in the shop.',
        },
      },
      {
        id: 'shop',
        icon: 'gift',
        title: { ky: 'Дүкөн', ru: 'Магазин', en: 'Shop' },
        text: {
          ky: 'Энергия, XP тездеткич, серия коргоочу жана өнөктөштөрдүн реалдуу белектери.',
          ru: 'Энергия, ускоритель XP, защита серии и реальные подарки от партнёров.',
          en: 'Energy, an XP boost, a streak shield and real gifts from our partners.',
        },
      },
    ],
  },

  // Placeholder voices until real ones are collected. Everything here is
  // admin-editable, and it SHOULD be replaced: invented testimonials on a
  // page that also shows live numbers is the one thing on this site that
  // would read as dishonest.
  testimonials: {
    enabled: true,
    title: { ky: 'Окугандар эмне дейт', ru: 'Что говорят студенты', en: 'What learners say' },
    subtitle: {
      ky: 'Бул тексттер убактылуу — админ панелинен чыныгы пикирлерге алмаштырыңыз.',
      ru: 'Это временные тексты — замените их настоящими отзывами в админ-панели.',
      en: 'Placeholder copy — replace it with real reviews from the admin panel.',
    },
    items: [
      {
        id: 'aiperi',
        name: 'Айпери',
        avatarUrl: '',
        role: { ky: 'КГТУ, 2-курс', ru: 'КГТУ, 2 курс', en: 'KSTU, 2nd year' },
        text: {
          ky: 'Стипендиям кайда кетип жатканын биринчи жолу так көрдүм. Эки айда биринчи топтогон акчам чыкты.',
          ru: 'Впервые чётко увидела, куда уходит стипендия. За два месяца появились первые накопления.',
          en: 'For the first time I could see exactly where my stipend went. Two months in, I had actual savings.',
        },
      },
      {
        id: 'bekzat',
        name: 'Бекзат',
        avatarUrl: '',
        role: { ky: 'АУЦА, 3-курс', ru: 'АУЦА, 3 курс', en: 'AUCA, 3rd year' },
        text: {
          ky: 'Насыя боюнча сабак насыя алардан мурун кездешти. Ашыкча төлөмдү эсептеп көрүп, дүкөндөн рассрочка албай койдум.',
          ru: 'Урок про кредиты попался раньше, чем сам кредит. Посчитал переплату и отказался от рассрочки в магазине.',
          en: 'The lesson on credit reached me before the credit did. I ran the numbers and walked away from a store instalment plan.',
        },
      },
      {
        id: 'nurayym',
        name: 'Нурайым',
        avatarUrl: '',
        role: { ky: 'КРСУ, 1-курс', ru: 'КРСУ, 1 курс', en: 'KRSU, 1st year' },
        text: {
          ky: 'Университет лигасы кызык — курсташтар менен жарышып, 40 күндүк серия чогулттум.',
          ru: 'Университетская лига затягивает — соревнуюсь с однокурсниками, собрала серию в 40 дней.',
          en: 'The university league is what keeps me going — I race my classmates and I am on a 40-day streak.',
        },
      },
    ],
  },

  download: {
    enabled: true,
    title: { ky: 'Телефонуңа жүктөп ал', ru: 'Установи на телефон', en: 'Get it on your phone' },
    subtitle: {
      ky: 'Браузерде да иштейт, бирок колдонмодо билдирүүлөр жана офлайн режим бар.',
      ru: 'Работает и в браузере, но в приложении есть уведомления и офлайн-режим.',
      en: 'It works in the browser too, but the app adds notifications and offline mode.',
    },
    apkUrl: '',
    apkLabel: { ky: 'Android үчүн жүктөө', ru: 'Скачать для Android', en: 'Download for Android' },
    note: {
      ky: 'iOS версиясы жакында чыгат.',
      ru: 'Версия для iOS скоро.',
      en: 'The iOS version is coming soon.',
    },
    webCta: { ky: 'Браузерде ачуу', ru: 'Открыть в браузере', en: 'Open in browser' },
  },

  faq: {
    enabled: true,
    title: { ky: 'Көп берилүүчү суроолор', ru: 'Частые вопросы', en: 'Frequently asked questions' },
    subtitle: { ky: '', ru: '', en: '' },
    items: [
      {
        id: 'price',
        q: { ky: 'Чын эле акысызбы?', ru: 'Это правда бесплатно?', en: 'Is it really free?' },
        a: {
          ky: 'Ооба. Бардык сабактар акысыз. Дүкөндөгү нерселер да реалдуу акчага эмес, окуп жүрүп тапкан монетаңа алынат.',
          ru: 'Да. Все уроки бесплатны. Товары в магазине тоже покупаются не за деньги, а за монеты, заработанные учёбой.',
          en: 'Yes. Every lesson is free, and shop items are bought with coins you earn by learning — not real money.',
        },
      },
      {
        id: 'lang',
        q: { ky: 'Кайсы тилдерде бар?', ru: 'На каких языках доступно?', en: 'What languages are available?' },
        a: {
          ky: 'Кыргызча, орусча жана англисче. Тилди каалаган убакта алмаштыра аласың.',
          ru: 'Кыргызский, русский и английский. Язык можно сменить в любой момент.',
          en: 'Kyrgyz, Russian and English. You can switch at any time.',
        },
      },
      {
        id: 'time',
        q: { ky: 'Күнүнө канча убакыт керек?', ru: 'Сколько времени это занимает?', en: 'How much time does it take?' },
        a: {
          ky: 'Бир сабак 3–5 мүнөт. Күнүнө бирөө жетиштүү — сериясы үзүлбөйт, билими өсөт.',
          ru: 'Один урок — 3–5 минут. Достаточно одного в день: серия не прервётся, а знания растут.',
          en: 'A lesson takes 3–5 minutes. One a day is enough to keep your streak and keep learning.',
        },
      },
      {
        id: 'who',
        q: { ky: 'Ким үчүн жасалган?', ru: 'Для кого это?', en: 'Who is it for?' },
        a: {
          ky: 'Биринчи кезекте студенттер жана мектеп бүтүрүүчүлөрү үчүн. Бирок акча менен иштеген ар бир адамга пайдалуу.',
          ru: 'В первую очередь для студентов и выпускников школ. Но пригодится каждому, кто имеет дело с деньгами.',
          en: 'Mostly students and school leavers — but useful to anyone who handles money.',
        },
      },
      {
        id: 'uni',
        q: {
          ky: 'Университет лигасына кантип кошулам?',
          ru: 'Как попасть в университетскую лигу?',
          en: 'How do I join the university league?',
        },
        a: {
          ky: 'Катталгандан кийин «Лига» бөлүмүн ач, университетиңди жана ролуңду тандап ал. Ролду кийин да өзгөртө аласың.',
          ru: 'После регистрации открой раздел «Лига» и выбери свой университет и роль. Роль можно поменять позже.',
          en: 'After signing up, open the League tab and pick your university and role. You can change the role later.',
        },
      },
      {
        id: 'data',
        q: { ky: 'Маалыматым коопсузбу?', ru: 'Мои данные в безопасности?', en: 'Is my data safe?' },
        a: {
          ky: 'Ооба. Сырсөз шифрленип сакталат, эч кимге сатылбайт жана жарнамага берилбейт.',
          ru: 'Да. Пароль хранится в зашифрованном виде, данные никому не продаются и не передаются рекламодателям.',
          en: 'Yes. Passwords are stored hashed, and we never sell or hand your data to advertisers.',
        },
      },
    ],
  },

  footer: {
    enabled: true,
    tagline: {
      ky: 'JashMen — жаштар үчүн каржы сабаттуулугу.',
      ru: 'JashMen — финансовая грамотность для молодёжи.',
      en: 'JashMen — financial literacy for young people.',
    },
    instagram: 'https://www.instagram.com/jashmen.studio/',
    email: 'jashmenstudio@gmail.com',
    rights: {
      ky: '© JashMen Studio. Бардык укуктар корголгон.',
      ru: '© JashMen Studio. Все права защищены.',
      en: '© JashMen Studio. All rights reserved.',
    },
  },
};
