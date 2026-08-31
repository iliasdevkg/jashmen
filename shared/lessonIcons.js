// shared/lessonIcons.js — the lesson-node icon set.
//
// One list, four consumers: the admin panel renders it as a picker, the
// backend validates against it (contentStore.js#sanitizeLessonIcon), the web
// app maps each slug to a lucide component (shared/lessonIconComponents.jsx),
// and the Flutter app keeps a parallel map to Material icons
// (mobile/lib/src/core/lesson_icons.dart).
//
// Deliberately data-only — no React import — so admin-api can load it in
// Node without dragging a UI library into the server process.
//
// Adding an icon: append here, add the lucide component next to it in
// lessonIconComponents.jsx, and add the Material equivalent in
// lesson_icons.dart. A slug present here but missing from a client falls
// back to that client's default glyph rather than rendering nothing — but
// leaving one unmapped is a bug, not a feature.
//
// Slugs are permanent: a lesson stores the slug, so renaming one silently
// resets every lesson that used it back to the default icon.

export const LESSON_ICONS = [
  // Акча жана төлөм
  { slug: 'wallet',         label: 'Капчык' },
  { slug: 'coins',          label: 'Монеталар' },
  { slug: 'banknote',       label: 'Банкнот' },
  { slug: 'credit-card',    label: 'Карта' },
  { slug: 'hand-coins',     label: 'Акча берүү' },
  { slug: 'percent',        label: 'Пайыз' },

  // Банк, үнөмдөө, инвестиция
  { slug: 'piggy-bank',     label: 'Копилка' },
  { slug: 'landmark',       label: 'Банк' },
  { slug: 'trending-up',    label: 'Өсүш' },
  { slug: 'chart-pie',      label: 'Диаграмма' },
  { slug: 'chart-bar',      label: 'Графика' },
  { slug: 'sprout',         label: 'Өнүгүү' },

  // Пландоо жана эсеп
  { slug: 'calculator',     label: 'Калькулятор' },
  { slug: 'receipt',        label: 'Чек' },
  { slug: 'calendar',       label: 'Календарь' },
  { slug: 'clock',          label: 'Убакыт' },
  { slug: 'target',         label: 'Максат' },
  { slug: 'scale',          label: 'Тең салмак' },

  // Коопсуздук
  { slug: 'shield-check',   label: 'Коргоо' },
  { slug: 'key',            label: 'Ачкыч' },
  { slug: 'umbrella',       label: 'Камсыздандыруу' },

  // Турмуш
  { slug: 'home',           label: 'Үй' },
  { slug: 'car',            label: 'Унаа' },
  { slug: 'shopping-cart',  label: 'Соода' },
  { slug: 'gift',           label: 'Белек' },
  { slug: 'smartphone',     label: 'Телефон' },

  // Иш жана билим
  { slug: 'briefcase',      label: 'Жумуш' },
  { slug: 'building',       label: 'Компания' },
  { slug: 'handshake',      label: 'Келишим' },
  { slug: 'graduation-cap', label: 'Билим' },
  { slug: 'book-open',      label: 'Китеп' },
  { slug: 'lightbulb',      label: 'Идея' },

  // Мотивация
  { slug: 'rocket',         label: 'Старт' },
  { slug: 'star',           label: 'Жылдыз' },
  { slug: 'flame',          label: 'Стрик' },
  { slug: 'users',          label: 'Команда' },
  { slug: 'globe',          label: 'Дүйнө' },
  { slug: 'dumbbell',       label: 'Машыгуу' },
];

export const LESSON_ICON_SLUGS = new Set(LESSON_ICONS.map(i => i.slug));
