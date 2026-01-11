// Версия приложения
// В будущем можно читать из package.json, но пока храним здесь для простоты
const VERSION = '0.1.0';

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
  const now = new Date();
  const buildTime = now.toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, '')
    .replace(/-/g, '-')
    .replace(/:/g, ':');

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
