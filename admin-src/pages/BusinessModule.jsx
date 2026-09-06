// admin-src/pages/BusinessModule.jsx — every word and picture on
// https://jashmenstudio.com/
//
// Mirrors contentStore.js#BUSINESS_SECTIONS field for field. The backend
// silently drops anything not listed there, so a field added here without
// its counterpart would look like it saved and then vanish on reload — and
// a field there without one here is simply uneditable.
//
// Two things on that page are deliberately NOT here, because they are facts
// rather than copy: the counters under "Продукт работает сегодня" come from
// the live database, and the logos under "Нам доверяют" are the real
// partners (Өнөктөштөр tab) and campuses (Университеттер tab). Only their
// labels are edited here.
import { Compass, Rocket, Sparkles, Handshake, Lightbulb, LayoutGrid, BarChart3, Megaphone, Send, Link2 } from 'lucide-react';
import * as api from '../api.js';
import { SectionsEditor } from '../components/SectionsEditor.jsx';

const SECTIONS = [
  {
    key: 'nav', label: 'Навигация', icon: Compass,
    hint: 'Беттин үстүндөгү менюнун жазуулары.',
    fields: [
      { key: 'solutions', label: 'Чечимдер (ачылма меню)' },
      { key: 'partners', label: 'Өнөктөштөр' },
      { key: 'integration', label: 'Интеграция' },
      { key: 'impact', label: 'Таасири' },
      { key: 'product', label: 'Продукт' },
      { key: 'forStudents', label: 'Студенттерге' },
      { key: 'cta', label: 'Негизги баскыч' },
    ],
  },
  {
    key: 'hero', label: 'Башкы экран', icon: Rocket,
    hint: 'Ураан төрт сапка бөлүнөт — акыркы экөө градиент менен боёлот. '
      + 'Бош сапты калтырсаңыз, ал сап такыр чыкпайт. Видео койсоңуз гана '
      + 'ойнотуу баскычы пайда болот.',
    fields: [
      { key: 'line1', label: 'Ураан — 1-сап' },
      { key: 'line2', label: 'Ураан — 2-сап' },
      { key: 'line3', label: 'Ураан — 3-сап (градиент)' },
      { key: 'line4', label: 'Ураан — 4-сап (градиент)' },
      { key: 'lead', label: 'Түшүндүрмө', multiline: true },
      { key: 'primaryCta', label: 'Негизги баскыч' },
      { key: 'secondaryCta', label: 'Экинчи баскыч' },
      { key: 'videoLabel', label: 'Видео баскычынын жазуусу' },
    ],
    video: { key: 'videoUrl', label: 'Видео' },
    images: [
      { key: 'videoPoster', label: 'Видеонун постери (милдеттүү эмес)' },
      { key: 'imageUrl', label: 'Башкы сүрөт — койсоңуз кыймылдаган графиканын ордуна чыгат' },
    ],
  },
  {
    key: 'strip', label: 'Төрт өзгөчөлүк', icon: Sparkles,
    hint: 'Башкы экрандын астындагы тилке. Ар бирине иконка тандаңыз.',
    fields: [],
    list: {
      key: 'items', label: 'Өзгөчөлүктөр', addLabel: 'Өзгөчөлүк кошуу', max: 6, icon: true,
      fields: [{ key: 'label', label: 'Жазуусу' }],
    },
  },
  {
    key: 'trust', label: 'Ишеним тилкеси', icon: Handshake,
    hint: 'Логотиптер бул жерде эмес — алар «Өнөктөштөр» жана '
      + '«Университеттер» бөлүмдөрүнөн автоматтык алынат. Бул жерде жазуусу гана.',
    fields: [
      { key: 'label', label: 'Тилкенин жазуусу' },
      { key: 'empty', label: 'Өнөктөш жок болгондо', multiline: true },
    ],
  },
  {
    key: 'why', label: 'Эмне үчүн JashMen', icon: Lightbulb,
    hint: 'Беш карточка. Ар бирине иконка тандалат.',
    fields: [
      { key: 'title', label: 'Бөлүмдүн аталышы' },
      { key: 'note', label: 'Оң жактагы түшүндүрмө', multiline: true },
    ],
    list: {
      key: 'items', label: 'Карточкалар', addLabel: 'Карточка кошуу', max: 8, icon: true,
      fields: [
        { key: 'title', label: 'Аталышы' },
        { key: 'text', label: 'Тексти', multiline: true },
      ],
    },
  },
  {
    key: 'solutions', label: 'Чечимдер (табдар)', icon: LayoutGrid,
    hint: 'Ар бир таб — өзүнчө аудитория. Сүрөт койсоңуз, тартылган '
      + 'сүрөттүн ордуна ошол чыгат.',
    fields: [
      { key: 'title', label: 'Бөлүмдүн аталышы' },
      { key: 'note', label: 'Оң жактагы түшүндүрмө', multiline: true },
      { key: 'cta', label: 'Карточкадагы баскыч' },
    ],
    list: {
      key: 'items', label: 'Табдар', addLabel: 'Таб кошуу', max: 8,
      images: [{ key: 'imageUrl', label: 'Сүрөтү (милдеттүү эмес)' }],
      fields: [
        { key: 'tab', label: 'Табдын жазуусу' },
        { key: 'title', label: 'Аталышы' },
        { key: 'text', label: 'Тексти', multiline: true },
        { key: 'p1', label: '1-пункт' },
        { key: 'p2', label: '2-пункт' },
        { key: 'p3', label: '3-пункт' },
      ],
    },
  },
  {
    key: 'stats', label: 'Сандар', icon: BarChart3,
    hint: 'Сандардын өзү базадан алынат — бул жерде аталыштары гана.',
    fields: [
      { key: 'title', label: 'Бөлүмдүн аталышы' },
      { key: 'note', label: 'Оң жактагы түшүндүрмө', multiline: true },
      { key: 'learnersLabel', label: 'Студенттер — аталышы' },
      { key: 'lessonsLabel', label: 'Сабактар — аталышы' },
      { key: 'modulesLabel', label: 'Модулдар — аталышы' },
      { key: 'universitiesLabel', label: 'Кампустар — аталышы' },
      { key: 'xpLabel', label: 'XP — аталышы' },
    ],
  },
  {
    key: 'cta', label: 'Чакырык тилкеси', icon: Megaphone,
    hint: 'Форманын үстүндөгү көк тилке.',
    fields: [
      { key: 'line1', label: 'Аталыш — 1-сап' },
      { key: 'line2', label: 'Аталыш — 2-сап' },
      { key: 'text', label: 'Тексти', multiline: true },
      { key: 'button', label: 'Баскычтын жазуусу' },
    ],
    images: [{ key: 'imageUrl', label: 'Сүрөтү — бош болсо логотип чыгат' }],
  },
  {
    key: 'form', label: 'Арыз формасы', icon: Send,
    hint: 'Толтурулган арыз «Кайрылуулар» бөлүмүнө түшөт.',
    fields: [
      { key: 'title', label: 'Бөлүмдүн аталышы' },
      { key: 'note', label: 'Түшүндүрмө', multiline: true },
      { key: 'organization', label: 'Уюм — талаанын аты' },
      { key: 'organizationPh', label: 'Уюм — мисал жазуу' },
      { key: 'contact', label: 'Байланыш адамы — талаанын аты' },
      { key: 'contactPh', label: 'Байланыш адамы — мисал жазуу' },
      { key: 'email', label: 'Email — талаанын аты' },
      { key: 'emailPh', label: 'Email — мисал жазуу' },
      { key: 'phone', label: 'Телефон — талаанын аты' },
      { key: 'phonePh', label: 'Телефон — мисал жазуу' },
      { key: 'optional', label: '«милдеттүү эмес» деген белги' },
      { key: 'interest', label: 'Кызыгуу — суроонун жазуусу' },
      { key: 'iLeague', label: 'Тандоо — сезон' },
      { key: 'iModule', label: 'Тандоо — модуль' },
      { key: 'iRewards', label: 'Тандоо — сыйлыктар' },
      { key: 'iIntegration', label: 'Тандоо — башка' },
      { key: 'message', label: 'Комментарий — талаанын аты' },
      { key: 'messagePh', label: 'Комментарий — мисал жазуу', multiline: true },
      { key: 'submit', label: 'Жиберүү баскычы' },
      { key: 'sending', label: 'Жиберилип жатканда' },
      { key: 'retry', label: 'Кайра аракет баскычы' },
      { key: 'privacy', label: 'Купуялык жөнүндө эскертүү', multiline: true },
      { key: 'okTitle', label: 'Ийгилик — аталышы' },
      { key: 'okBody', label: 'Ийгилик — тексти', multiline: true },
      { key: 'okAgain', label: 'Ийгилик — дагы жиберүү баскычы' },
      { key: 'failBody', label: 'Ката — тексти', multiline: true },
    ],
  },
  {
    key: 'footer', label: 'Ылдыйкы бөлүк', icon: Link2,
    hint: 'Шилтемелердин «Мамыча» талаасы 1, 2 же 3 — кайсы мамычада '
      + 'турарын билдирет. APK шилтемесин койсоңуз, жүктөө баскычы чыгат.',
    fields: [
      { key: 'tagline', label: 'Кыска сүрөттөмө', multiline: true },
      { key: 'col1', label: '1-мамычанын аталышы' },
      { key: 'col2', label: '2-мамычанын аталышы' },
      { key: 'col3', label: '3-мамычанын аталышы' },
      { key: 'newsTitle', label: 'Жазылуу — аталышы' },
      { key: 'newsNote', label: 'Жазылуу — түшүндүрмө', multiline: true },
      { key: 'newsPlaceholder', label: 'Жазылуу — мисал жазуу' },
      { key: 'newsOk', label: 'Жазылуу — ийгилик' },
      { key: 'newsBad', label: 'Жазылуу — туура эмес email' },
      { key: 'newsFail', label: 'Жазылуу — ката' },
      { key: 'apkLabel', label: 'APK баскычынын жазуусу' },
      { key: 'rights', label: 'Автордук укук' },
    ],
    links: [
      { key: 'apkUrl', label: 'APK шилтемеси', placeholder: '/admin/api/uploads/jashmen.apk' },
    ],
    plains: [
      { key: 'email', label: 'Байланыш почтасы', placeholder: 'jashmenstudio@gmail.com' },
      { key: 'instagram', label: 'Instagram шилтемеси', placeholder: 'https://www.instagram.com/...' },
    ],
    list: {
      key: 'links', label: 'Шилтемелер', addLabel: 'Шилтеме кошуу', max: 18,
      plains: [
        { key: 'col', label: 'Мамыча (1, 2 же 3)', placeholder: '1' },
        { key: 'href', label: 'Кайда алып барат', placeholder: '#apply же /login' },
      ],
      fields: [{ key: 'label', label: 'Жазуусу' }],
    },
  },
];

export default function BusinessModule({ token, onAuthError }) {
  return (
    <SectionsEditor
      token={token}
      onAuthError={onAuthError}
      sections={SECTIONS}
      fetchAll={api.fetchBusiness}
      saveOne={api.saveBusiness}
      title="Бизнес бет"
      hint="jashmenstudio.com дарегине кирген ар бир адам көргөн бет. Үч тилде тең толтуруңуз."
      siteUrl="https://jashmenstudio.com/"
    />
  );
}
