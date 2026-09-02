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
  'For spending': 'На расходы',
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
  'My Pockets': 'Мои копилки',
  'No savings tracked yet. Tap + to add your first entry.':
    'Сбережения ещё не добавлены. Нажмите +, чтобы добавить первую запись.',
  Cash: 'Наличные',
  Card: 'Карта',
  Default: 'По умолчанию',
  'See note': 'Посмотреть заметку',
  'View history': 'Смотреть историю',
  Edit: 'Изменить',
  'More actions': 'Другие действия',
  "No loans tracked yet. Tap + to add money you've lent someone.":
    'Займы ещё не добавлены. Нажмите +, чтобы добавить одолженные деньги.',

  // Credits
  Credits: 'Кредиты',
  'No credits tracked yet. Tap + to add money you owe.':
    'Кредиты ещё не добавлены. Нажмите +, чтобы добавить деньги, которые вы должны.',
  'Add credit': 'Добавить кредит',
  'Edit credit': 'Изменить кредит',
  'Credit added': 'Кредит добавлен',
  'Credit updated': 'Кредит обновлён',
  'Credit deleted': 'Кредит удалён',
  'this credit': 'этот кредит',
  'Amount owed': 'Сумма долга',
  Purpose: 'Назначение',
  'Include credits in net worth': 'Учитывать кредиты в общем капитале',
  'Credits are excluded from Total net worth by default': 'По умолчанию кредиты не учитываются в общем капитале',

  // Transfer
  Transfer: 'Перевод',
  Pockets: 'Копилки',
  'Move from': 'Откуда',
  'Move to': 'Куда',
  'Move money between any of your own pockets, credits, and loans.':
    'Переводите деньги между любыми своими копилками, кредитами и займами.',
  'No other account in this currency to transfer to.': 'Нет другого счёта в этой валюте, куда можно перевести.',
  'Transfer completed': 'Перевод выполнен',
  'e.g. Moving savings to a better rate account': 'напр. Перенос сбережений на счёт с лучшей ставкой',

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
  'Currency converter': 'Конвертер валют',
  'Refreshing…': 'Обновление…',
  '↻ Refresh': '↻ Обновить',
  'Loading…': 'Загрузка…',
  'Exchange rates unavailable.': 'Курсы валют недоступны.',
  'Using last known rates (offline)': 'Используются последние известные курсы (офлайн)',
  Updated: 'Обновлено',
  'Total net worth': 'Общий капитал',
  'Show details': 'Показать детали',
  'Hide details': 'Скрыть детали',
  'Calculating…': 'Расчёт…',
  'Using last known rates —': 'Используются последние известные курсы —',
  'Using last known exchange rates (offline).': 'Используются последние известные курсы обмена (офлайн).',

  // History modals
  History: 'История',
  'Manual changes': 'Ручные изменения',
  'No manual changes logged yet.': 'Ручных изменений пока нет.',
  'No spending debited from this pocket yet.': 'Списаний расходов с этой копилки пока нет.',
  'Deleted — this spending no longer counts': 'Удалено — этот расход больше не учитывается',
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
  Mandatory: 'Обязательно',
  'Mandatory for recurring': 'Обязательно для регулярных расходов',

  // Crypto view / form
  Rates: 'Курсы',
  '(offline, last known)': '(офлайн, последние известные)',
  updated: 'обновлены',
  'No crypto holdings yet. Tap + to add one.': 'Криптоактивов пока нет. Нажмите +, чтобы добавить.',
  'Price unavailable': 'Цена недоступна',
  'Worth up since last edit': 'Стоимость выросла с последнего изменения',
  'Worth down since last edit': 'Стоимость снизилась с последнего изменения',
  'Has a note': 'Есть заметка',
  Pinned: 'Закреплено',
  'Pin to top': 'Закрепить сверху',
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
  'Spent & scheduled': 'Потрачено и запланировано',
  'No spending logged this month yet. Tap any day to add an expense.':
    'В этом месяце расходов пока нет. Нажмите на день, чтобы добавить расход.',
  'Recurring expense planned for this day': 'На этот день запланирован повторяющийся расход',
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
  Archive: 'Архивировать',
  Unarchive: 'Восстановить',
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
  'Planning sandbox': 'Песочница планирования',
  'Manage budget': 'Управление бюджетом',

  // Monthly planning
  'A sandbox to see what you can afford this month — separate from your real pockets and spending until it actually happens. Save multiple named plans to compare.':
    'Песочница, чтобы увидеть, что вы можете себе позволить в этом месяце — отдельно от реальных копилок и расходов, пока это не произойдёт на самом деле. Сохраняйте несколько именованных планов, чтобы сравнивать.',
  'Existing plans': 'Существующие планы',
  'No plans yet. Create one below to start sketching out a month.':
    'Пока нет планов. Создайте один ниже, чтобы начать планировать месяц.',
  'New plan name': 'Название нового плана',
  'e.g. Typical month': 'напр. Обычный месяц',
  'Create plan': 'Создать план',
  'Plan created': 'План создан',
  'Plan deleted': 'План удалён',
  'this plan': 'этот план',
  'Delete this plan': 'Удалить этот план',
  'Applies to month': 'Применяется к месяцу',
  'Planned income': 'Планируемый доход',
  'No planned income yet.': 'Пока нет запланированного дохода.',
  Source: 'Источник',
  'e.g. Salary': 'напр. Зарплата',
  'Add income': 'Добавить доход',
  'Fixed expenses': 'Фиксированные расходы',
  'Recurring expenses can be edited in the Manage Recurring Expenses menu.':
    'Регулярные расходы можно редактировать в разделе «Управление регулярными расходами».',
  'No recurring expenses due this month.': 'В этом месяце нет предстоящих регулярных расходов.',
  'Other planned expenses': 'Другие планируемые расходы',
  'No other planned expenses yet.': 'Пока нет других планируемых расходов.',
  'Add planned expense': 'Добавить планируемый расход',
  'Save plan': 'Сохранить план',
  'Plan saved': 'План сохранён',
  'Add at least one income source and one expense before saving.':
    'Добавьте хотя бы один источник дохода и один расход перед сохранением.',
  Summary: 'Итого',
  'Add planned income or expenses to see a summary.': 'Добавьте планируемый доход или расходы, чтобы увидеть итоги.',
  Income: 'Доход',
  'Other planned': 'Другое планируемое',
  Remaining: 'Осталось',
  'Per category': 'По категориям',
  'No planned expenses in any category yet.': 'Пока нет планируемых расходов ни в одной категории.',
  Planned: 'Запланировано',
  Actual: 'Фактически',

  // Budget
  'Enable budget tracking': 'Включить отслеживание бюджета',
  'Shows a spending-pace warning under Total spent on the Spending screen':
    'Показывает предупреждение о темпе расходов под «Потрачено всего» на экране расходов',
  'Fill from a saved plan': 'Заполнить из сохранённого плана',
  'This will replace your current (unsaved) budget with this plan. Continue?':
    'Это заменит ваш текущий (несохранённый) бюджет этим планом. Продолжить?',
  Apply: 'Применить',
  'Budget filled from plan': 'Бюджет заполнен из плана',
  'This applies the plan created in Planning sandbox.': 'Это применяет план, созданный в Песочнице планирования.',
  'Copy from previous month': 'Скопировать с предыдущего месяца',
  'Budget copied from previous month': 'Бюджет скопирован с предыдущего месяца',
  'Total budget': 'Общий бюджет',
  'No total budget set yet.': 'Общий бюджет ещё не задан.',
  'Add total budget': 'Добавить общий бюджет',
  'Enter a total budget amount before saving.': 'Введите сумму общего бюджета перед сохранением.',
  Allocated: 'Распределено',
  'Budget expenses': 'Бюджетные расходы',
  'No budget expenses yet.': 'Пока нет бюджетных расходов.',
  'This category already has a budget in this currency.': 'Для этой категории уже есть бюджет в этой валюте.',
  'Add budget expense': 'Добавить бюджетный расход',
  'Save budget': 'Сохранить бюджет',
  'Budget saved': 'Бюджет сохранён',
  'You have unsaved changes. Close without saving?': 'Есть несохранённые изменения. Закрыть без сохранения?',
  'You have unsaved changes. Switch month without saving?': 'Есть несохранённые изменения. Переключить месяц без сохранения?',
  'Budget expenses exceed the total budget. Reduce them or raise the total before saving.':
    'Бюджетные расходы превышают общий бюджет. Уменьшите их или увеличьте общий бюджет перед сохранением.',
  'From plan:': 'Из плана:',
  'Budget status': 'Статус бюджета',
  'No budget set yet. Set one up in Manage budget.': 'Бюджет ещё не задан. Настройте его в разделе «Управление бюджетом».',
  'Categories not in budget': 'Категории вне бюджета',
  'This spending is not budgeted.': 'Эти расходы не включены в бюджет.',
  Budget: 'Бюджет',
  'Remove budget': 'Удалить бюджет',
  Spent: 'Потрачено',
  Left: 'Осталось',
  'Overall left': 'Всего осталось',
  of: 'из',
  'Spending according to budget': 'Расходы в рамках бюджета',
  'Spending close to budget': 'Расходы близки к бюджету',
  'Spending over the budget': 'Расходы превышают бюджет',

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
  'Compare months': 'Сравнение месяцев',
  'Year breakdown': 'Обзор за год',
  'Spending habits': 'Привычки трат',
  'First month': 'Первый месяц',
  'Second month': 'Второй месяц',
  'No spending logged in either month.': 'В обоих месяцах расходов нет.',
  'over budget': 'бюджет превышен',
  'Over budget in:': 'Бюджет превышен в категориях:',
  'Previous year': 'Предыдущий год',
  'Next year': 'Следующий год',
  'No spending logged this year.': 'В этом году расходов пока нет.',
  'Budget adherence': 'Соблюдение бюджета',
  'Where you spend most (last 6 months)': 'Куда уходит больше всего денег (последние 6 месяцев)',
  'Not enough spending history yet.': 'Пока недостаточно истории расходов.',
  Recommendations: 'Рекомендации',
  'No consistent over/under-budget pattern found yet — check back after a few more budgeted months.':
    'Пока не найдено устойчивой картины перерасхода или недорасхода — загляните позже, когда наберётся больше месяцев с бюджетом.',
  'Avg actual': 'Средний факт',
  'Avg budget': 'Средний бюджет',

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
  'Never backed up': 'Резервной копии ещё не было',
  'Last backup': 'Последняя копия:',
  'Failed to import backup': 'Не удалось импортировать резервную копию',
  'Sign in with Google to back up or restore from your own Google Drive — no file to save yourself.':
    'Войдите через Google, чтобы создавать резервные копии в своём Google Drive или восстанавливать их оттуда — без сохранения файла вручную.',
  'Google Drive backup is not set up for this deployment.': 'Резервное копирование в Google Drive не настроено для этой версии приложения.',
  "If sign-in doesn't work, ask the app's owner to add your Google account as a test user.":
    'Если вход не работает, попросите владельца приложения добавить ваш аккаунт Google в список тестовых пользователей.',
  'Backup to Google Drive': 'Резервная копия в Google Drive',
  'Restore from Google Drive': 'Восстановить из Google Drive',
  'Backed up to Google Drive': 'Резервная копия сохранена в Google Drive',
  'Failed to back up to Google Drive': 'Не удалось создать резервную копию в Google Drive',
  'Restoring will replace ALL current data (savings, crypto, spending, categories) with your Google Drive backup. Continue?':
    'Восстановление заменит ВСЕ текущие данные (сбережения, крипто, расходы, категории) резервной копией из Google Drive. Продолжить?',
  "You have local changes that haven't been backed up to Google Drive yet — restoring now will replace them with your Google Drive backup and they'll be permanently lost. Continue?":
    'У вас есть локальные изменения, которые ещё не сохранены в Google Drive — восстановление сейчас заменит их резервной копией из Google Drive, и они будут потеряны навсегда. Продолжить?',
  'Failed to restore from Google Drive': 'Не удалось восстановить из Google Drive',
  'Reconnect to Google Drive to keep backing up automatically?': 'Переподключиться к Google Drive для синхронизации?',
  Connect: 'Подключить',
  'Auto-backup to Google Drive': 'Авто-бэкап в Google Drive',
  'Silently back up to Google Drive a few seconds after each change, using your last sign-in. Only works while the app is open.':
    'Автоматически сохранять резервную копию в Google Drive через несколько секунд после каждого изменения, используя последний вход. Работает только пока приложение открыто.',
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

