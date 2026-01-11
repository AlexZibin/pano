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
    
    // Минимальный процент отображения (для зума)
    this.minDisplayPercent = 30; // Уменьшено с 50 до 30

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
    // Ограничиваем процент в диапазоне minDisplayPercent-100%
    this.currentDisplayPercent = Math.max(this.minDisplayPercent, Math.min(100, displayPercent));

    // Рассчитываем масштаб: чем больше процент, тем меньше масштаб
    this.scale = 100 / this.currentDisplayPercent;
  }

  /**
   * Обновляет смещение viewport на основе движения головы
   * ВАЖНО: ЖЕСТКИЙ МАППИНГ - использует абсолютное положение вместо накопления дельт
   * @param {number} absoluteOffsetX - Абсолютное смещение по X (уже в пикселях, с учётом чувствительности)
   * @param {number} absoluteOffsetY - Абсолютное смещение по Y (уже в пикселях, с учётом чувствительности)
   * @param {number} sensitivity - Чувствительность движения (обычно 1.0, т.к. уже применена)
   */
  updateOffset(absoluteOffsetX, absoluteOffsetY, sensitivity = 1.0) {
    // Логирование входных данных (каждые 30 кадров)
    if (!this._frameCount) this._frameCount = 0;
    this._frameCount++;
    if (this._frameCount % 30 === 0) {
      console.info(`[Frame ${this._frameCount}] ViewportManager.updateOffset input:`, {
        absoluteOffsetX: absoluteOffsetX.toFixed(4),
        absoluteOffsetY: absoluteOffsetY.toFixed(4),
        sensitivity,
        currentOffsetX: this.offsetX.toFixed(2),
        currentOffsetY: this.offsetY.toFixed(2),
        currentScale: this.scale.toFixed(2),
        currentDisplayPercent: this.currentDisplayPercent.toFixed(2)
      });
    }

    // Рассчитываем максимальное смещение на основе текущего масштаба
    const maxOffsetX = (this.imageWidth * (this.scale - 1)) / (2 * this.scale);
    const maxOffsetY = (this.imageHeight * (this.scale - 1)) / (2 * this.scale);

    // ВАЖНО: ЖЕСТКИЙ МАППИНГ - используем абсолютное положение напрямую
    // Если absoluteOffsetX/Y = 0 (голова в базовом положении), offset = 0
    // НЕ накапливаем, НЕ добавляем к текущему offset - используем абсолютное значение
    // Это предотвращает дрифт при неподвижной голове
    // Порог для фильтрации шума (очень маленький, чтобы не блокировать реальные движения)
    const minAbsoluteThreshold = 0.1; // Минимальное абсолютное значение для обновления
    
    let newOffsetX = 0;
    let newOffsetY = 0;
    
    // Применяем абсолютное смещение только если оно больше порога
    if (Math.abs(absoluteOffsetX) > minAbsoluteThreshold) {
      newOffsetX = absoluteOffsetX * sensitivity;
    }
    
    if (Math.abs(absoluteOffsetY) > minAbsoluteThreshold) {
      newOffsetY = -absoluteOffsetY * sensitivity; // Инвертируем Y
    }

    // Ограничиваем смещение границами изображения
    // При приближении к границам применяем плавное торможение
    const clampedOffsetX = this.clampWithSmoothing(newOffsetX, -maxOffsetX, maxOffsetX);
    const clampedOffsetY = this.clampWithSmoothing(newOffsetY, -maxOffsetY, maxOffsetY);

    // Логирование результатов (каждые 30 кадров)
    if (this._frameCount % 30 === 0) {
      console.info(`[Frame ${this._frameCount}] ViewportManager.updateOffset output:`, {
        newOffsetX: newOffsetX.toFixed(2),
        newOffsetY: newOffsetY.toFixed(2),
        clampedOffsetX: clampedOffsetX.toFixed(2),
        clampedOffsetY: clampedOffsetY.toFixed(2),
        maxOffsetX: maxOffsetX.toFixed(2),
        maxOffsetY: maxOffsetY.toFixed(2),
        imageWidth: this.imageWidth,
        imageHeight: this.imageHeight
      });
    }

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
