/**
 * Viewport Manager
 * Управляет viewport (какая часть ФИ показывается) - масштаб и позиция
 */

/**
 * Класс для управления viewport фонового изображения
 */
export class ViewportManager {
  /**
   * Создаёт экземпляр ViewportManager
   * @param {number} imageWidth - Ширина фонового изображения в пикселях
   * @param {number} imageHeight - Высота фонового изображения в пикселях
   * @param {number} screenWidth - Ширина экрана в пикселях
   * @param {number} screenHeight - Высота экрана в пикселях
   */
  constructor(imageWidth, imageHeight, screenWidth, screenHeight) {
    this.imageWidth = imageWidth;
    this.imageHeight = imageHeight;
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;

    // Начальное состояние: показываем ~50% изображения (центральная часть)
    this.initialDisplayPercent = 50;
    this.currentDisplayPercent = this.initialDisplayPercent;

    // Масштаб: 1.0 = показываем 100% изображения, 2.0 = 50%
    // Для 50% отображения: scale = 100 / 50 = 2.0
    this.scale = 100 / this.initialDisplayPercent;

    // Смещение viewport по X и Y (в пикселях изображения)
    this.offsetX = 0;
    this.offsetY = 0;

    // Параметры для плавного торможения у границ
    this.boundarySmoothing = 0.3; // Фактор сглаживания (0-1)
  }

  /**
   * Обновляет процент отображения ФИ на основе расстояния до монитора
   * @param {number} displayPercent - Процент отображения (от 50 до 100)
   */
  updateDisplayPercent(displayPercent) {
    // Ограничиваем процент в диапазоне 50-100%
    this.currentDisplayPercent = Math.max(50, Math.min(100, displayPercent));

    // Рассчитываем масштаб: чем больше процент, тем меньше масштаб
    this.scale = 100 / this.currentDisplayPercent;
  }

  /**
   * Обновляет смещение viewport на основе движения головы
   * @param {number} deltaX - Смещение головы по X (нормализованное значение от MediaPipe)
   * @param {number} deltaY - Смещение головы по Y (нормализованное значение от MediaPipe)
   * @param {number} sensitivity - Чувствительность движения (множитель)
   */
  updateOffset(deltaX, deltaY, sensitivity = 1.0) {
    // Рассчитываем максимальное смещение на основе текущего масштаба
    // При масштабе 2.0 (50% отображения) можем смещаться на половину размера изображения
    const maxOffsetX = (this.imageWidth * (this.scale - 1)) / (2 * this.scale);
    const maxOffsetY = (this.imageHeight * (this.scale - 1)) / (2 * this.scale);

    // Применяем чувствительность и обновляем смещение
    const newOffsetX = this.offsetX + (deltaX * sensitivity * 100);
    const newOffsetY = this.offsetY - (deltaY * sensitivity * 100); // Инвертируем Y

    // Ограничиваем смещение границами изображения
    // При приближении к границам применяем плавное торможение
    const clampedOffsetX = this.clampWithSmoothing(newOffsetX, -maxOffsetX, maxOffsetX);
    const clampedOffsetY = this.clampWithSmoothing(newOffsetY, -maxOffsetY, maxOffsetY);

    this.offsetX = clampedOffsetX;
    this.offsetY = clampedOffsetY;
  }

  /**
   * Ограничивает значение в диапазоне с плавным торможением у границ
   * @param {number} value - Значение для ограничения
   * @param {number} min - Минимальное значение
   * @param {number} max - Максимальное значение
   * @returns {number} Ограниченное значение
   */
  clampWithSmoothing(value, min, max) {
    if (value < min) {
      // Приближаемся к нижней границе - применяем плавное торможение
      const distance = value - min;
      return min + distance * this.boundarySmoothing;
    }

    if (value > max) {
      // Приближаемся к верхней границе - применяем плавное торможение
      const distance = value - max;
      return max + distance * this.boundarySmoothing;
    }

    return value;
  }

  /**
   * Сбрасывает viewport в начальное состояние
   */
  reset() {
    this.currentDisplayPercent = this.initialDisplayPercent;
    this.scale = 100 / this.initialDisplayPercent;
    this.offsetX = 0;
    this.offsetY = 0;
  }

  /**
   * Получает текущий масштаб
   * @returns {number}
   */
  getScale() {
    return this.scale;
  }

  /**
   * Получает текущее смещение по X
   * @returns {number}
   */
  getOffsetX() {
    return this.offsetX;
  }

  /**
   * Получает текущее смещение по Y
   * @returns {number}
   */
  getOffsetY() {
    return this.offsetY;
  }

  /**
   * Получает текущий процент отображения
   * @returns {number}
   */
  getDisplayPercent() {
    return this.currentDisplayPercent;
  }

  /**
   * Обновляет размеры экрана (например, при изменении размера окна)
   * @param {number} screenWidth - Новая ширина экрана
   * @param {number} screenHeight - Новая высота экрана
   */
  updateScreenSize(screenWidth, screenHeight) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;
  }
}