// Prepositional case ("in N categories"): singular for counts ending in 1
// (except 11), plural prepositional otherwise — e.g. "в 21 категории" but
// "в 2/5/11 категориях".
function ruCategoryWordPrepositional(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  return mod10 === 1 && mod100 !== 11 ? 'категории' : 'категориях'
}

export function tLimitsExceededInCategories(lang: Language, n: number): string {
  if (lang === 'ru') return `Лимиты превышены в ${n} ${ruCategoryWordPrepositional(n)}`
  return `Limits exceeded in ${n} categor${n === 1 ? 'y' : 'ies'}`
}

export function tSpentConvertedFrom(lang: Language, amountText: string): string {
  return lang === 'ru' ? `Потрачено (конвертировано) из ${amountText}` : `Spent converted from ${amountText}`
}

export function tHabitOver(lang: Language, category: string, monthsOver: number, monthsBudgeted: number): string {
  return lang === 'ru'
    ? `Вы превышали бюджет в категории «${category}» в ${monthsOver} из последних ${monthsBudgeted} месяцев — возможно, стоит его увеличить.`
    : `You've gone over budget in ${category} for ${monthsOver} of the last ${monthsBudgeted} months — consider raising it.`
}

export function tHabitUnder(lang: Language, category: string, monthsUnder: number, monthsBudgeted: number): string {
  return lang === 'ru'
    ? `Вы стабильно тратите меньше бюджета в категории «${category}» (${monthsUnder} из последних ${monthsBudgeted} месяцев) — возможно, стоит его уменьшить.`
    : `You've consistently spent under budget in ${category} for ${monthsUnder} of the last ${monthsBudgeted} months — consider lowering it.`
}

