/**
 * Утилиты для математических расчётов, связанных с отслеживанием головы
 */

/**
 * Рассчитывает угловой размер экрана по горизонтали
 * Формула: α = 2 × arctan(W / (2 × L))
 * где W — ширина экрана, L — расстояние до наблюдателя (РМ)
 * 
 * @param {number} screenWidth - Ширина экрана в пикселях
 * @param {number} distanceToMonitor - Расстояние от пользователя до монитора (РМ) в метрах
 * @returns {number} Угловой размер экрана в градусах
 */
export function calculateAngularSize(screenWidth, distanceToMonitor) {
  if (distanceToMonitor <= 0) {
    console.warn('calculateAngularSize: distanceToMonitor должно быть больше 0');
    return 180; // Максимальный угол при нулевом расстоянии
  }

  // Преобразуем ширину экрана в метры (предполагаем стандартное разрешение ~96 DPI)
  // Для упрощения используем приближение: 1 пиксель ≈ 0.000264583 метра (96 DPI)
  const SCREEN_DPI = 96;
  const PIXELS_TO_METERS = 0.0254 / SCREEN_DPI; // метры на пиксель
  const widthInMeters = screenWidth * PIXELS_TO_METERS;

  // Рассчитываем угловой размер по формуле
  const angleRadians = 2 * Math.atan(widthInMeters / (2 * distanceToMonitor));
  const angleDegrees = angleRadians * (180 / Math.PI);

  return angleDegrees;
}

/**
 * Преобразует угловой размер экрана в процент отображения ФИ
 * УРЭ растёт от ~28° (РМ = 1 диагональ) до ~180° (РМ → 0)
 * Процент отображения должен расти от ~50% до ~100%
 * 
 * @param {number} angularSize - Угловой размер экрана в градусах
 * @param {number} minAngle - Минимальный угол (при максимальном РМ), по умолчанию 28°
 * @param {number} maxAngle - Максимальный угол (при минимальном РМ), по умолчанию 180°
 * @param {number} minPercent - Минимальный процент отображения, по умолчанию 50%
 * @param {number} maxPercent - Максимальный процент отображения, по умолчанию 100%
 * @returns {number} Процент отображения ФИ (от minPercent до maxPercent)
 */
export function angularSizeToDisplayPercent(
  angularSize,
  minAngle = 28,
  maxAngle = 180,
  minPercent = 50,
  maxPercent = 100
) {
  // Ограничиваем угловой размер в диапазоне
  const clampedAngle = Math.max(minAngle, Math.min(maxAngle, angularSize));

  // Нормализуем значение от 0 до 1
  const normalized = (clampedAngle - minAngle) / (maxAngle - minAngle);

  // Применяем нелинейное преобразование (используем квадратичную функцию для более плавного изменения)
  const nonLinearNormalized = Math.pow(normalized, 0.7);

  // Преобразуем в проценты
  const percent = minPercent + (maxPercent - minPercent) * nonLinearNormalized;

  return percent;
}

/**
 * Преобразует Z-translation от MediaPipe в расстояние до монитора (РМ)
 * MediaPipe возвращает координаты относительно камеры в нормализованном виде
 * Нужно преобразовать в реальное расстояние в метрах
 * 
 * @param {number} zTranslation - Z-translation от MediaPipe (нормализованное значение)
 * @param {number} minDistance - Минимальное расстояние в метрах, по умолчанию 0.3 м (30 см)
 * @param {number} maxDistance - Максимальное расстояние в метрах, по умолчанию 1.5 м
 * @returns {number} Расстояние до монитора (РМ) в метрах
 */
export function zTranslationToDistance(zTranslation, minDistance = 0.3, maxDistance = 1.5) {
  // MediaPipe Z-translation обычно отрицательное (чем дальше, тем меньше значение)
  // Инвертируем и нормализуем в диапазон расстояний
  // Предполагаем, что zTranslation в диапазоне примерно от -0.5 до -2.0
  // (нужно будет калибровать в зависимости от конкретной камеры)

  // Инвертируем значение (делаем положительным)
  const normalizedZ = -zTranslation;

  // Масштабируем в диапазон расстояний (требуется калибровка)
  // Пока используем простое линейное преобразование
  const distance = Math.max(minDistance, Math.min(maxDistance, normalizedZ * 0.5));

  return distance;
}

/**
 * Ограничивает значение в заданном диапазоне
 * 
 * @param {number} value - Значение для ограничения
 * @param {number} min - Минимальное значение
 * @param {number} max - Максимальное значение
 * @returns {number} Ограниченное значение
 */
export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Линейная интерполяция между двумя значениями
 * 
 * @param {number} a - Начальное значение
 * @param {number} b - Конечное значение
 * @param {number} t - Интерполяционный параметр (0-1)
 * @returns {number} Интерполированное значение
 */
export function lerp(a, b, t) {
  return a + (b - a) * clamp(t, 0, 1);
}

/**
 * Сглаживание значения с помощью экспоненциального фильтра
 * 
 * @param {number} current - Текущее значение
 * @param {number} previous - Предыдущее значение
 * @param {number} smoothingFactor - Фактор сглаживания (0-1), чем больше, тем больше сглаживание
 * @returns {number} Сглаженное значение
 */
export function smoothValue(current, previous, smoothingFactor = 0.7) {
  return lerp(previous, current, 1 - smoothingFactor);
}
