import type { Language } from '../db/types'

// Keyed by the exact English source string used in the UI — components call
// t('Some Label') and get the Russian text back (or the key itself in English
// mode / if untranslated). Currency codes, symbols, and full currency/coin
// names are intentionally never routed through here — they're excluded per
// product decision, not an oversight. DB-persisted freeform audit text
// (savingsHistory/cryptoHistory/loanHistory `comment` fields) is likewise
// left in English always, so history entries never mix languages depending
// on whatever the UI language happened to be when they were written.
export const RU: Record<string, string> = {
  // Nav / tabs
  Savings: 'Сбережения',
  Crypto: 'Крипто',
  Spending: 'Расходы',
  Settings: 'Настройки',

  // Lock screen
  'Savings Pocket is locked': 'Savings Pocket заблокирован',
  'Unlock with Face ID to continue': 'Разблокируйте через Face ID, чтобы продолжить',
  'Unlock failed or was cancelled — try again.': 'Разблокировка не удалась или была отменена — попробуйте снова.',
  'Waiting…': 'Ожидание…',
  Unlock: 'Разблокировать',

  // Savings view
  'Exchange rates': 'Курсы валют',
  'My money': 'Мои деньги',
  'Lent out': 'Одолжено',
  'Savings pockets': 'Копилки сбережений',
  'No savings tracked yet. Tap + to add your first entry.':
    'Сбережения ещё не добавлены. Нажмите +, чтобы добавить первую запись.',
  Cash: 'Наличные',
  Card: 'Карта',
  Default: 'По умолчанию',
  'See note': 'Посмотреть заметку',
  'View history': 'Смотреть историю',
  "No loans tracked yet. Tap + to add money you've lent someone.":
    'Займы ещё не добавлены. Нажмите +, чтобы добавить одолженные деньги.',

  // Loan form
  'Add loan': 'Добавить займ',
  'Edit loan': 'Изменить займ',
  'Lent to': 'Кому одолжено',
  'e.g. John': 'напр. Иван',
  'Details about this loan': 'Подробности об этом займе',
  "Why did this amount change? e.g. partial repayment": 'Почему изменилась сумма? напр. частичное погашение',
  'Loan updated': 'Займ обновлён',
  'Loan added': 'Займ добавлен',
  'Loan deleted': 'Займ удалён',
  'Delete this loan and all of its history? This cannot be undone.':
    'Удалить этот займ и всю его историю? Это действие необратимо.',

  // Savings pocket form
  'Edit savings pocket': 'Изменить копилку',
  'Add savings pocket': 'Добавить копилку',
  Currency: 'Валюта',
  Amount: 'Сумма',
  'Held as': 'Хранится как',
  'Location (country / bank / place)': 'Место (страна / банк / место)',
  'e.g. Spain — BBVA': 'напр. Испания — BBVA',
  Note: 'Заметка',
  'Details about this money': 'Подробности об этих деньгах',
  'Reason for change (saved to history)': 'Причина изменения (сохранится в истории)',
  'Why did this amount change?': 'Почему изменилась сумма?',
  Delete: 'Удалить',
  'Save changes': 'Сохранить изменения',
  'Add pocket': 'Добавить копилку',
  'this savings entry': 'эту запись сбережений',
  'Delete this entry and all of its history? This cannot be undone.':
    'Удалить эту запись и всю её историю? Это действие необратимо.',
  'Savings entry added': 'Запись сбережений добавлена',
  'Savings entry updated': 'Запись сбережений обновлена',
  'Savings entry deleted': 'Запись сбережений удалена',

  // Delete confirm modal
  'Confirm deletion': 'Подтвердите удаление',
  Cancel: 'Отмена',
  Continue: 'Продолжить',

  // Adjust pocket modal
  'Adjust balance': 'Изменить баланс',
  '+ Add': '+ Пополнить',
  '− Charge': '− Списать',
  " — can't go below zero": ' — не может быть меньше нуля',
  'Reason (saved to history)': 'Причина (сохранится в истории)',
  'e.g. Cash deposit': 'напр. Пополнение наличными',
  'e.g. Withdrew for a trip': 'напр. Снял на поездку',
  'Add to pocket': 'Пополнить копилку',
  'Charge from pocket': 'Списать с копилки',
  'Added to pocket': 'Добавлено в копилку',
  'Charged from pocket': 'Списано с копилки',

  // Exchange rates / net worth
  'Currency exchange rates': 'Курсы обмена валют',
  'Refreshing…': 'Обновление…',
  '↻ Refresh': '↻ Обновить',
  'Loading…': 'Загрузка…',
  'Exchange rates unavailable.': 'Курсы валют недоступны.',
  'Using last known rates (offline)': 'Используются последние известные курсы (офлайн)',
  Updated: 'Обновлено',
  'Total net worth': 'Общий капитал',
  'Calculating…': 'Расчёт…',
  'Using last known rates —': 'Используются последние известные курсы —',
  'Using last known exchange rates (offline).': 'Используются последние известные курсы обмена (офлайн).',

  // History modals
  History: 'История',
  'Manual changes': 'Ручные изменения',
  'No manual changes logged yet.': 'Ручных изменений пока нет.',
  'No spending debited from this pocket yet.': 'Списаний расходов с этой копилки пока нет.',
  'Amount history': 'История сумм',
  'No changes logged yet.': 'Изменений пока нет.',

  // Common
  Done: 'Готово',
  'Select currency': 'Выбрать валюту',
  'Select currencies': 'Выбрать валюты',
  Total: 'Всего',
  Close: 'Закрыть',
  Save: 'Сохранить',
  Unknown: 'Неизвестно',
  Optional: 'Необязательно',

  // Crypto view / form
  Rates: 'Курсы',
  '(offline, last known)': '(офлайн, последние известные)',
  updated: 'обновлены',
  'No crypto holdings yet. Tap + to add one.': 'Криптоактивов пока нет. Нажмите +, чтобы добавить.',
  'Price unavailable': 'Цена недоступна',
  'Worth up since last edit': 'Стоимость выросла с последнего изменения',
  'Worth down since last edit': 'Стоимость снизилась с последнего изменения',
  'Has a note': 'Есть заметка',
  '↻ Refresh rates': '↻ Обновить курсы',
  'Add crypto holding': 'Добавить криптоактив',
  'Edit crypto holding': 'Изменить криптоактив',
  Coin: 'Монета',
  'Custom coin…': 'Другая монета…',
  Symbol: 'Тикер',
  'e.g. LINK': 'напр. LINK',
  Name: 'Название',
  'e.g. Chainlink': 'напр. Chainlink',
  'CoinGecko id': 'ID на CoinGecko',
  "Find the id in the coin's CoinGecko URL, e.g. ": 'ID можно найти в ссылке на CoinGecko, напр. ',
  'e.g. Cold wallet, exchange name…': 'напр. Холодный кошелёк, название биржи…',
  'Add holding': 'Добавить актив',
  'Delete this crypto holding and its history? This cannot be undone.':
    'Удалить этот криптоактив и его историю? Это действие необратимо.',
  'Crypto holding updated': 'Криптоактив обновлён',
  'Crypto holding added': 'Криптоактив добавлен',
  'Crypto holding deleted': 'Криптоактив удалён',

  // Spending view / day entries
  Manage: 'Управление',
  'Total spent': 'Потрачено всего',
  'No spending logged this month yet. Tap any day to add an expense.':
    'В этом месяце расходов пока нет. Нажмите на день, чтобы добавить расход.',
  'By category': 'По категориям',
  Date: 'Дата',
  'Previous month': 'Предыдущий месяц',
  'Next month': 'Следующий месяц',
  'No categories yet.': 'Категорий пока нет.',
  'Create a category': 'Создать категорию',
  Category: 'Категория',
  'Select…': 'Выбрать…',
  'Debit from': 'Списать с',
  '+ Add expense': '+ Добавить расход',
  'Add expense': 'Добавить расход',
  'Repeat this expense': 'Повторять этот расход',
  Monthly: 'Ежемесячно',
  Annually: 'Ежегодно',
  'Every X days': 'Каждые X дней',
  'Repeats every (days)': 'Повторять каждые (дней)',
  'e.g. 14': 'напр. 14',
  'Spending entry updated': 'Расход обновлён',
  'Spending entry added': 'Расход добавлен',
  'Delete this spending entry?': 'Удалить этот расход?',
  'Spending entry deleted': 'Расход удалён',

  // Category manager
  'Manage categories': 'Управление категориями',
  'New category': 'Новая категория',
  'e.g. Groceries': 'напр. Продукты',
  'Add category': 'Добавить категорию',
  '(archived)': '(в архиве)',
  'No categories yet — add your first one above.': 'Категорий пока нет — добавьте первую выше.',
  'Category added': 'Категория добавлена',
  'Category updated': 'Категория обновлена',

  // Category expenses modal
  'Total this month': 'Всего за месяц',
  'No expenses in this category yet.': 'В этой категории пока нет расходов.',

  // Manage menu
  'Manage Categories': 'Управление категориями',
  'Manage Recurring Expenses': 'Управление регулярными расходами',
  Analytics: 'Аналитика',

  // Recurring expenses
  'Manage recurring expenses': 'Управление регулярными расходами',
  'No recurring expenses yet. Turn on "Repeat" when adding an expense to create one.':
    'Регулярных расходов пока нет. Включите «Повторять» при добавлении расхода, чтобы создать один.',
  'Make not recurring': 'Сделать разовым',
  'Stop this expense from recurring? Past expenses will not be affected.':
    'Остановить повтор этого расхода? Прошлые расходы не изменятся.',
  'Recurring expense updated': 'Регулярный расход обновлён',
  'Recurring expense stopped': 'Регулярный расход остановлен',
  'Next:': 'Далее:',

  // Analytics
  'Analytics is in progress — check back soon.': 'Раздел аналитики в разработке — загляните позже.',

  // Settings
  Currencies: 'Валюты',
  'Savings currencies': 'Валюты сбережений',
  'Shown as totals in Savings and Lent out — at least one required':
    'Показываются в итогах Сбережений и Одолженного — нужна минимум одна',
  'Currency used to display the combined savings + crypto + lent-out total':
    'Валюта для отображения общего итога сбережений, крипто и одолженного',
  'Crypto currencies': 'Валюты крипто',
  'Fiat currencies shown for crypto holdings and totals': 'Фиатные валюты для криптоактивов и итогов',
  'Spending currencies': 'Валюты расходов',
  'Shown in the spending calendar totals': 'Показываются в итогах календаря расходов',
  'Savings tracking': 'Учёт сбережений',
  'Savings tracking mode': 'Режим учёта сбережений',
  'What do these modes mean?': 'Что означают эти режимы?',
  Manual: 'Вручную',
  ' — spending is tracked separately and never changes your saving pocket balances.':
    ' — расходы учитываются отдельно и никогда не меняют баланс копилок.',
  'Auto spending': 'Автосписание',
  " — choose a default saving pocket per currency below; every expense you log is automatically debited from that pocket (you can pick a different one per expense) and shows up in that pocket's Spending history.":
    ' — выберите копилку по умолчанию для каждой валюты ниже; каждый добавленный расход будет автоматически списываться с этой копилки (для отдельного расхода можно выбрать другую) и появится в истории расходов этой копилки.',
  'Default saving pocket per currency': 'Копилка по умолчанию для каждой валюты',
  'Used when you log an expense — you can still override it per expense':
    'Используется при добавлении расхода — можно переопределить для отдельного расхода',
  'None selected': 'Не выбрано',
  'Unsaved changes': 'Есть несохранённые изменения',
  'Savings tracking settings saved': 'Настройки учёта сбережений сохранены',
  Security: 'Безопасность',
  'Face ID lock': 'Блокировка по Face ID',
  'Require Face ID / Touch ID to open the app': 'Требовать Face ID / Touch ID для открытия приложения',
  'Not available on this device or browser': 'Недоступно на этом устройстве или в браузере',
  'Turn off Face ID lock?': 'Отключить блокировку по Face ID?',
  'Could not set up Face ID on this device.': 'Не удалось настроить Face ID на этом устройстве.',
  'Face ID enabled': 'Face ID включён',
  'Face ID disabled': 'Face ID отключён',
  'Backup passcode': 'Резервный код',
  'Used to unlock if Face ID ever fails': 'Используется для разблокировки, если Face ID не сработает',
  'Set up': 'Настроить',
  Change: 'Изменить',
  'Set a backup passcode': 'Установите резервный код',
  'Used to unlock if Face ID ever fails. 4–6 digits.':
    'Используется для разблокировки, если Face ID не сработает. 4–6 цифр.',
  Passcode: 'Код',
  'Confirm passcode': 'Подтвердите код',
  'Save passcode': 'Сохранить код',
  'Passcode set': 'Код сохранён',
  'Use passcode instead': 'Использовать код вместо этого',
  'Incorrect passcode': 'Неверный код',
  'Try Face ID again': 'Попробовать Face ID снова',
  Language: 'Язык',
  Backup: 'Резервная копия',
  'All data is stored locally in your browser. Export a backup regularly, especially before clearing browser data or switching devices.':
    'Все данные хранятся локально в вашем браузере. Регулярно экспортируйте резервную копию, особенно перед очисткой данных браузера или сменой устройства.',
  'Export backup (.json)': 'Экспортировать копию (.json)',
  'Import backup (.json)': 'Импортировать копию (.json)',
  'Importing will replace ALL current data (savings, crypto, spending, categories) with the contents of this backup file. Continue?':
    'Импорт заменит ВСЕ текущие данные (сбережения, крипто, расходы, категории) содержимым этого файла резервной копии. Продолжить?',
  'Backup exported': 'Резервная копия экспортирована',
  'Failed to import backup': 'Не удалось импортировать резервную копию',
  'Savings Pocket — your data never leaves this device.': 'Savings Pocket — ваши данные никогда не покидают это устройство.',

  // Month names
  January: 'Январь',
  February: 'Февраль',
  March: 'Март',
  April: 'Апрель',
  May: 'Май',
  June: 'Июнь',
  July: 'Июль',
  August: 'Август',
  September: 'Сентябрь',
  October: 'Октябрь',
  November: 'Ноябрь',
  December: 'Декабрь',

  // Weekday labels
  Mon: 'Пн',
  Tue: 'Вт',
  Wed: 'Ср',
  Thu: 'Чт',
  Fri: 'Пт',
  Sat: 'Сб',
  Sun: 'Вс',
}