export function tTotalInYear(lang: Language, year: number): string {
  return lang === 'ru' ? `Всего за ${year} год` : `Total in ${year}`
}

export function tTotalLastMonths(lang: Language, months: number): string {
  return lang === 'ru' ? `Всего за последние ${months} мес.` : `Total in the last ${months} months`
}

export function tDataAsOf(lang: Language, dateLabel: string): string {
  return lang === 'ru'
    ? `Текущий месяц ещё не закончился — данные по состоянию на ${dateLabel}`
    : `The current month isn't over yet — data as of ${dateLabel}`
}

export function tTotalInMonth(lang: Language, monthLabel: string): string {
  return lang === 'ru' ? `Всего за ${monthLabel}` : `Total in ${monthLabel}`
}

export function tAvgPerMonth(lang: Language, amountText: string): string {
  return lang === 'ru' ? `В среднем ${amountText}/мес.` : `Avg ${amountText}/mo`
}

export function tCopyBudgetConfirm(lang: Language, monthLabel: string): string {
  return lang === 'ru'
    ? `Это заменит ваш текущий (несохранённый) бюджет бюджетом за ${monthLabel}. Продолжить?`
    : `This will replace your current (unsaved) budget with ${monthLabel}'s. Continue?`
}

export function tOverspentButOverallFine(lang: Language, currency: string): string {
  return lang === 'ru'
    ? `Превышен бюджет в ${currency}, но в целом бюджет соблюдается`
    : `You overspent in ${currency}, but you're on track with the overall budget`
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

export function tBudgetExceeded(lang: Language, remainingLabel: string): string {
  return lang === 'ru'
    ? `Это превышает общий бюджет. Осталось распределить: ${remainingLabel}.`
    : `This exceeds your total budget. You have ${remainingLabel} left to allocate.`
}

export function tDriveBackupConflict(lang: Language, remoteModifiedAt: string): string {
  if (lang === 'ru') {
    return `В Google Drive уже есть резервная копия от ${remoteModifiedAt}, возможно, с другого устройства, которую это устройство ещё не видело. Резервное копирование сейчас перезапишет её. Продолжить?`
  }
  return `Google Drive already has a backup from ${remoteModifiedAt} — possibly from another device — that this device hasn't seen. Backing up now will overwrite it. Continue?`
}

export function tAutoBackupConflict(lang: Language, remoteModifiedAt: string): string {
  if (lang === 'ru') {
    return (
      `Авто-бэкап пропущен — на Google Drive есть данные от ${remoteModifiedAt}, которые это устройство ещё не видело, ` +
      `вероятно, с другого устройства. Откройте Настройки и нажмите «Restore from Google Drive», чтобы сначала получить их. ` +
      `Важно: Restore также полностью перезапишет локальную базу этого устройства, включая ту самую правку, которую вы ` +
      `только что внесли — её нужно будет запомнить и внести заново после restore.`
    )
  }
  return (
    `Auto-backup skipped — Google Drive has data from ${remoteModifiedAt} this device hasn't seen yet, probably from ` +
    `another device. Open Settings and tap "Restore from Google Drive" to pull it in first. Note: Restore will also ` +
    `fully overwrite this device's local database, including the very change you just made — you'll need to remember it ` +
    `and re-enter it after restoring.`
  )
}

export function tStartupDriveOffer(lang: Language, remoteModifiedAt: string, hasLocalChanges: boolean): string {
  if (lang === 'ru') {
    if (hasLocalChanges) {
      return (
        `На Google Drive есть более новая резервная копия от ${remoteModifiedAt}. На этом устройстве уже есть изменения ` +
        `с последней синхронизации с Drive — импорт сейчас их перезапишет, и их нужно будет внести заново. Всё равно импортировать?`
      )
    }
    return `На Google Drive есть более новая резервная копия от ${remoteModifiedAt}, которой ещё нет на этом устройстве. Импортировать её сейчас, прежде чем вы начнёте что-то менять здесь?`
  }
  if (hasLocalChanges) {
    return (
      `Google Drive has a newer backup from ${remoteModifiedAt}. This device already has changes since its last Drive ` +
      `sync — importing now will overwrite them and you'll need to redo them afterward. Import anyway?`
    )
  }
  return `Google Drive has a newer backup from ${remoteModifiedAt} that isn't on this device yet. Import it now, before you make any changes here?`
}
