// scripts/icons.source.js — THE list. Everything else is generated from it.
//
// One row per icon:
//   slug      what a lesson/module/league/achievement stores. PERMANENT —
//             renaming one silently resets every record that used it.
//   component the lucide-react export the web imports and the SVG is read
//             from. Slug and component are deliberately separate: lucide
//             renames its exports between versions, and our stored data
//             must not move when it does.
//   label     what the admin's picker shows, in Kyrgyz.
//   group     the picker's section heading.
//
// After editing, run:  node scripts/gen-icons.mjs
// That rewrites shared/lessonIcons.js, shared/lessonIconComponents.jsx and
// mobile/lib/src/core/lucide_svg.dart so the admin, the web app and the
// Flutter app can never disagree about what a slug looks like.

export const ICON_SOURCE = [
  // ── Акча жана төлөм
  { slug: 'wallet', component: 'Wallet', label: 'Капчык', group: 'Акча жана төлөм' },
  { slug: 'wallet-cards', component: 'WalletCards', label: 'Капчык (карталуу)', group: 'Акча жана төлөм' },
  { slug: 'coins', component: 'Coins', label: 'Монеталар', group: 'Акча жана төлөм' },
  { slug: 'banknote', component: 'Banknote', label: 'Банкнот', group: 'Акча жана төлөм' },
  { slug: 'credit-card', component: 'CreditCard', label: 'Банк картасы', group: 'Акча жана төлөм' },
  { slug: 'hand-coins', component: 'HandCoins', label: 'Акча берүү', group: 'Акча жана төлөм' },
  { slug: 'percent', component: 'Percent', label: 'Пайыз', group: 'Акча жана төлөм' },
  { slug: 'badge-percent', component: 'BadgePercent', label: 'Арзандатуу', group: 'Акча жана төлөм' },
  { slug: 'circle-dollar-sign', component: 'CircleDollarSign', label: 'Доллар', group: 'Акча жана төлөм' },
  { slug: 'badge-dollar-sign', component: 'BadgeDollarSign', label: 'Баа', group: 'Акча жана төлөм' },
  { slug: 'receipt', component: 'Receipt', label: 'Чек', group: 'Акча жана төлөм' },
  { slug: 'receipt-text', component: 'ReceiptText', label: 'Кассалык чек', group: 'Акча жана төлөм' },
  { slug: 'arrow-left-right', component: 'ArrowLeftRight', label: 'Которуу', group: 'Акча жана төлөм' },
  { slug: 'gem', component: 'Gem', label: 'Асыл таш', group: 'Акча жана төлөм' },

  // ── Банк, үнөмдөө, инвестиция
  { slug: 'piggy-bank', component: 'PiggyBank', label: 'Чочко-копилка', group: 'Банк, үнөмдөө, инвестиция' },
  { slug: 'landmark', component: 'Landmark', label: 'Банк', group: 'Банк, үнөмдөө, инвестиция' },
  { slug: 'trending-up', component: 'TrendingUp', label: 'Өсүү', group: 'Банк, үнөмдөө, инвестиция' },
  { slug: 'trending-down', component: 'TrendingDown', label: 'Түшүү', group: 'Банк, үнөмдөө, инвестиция' },
  { slug: 'chart-pie', component: 'PieChart', label: 'Тегерек диаграмма', group: 'Банк, үнөмдөө, инвестиция' },
  { slug: 'chart-bar', component: 'BarChart3', label: 'Устун диаграмма', group: 'Банк, үнөмдөө, инвестиция' },
  { slug: 'chart-line', component: 'LineChart', label: 'Сызык диаграмма', group: 'Банк, үнөмдөө, инвестиция' },
  { slug: 'chart-area', component: 'AreaChart', label: 'Аймак диаграмма', group: 'Банк, үнөмдөө, инвестиция' },
  { slug: 'chart-candlestick', component: 'CandlestickChart', label: 'Биржа графиги', group: 'Банк, үнөмдөө, инвестиция' },
  { slug: 'sprout', component: 'Sprout', label: 'Өсүмдүк', group: 'Банк, үнөмдөө, инвестиция' },
  { slug: 'layers', component: 'Layers', label: 'Портфель', group: 'Банк, үнөмдөө, инвестиция' },
  { slug: 'gauge', component: 'Gauge', label: 'Көрсөткүч', group: 'Банк, үнөмдөө, инвестиция' },

  // ── Пландоо жана убакыт
  { slug: 'calculator', component: 'Calculator', label: 'Эсептегич', group: 'Пландоо жана убакыт' },
  { slug: 'calendar', component: 'Calendar', label: 'Календарь', group: 'Пландоо жана убакыт' },
  { slug: 'calendar-check', component: 'CalendarCheck', label: 'Пландалган күн', group: 'Пландоо жана убакыт' },
  { slug: 'calendar-clock', component: 'CalendarClock', label: 'Мөөнөт', group: 'Пландоо жана убакыт' },
  { slug: 'clock', component: 'Clock', label: 'Саат', group: 'Пландоо жана убакыт' },
  { slug: 'timer', component: 'Timer', label: 'Таймер', group: 'Пландоо жана убакыт' },
  { slug: 'hourglass', component: 'Hourglass', label: 'Кум сааты', group: 'Пландоо жана убакыт' },
  { slug: 'target', component: 'Target', label: 'Максат', group: 'Пландоо жана убакыт' },
  { slug: 'scale', component: 'Scale', label: 'Тараза', group: 'Пландоо жана убакыт' },
  { slug: 'list-checks', component: 'ListChecks', label: 'Текшерүү тизмеси', group: 'Пландоо жана убакыт' },
  { slug: 'clipboard-list', component: 'ClipboardList', label: 'Планшет', group: 'Пландоо жана убакыт' },
  { slug: 'notebook-pen', component: 'NotebookPen', label: 'Дептер', group: 'Пландоо жана убакыт' },

  // ── Коопсуздук жана алдамчылык
  { slug: 'shield-check', component: 'ShieldCheck', label: 'Калкан', group: 'Коопсуздук жана алдамчылык' },
  { slug: 'shield-alert', component: 'ShieldAlert', label: 'Коркунуч', group: 'Коопсуздук жана алдамчылык' },
  { slug: 'key', component: 'Key', label: 'Ачкыч', group: 'Коопсуздук жана алдамчылык' },
  { slug: 'lock', component: 'Lock', label: 'Кулпу', group: 'Коопсуздук жана алдамчылык' },
  { slug: 'unlock', component: 'Unlock', label: 'Ачык кулпу', group: 'Коопсуздук жана алдамчылык' },
  { slug: 'umbrella', component: 'Umbrella', label: 'Камсыздандыруу', group: 'Коопсуздук жана алдамчылык' },
  { slug: 'fingerprint', component: 'Fingerprint', label: 'Манжа изи', group: 'Коопсуздук жана алдамчылык' },
  { slug: 'scan-face', component: 'ScanFace', label: 'Жүздү таануу', group: 'Коопсуздук жана алдамчылык' },
  { slug: 'eye-off', component: 'EyeOff', label: 'Жашыруу', group: 'Коопсуздук жана алдамчылык' },
  { slug: 'triangle-alert', component: 'TriangleAlert', label: 'Эскертүү', group: 'Коопсуздук жана алдамчылык' },
  { slug: 'octagon-alert', component: 'OctagonAlert', label: 'Токто', group: 'Коопсуздук жана алдамчылык' },
  { slug: 'ban', component: 'Ban', label: 'Тыюу', group: 'Коопсуздук жана алдамчылык' },
  { slug: 'bug', component: 'Bug', label: 'Вирус', group: 'Коопсуздук жана алдамчылык' },
  { slug: 'user-x', component: 'UserX', label: 'Шектүү адам', group: 'Коопсуздук жана алдамчылык' },

  // ── Соода жана турмуш
  { slug: 'home', component: 'Home', label: 'Үй', group: 'Соода жана турмуш' },
  { slug: 'house-plus', component: 'HousePlus', label: 'Турак жай', group: 'Соода жана турмуш' },
  { slug: 'car', component: 'Car', label: 'Унаа', group: 'Соода жана турмуш' },
  { slug: 'shopping-cart', component: 'ShoppingCart', label: 'Себет', group: 'Соода жана турмуш' },
  { slug: 'shopping-bag', component: 'ShoppingBag', label: 'Соода', group: 'Соода жана турмуш' },
  { slug: 'store', component: 'Store', label: 'Дүкөн', group: 'Соода жана турмуш' },
  { slug: 'gift', component: 'Gift', label: 'Белек', group: 'Соода жана турмуш' },
  { slug: 'utensils', component: 'Utensils', label: 'Тамактануу', group: 'Соода жана турмуш' },
  { slug: 'shirt', component: 'Shirt', label: 'Кийим', group: 'Соода жана турмуш' },
  { slug: 'fuel', component: 'Fuel', label: 'Май куюу', group: 'Соода жана турмуш' },
  { slug: 'smartphone', component: 'Smartphone', label: 'Телефон', group: 'Соода жана турмуш' },
  { slug: 'ticket', component: 'Ticket', label: 'Билет', group: 'Соода жана турмуш' },

  // ── Иш жана бизнес
  { slug: 'briefcase', component: 'Briefcase', label: 'Портфель', group: 'Иш жана бизнес' },
  { slug: 'building', component: 'Building', label: 'Кеңсе', group: 'Иш жана бизнес' },
  { slug: 'building-2', component: 'Building2', label: 'Компания', group: 'Иш жана бизнес' },
  { slug: 'factory', component: 'Factory', label: 'Өндүрүш', group: 'Иш жана бизнес' },
  { slug: 'handshake', component: 'Handshake', label: 'Келишим', group: 'Иш жана бизнес' },
  { slug: 'hard-hat', component: 'HardHat', label: 'Курулуш', group: 'Иш жана бизнес' },
  { slug: 'users', component: 'Users', label: 'Команда', group: 'Иш жана бизнес' },
  { slug: 'user-round-check', component: 'UserRoundCheck', label: 'Ишеничтүү', group: 'Иш жана бизнес' },
  { slug: 'network', component: 'Network', label: 'Тармак', group: 'Иш жана бизнес' },
  { slug: 'megaphone', component: 'Megaphone', label: 'Жарнама', group: 'Иш жана бизнес' },
  { slug: 'contact-round', component: 'ContactRound', label: 'Байланыш', group: 'Иш жана бизнес' },

  // ── Билим
  { slug: 'graduation-cap', component: 'GraduationCap', label: 'Билим', group: 'Билим' },
  { slug: 'book-open', component: 'BookOpen', label: 'Ачык китеп', group: 'Билим' },
  { slug: 'book', component: 'Book', label: 'Китеп', group: 'Билим' },
  { slug: 'library', component: 'Library', label: 'Китепкана', group: 'Билим' },
  { slug: 'school', component: 'School', label: 'Мектеп', group: 'Билим' },
  { slug: 'lightbulb', component: 'Lightbulb', label: 'Идея', group: 'Билим' },
  { slug: 'brain', component: 'Brain', label: 'Ой жүгүртүү', group: 'Билим' },
  { slug: 'pencil', component: 'Pencil', label: 'Калем', group: 'Билим' },
  { slug: 'presentation', component: 'Presentation', label: 'Презентация', group: 'Билим' },
  { slug: 'backpack', component: 'Backpack', label: 'Студент', group: 'Билим' },
  { slug: 'microscope', component: 'Microscope', label: 'Изилдөө', group: 'Билим' },

  // ── Мотивация жана сыйлык
  { slug: 'rocket', component: 'Rocket', label: 'Ракета', group: 'Мотивация жана сыйлык' },
  { slug: 'star', component: 'Star', label: 'Жылдыз', group: 'Мотивация жана сыйлык' },
  { slug: 'flame', component: 'Flame', label: 'От', group: 'Мотивация жана сыйлык' },
  { slug: 'trophy', component: 'Trophy', label: 'Кубок', group: 'Мотивация жана сыйлык' },
  { slug: 'medal', component: 'Medal', label: 'Медаль', group: 'Мотивация жана сыйлык' },
  { slug: 'award', component: 'Award', label: 'Сыйлык', group: 'Мотивация жана сыйлык' },
  { slug: 'crown', component: 'Crown', label: 'Таажы', group: 'Мотивация жана сыйлык' },
  { slug: 'party-popper', component: 'PartyPopper', label: 'Майрам', group: 'Мотивация жана сыйлык' },
  { slug: 'thumbs-up', component: 'ThumbsUp', label: 'Мыкты', group: 'Мотивация жана сыйлык' },
  { slug: 'heart', component: 'Heart', label: 'Жүрөк', group: 'Мотивация жана сыйлык' },
  { slug: 'sparkles', component: 'Sparkles', label: 'Жаңы', group: 'Мотивация жана сыйлык' },
  { slug: 'zap', component: 'Zap', label: 'Энергия', group: 'Мотивация жана сыйлык' },
  { slug: 'dumbbell', component: 'Dumbbell', label: 'Машыгуу', group: 'Мотивация жана сыйлык' },

  // ── Байланыш жана санарип
  { slug: 'mail', component: 'Mail', label: 'Кат', group: 'Байланыш жана санарип' },
  { slug: 'message-circle', component: 'MessageCircle', label: 'Билдирүү', group: 'Байланыш жана санарип' },
  { slug: 'bell', component: 'Bell', label: 'Эскертме', group: 'Байланыш жана санарип' },
  { slug: 'phone', component: 'Phone', label: 'Чалуу', group: 'Байланыш жана санарип' },
  { slug: 'wifi', component: 'Wifi', label: 'Интернет', group: 'Байланыш жана санарип' },
  { slug: 'qr-code', component: 'QrCode', label: 'QR коду', group: 'Байланыш жана санарип' },
  { slug: 'cloud', component: 'Cloud', label: 'Булут', group: 'Байланыш жана санарип' },
  { slug: 'database', component: 'Database', label: 'Маалымат', group: 'Байланыш жана санарип' },
  { slug: 'server', component: 'Server', label: 'Сервер', group: 'Байланыш жана санарип' },
  { slug: 'share-2', component: 'Share2', label: 'Бөлүшүү', group: 'Байланыш жана санарип' },

  // ── Транспорт жана саякат
  { slug: 'plane', component: 'Plane', label: 'Учак', group: 'Транспорт жана саякат' },
  { slug: 'bus', component: 'Bus', label: 'Автобус', group: 'Транспорт жана саякат' },
  { slug: 'bike', component: 'Bike', label: 'Велосипед', group: 'Транспорт жана саякат' },
  { slug: 'map-pin', component: 'MapPin', label: 'Дарек', group: 'Транспорт жана саякат' },
  { slug: 'navigation', component: 'Navigation', label: 'Багыт', group: 'Транспорт жана саякат' },
  { slug: 'compass', component: 'Compass', label: 'Компас', group: 'Транспорт жана саякат' },
  { slug: 'globe', component: 'Globe', label: 'Дүйнө', group: 'Транспорт жана саякат' },

  // ── Үй-бүлө, табият
  { slug: 'baby', component: 'Baby', label: 'Бала', group: 'Үй-бүлө, табият' },
  { slug: 'dog', component: 'Dog', label: 'Үй жаныбары', group: 'Үй-бүлө, табият' },
  { slug: 'hand-heart', component: 'HandHeart', label: 'Кайрымдуулук', group: 'Үй-бүлө, табият' },
  { slug: 'leaf', component: 'Leaf', label: 'Жалбырак', group: 'Үй-бүлө, табият' },
  { slug: 'recycle', component: 'Recycle', label: 'Кайра иштетүү', group: 'Үй-бүлө, табият' },
  { slug: 'sun', component: 'Sun', label: 'Күн', group: 'Үй-бүлө, табият' },
  { slug: 'droplet', component: 'Droplet', label: 'Суу', group: 'Үй-бүлө, табият' },
  { slug: 'wind', component: 'Wind', label: 'Шамал', group: 'Үй-бүлө, табият' },
  { slug: 'battery-charging', component: 'BatteryCharging', label: 'Кубаттоо', group: 'Үй-бүлө, табият' },
  { slug: 'tree-deciduous', component: 'TreeDeciduous', label: 'Дарак', group: 'Үй-бүлө, табият' },

  // ── Белгилер
  { slug: 'plus', component: 'Plus', label: 'Кошуу', group: 'Белгилер' },
  { slug: 'minus', component: 'Minus', label: 'Кемитүү', group: 'Белгилер' },
  { slug: 'check', component: 'Check', label: 'Белги', group: 'Белгилер' },
  { slug: 'x', component: 'X', label: 'Жабуу', group: 'Белгилер' },
  { slug: 'info', component: 'Info', label: 'Маалымат', group: 'Белгилер' },
  { slug: 'circle-help', component: 'CircleHelp', label: 'Суроо', group: 'Белгилер' },
  { slug: 'settings', component: 'Settings', label: 'Жөндөө', group: 'Белгилер' },
  { slug: 'search', component: 'Search', label: 'Издөө', group: 'Белгилер' },
  { slug: 'filter', component: 'Filter', label: 'Чыпка', group: 'Белгилер' },
  { slug: 'arrow-up', component: 'ArrowUp', label: 'Өйдө', group: 'Белгилер' },
  { slug: 'arrow-down', component: 'ArrowDown', label: 'Ылдый', group: 'Белгилер' },
  { slug: 'chevron-right', component: 'ChevronRight', label: 'Кийинки', group: 'Белгилер' },
];
