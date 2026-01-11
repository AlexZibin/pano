// Версия приложения
// В будущем можно читать из package.json, но пока храним здесь для простоты
const VERSION = '0.1.1';

/**
 * Получает версию приложения
 * @returns {string} Версия приложения (например, "0.1.0")
 */
export function getVersion() {
  return VERSION;
}

/**
 * Генерирует строку с версией и временем билда
 * @returns {string} Строка формата "v0.1.0 - yyyy-mm-dd hh.mm.ss"
 */
export function getVersionString() {
  const version = getVersion();
  // ВАЖНО: отображаем время сборки в часовом поясе +3 (Europe/Moscow)
  let buildTime = '';
  try {
    const now = new Date();
    // sv-SE даёт формат YYYY-MM-DD HH:mm:ss
    buildTime = now
      .toLocaleString('sv-SE', { timeZone: 'Europe/Moscow', hour12: false })
      .replace(',', '');
  } catch (e) {
    const now = new Date(Date.now() + 3 * 60 * 60 * 1000);
    buildTime = now.toISOString()
      .replace('T', ' ')
      .replace(/\.\d{3}Z$/, '');
  }

  return `v${version} - ${buildTime}`;
}

/**
 * Обновляет версию в DOM элементе
 * @param {HTMLElement} element - Элемент для обновления
 */
export function updateVersionDisplay(element) {
  if (element) {
    element.textContent = getVersionString();
  }
}