export function translate(lang: Language, text: string): string {
  if (lang !== 'ru') return text
  return RU[text] ?? text
}

// Russian pluralization: 1 день, 2–4 дня, 5–20 & 0 дней, then the pattern repeats.
function ruDayWord(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'день'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня'
  return 'дней'
}

export function tDays(lang: Language, n: number): string {
  return lang === 'ru' ? `${n} ${ruDayWord(n)}` : `${n} day${n === 1 ? '' : 's'}`
}

export function tCategoryArchiveHint(lang: Language, name: string, count: number): string {
  if (lang === 'ru') {
    return `«${name}» содержит записей расходов: ${count}. Заархивируйте вместо удаления, чтобы сохранить историю.`
  }
  return `"${name}" has ${count} spending entries. Archive it instead of deleting so history stays intact.`
}

export function tDeleteCategoryConfirm(lang: Language, name: string): string {
  return lang === 'ru' ? `Удалить категорию «${name}»?` : `Delete category "${name}"?`
}

export function tNoPocketWarning(lang: Language, currency: string): string {
  if (lang === 'ru') {
    return `Нет копилки в валюте ${currency} — создайте её в Сбережениях перед тем как записывать расходы в этой валюте.`
  }
  return `No saving pocket exists in ${currency} — create one in Savings before logging spending in this currency.`
}

export function tNoPocketYet(lang: Language, currency: string): string {
  return lang === 'ru' ? `Нет копилки в валюте ${currency}` : `No pocket in ${currency} yet`
}

export function tExpandLabel(lang: Language, label: string): string {
  return lang === 'ru' ? `Развернуть: ${label}` : `Expand ${label}`
}

export function tImportComplete(lang: Language, total: number): string {
  return lang === 'ru' ? `Импорт завершён — записей восстановлено: ${total}` : `Import complete — ${total} records restored`
}

export function tDeleteConfirmBody(lang: Language, itemLabel: string): string {
  if (lang === 'ru') {
    return `Это навсегда удалит ${itemLabel} и всю её историю. Введите DELETE, чтобы продолжить.`
  }
  return `This will permanently delete ${itemLabel} and its full history. Type DELETE to continue.`
}
