// Display names only: the underlying event IDs and report filters stay unchanged.
const labels: Record<string, string> = {
  session_start: "Початок відвідування", page_view: "Відкриття сторінки", page_leave: "Закриття сторінки",
  element_click: "Натискання", element_impression: "Показ елемента", scroll_depth: "Прокручування",
  engagement: "Активний час", article_read: "Ознака прочитання статті", quiz_started: "Початок вікторини",
  quiz_completed: "Завершення вікторини", form_open: "Відкриття форми", form_submit: "Надсилання форми",
  form_success: "Збережена заявка", form_error: "Помилка форми", frontend_error: "Помилка сайту",
  direct: "Прямий перехід", unknown: "Джерело невідоме", referral: "З іншого сайту", campaign: "Кампанія",
  utm: "Кампанія", referrer: "З іншого сайту", internal: "Всередині сайту", other: "Інше", download: "Завантаження",
  telegram: "Telegram", youtube: "YouTube", amazon: "Amazon", student: "Навчання", partner: "Співпраця",
  telegram_bot: "Quiz Arena Bot", telegram_channel: "Telegram-канал", deutsch_trainer: "Deutsch Trainer Bot",
  shorts_blocker: "Shorts Blocker Kids", worklog_apk: "Завантаження Worklog", books: "Книги",
  book_print: "Друкована книга", book_ebook: "Електронна книга", quiz_teaser_anchor: "Перехід до вікторини",
  nav_home: "Головна", nav_projects: "Проєкти", nav_wissen: "Статті", nav_learning: "Навчання", nav_contact: "Контакти", nav_menu: "Меню",
  student_form: "Форма навчання", partner_form: "Форма співпраці", header: "Верхнє меню", header_mobile: "Мобільне меню",
  hero: "Перший екран", channel: "Блок каналу", product_card: "Картка продукту", quiz_teaser: "Блок вікторини",
  home_projects: "Проєкти на головній", home_articles: "Статті на головній", home_contact: "Контакти на головній",
  contact: "Контакти", footer: "Нижня частина сторінки", related_articles: "Пов’язані статті", projects: "Проєкти",
  wissen: "Статті", article_kurzantwort: "Коротка відповідь у статті", daily: "Щоденна вікторина",
  browser: "Браузер", server: "Сервер", form_id: "Форма", submission_attempt_id: "Спроба надсилання",
  conversion_id: "Підтвердження заявки", error_code: "Код помилки", kind: "Вибірка", destination: "Призначення",
  event_name: "Дія", path: "Сторінка", element_id: "Елемент", placement: "Розташування",
  intent: "Зовнішній перехід", event: "Дія", page: "Сторінка", element: "Елемент", traffic: "Джерело переходу", form: "Форма", quiz: "Вікторина", error: "Помилка",
  referrer_host: "Сайт переходу", utm_source: "Джерело кампанії", utm_medium: "Канал кампанії", utm_campaign: "Кампанія",
};

export function analyticsLabel(value: string): string {
  return labels[value] ?? value;
}
