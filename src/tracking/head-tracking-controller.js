/**
 * Head Tracking Controller
 * Преобразует данные от MediaPipe в параметры для viewport (масштаб и позиция)
 */

import {
  calculateAngularSize,
  angularSizeToDisplayPercent,
  zTranslationToDistance,
  smoothValue
} from '../utils/math-utils.js';

/**
 * Класс для преобразования head pose в параметры отображения
 */
export class HeadTrackingController {
  /**
   * Создаёт экземпляр HeadTrackingController
   * @param {number} screenWidth - Ширина экрана в пикселях
   * @param {number} screenHeight - Высота экрана в пикселях
   */
  constructor(screenWidth, screenHeight) {
    this.screenWidth = screenWidth;
    this.screenHeight = screenHeight;

    // Параметры калибровки РМ (расстояния до монитора)
    this.minDistance = 0.3; // 30 см
    this.maxDistance = 1.5; // 1.5 метра

    // Базовая калибровка Z-translation (нужно будет настраивать под конкретную камеру)
    this.zTranslationScale = 0.5;
    this.zTranslationOffset = 0.0;

    // Текущие значения (для сглаживания)
    this.currentDistance = null;
    this.currentAngularSize = null;
    this.currentDisplayPercent = 50;

    // Предыдущие значения translation для сглаживания
    this.previousTranslationX = 0;
    this.previousTranslationY = 0;
    this.previousTranslationZ = 0;

    // Фактор сглаживания для уменьшения jitter
    this.smoothingFactor = 0.7;
  }

  /**
   * Обрабатывает данные от MediaPipe и возвращает параметры для viewport
   * @param {Object} mediaPipeResult - Результаты от MediaPipe (с translation X/Y/Z)
   * @returns {{displayPercent: number, offsetX: number, offsetY: number}|null}
   */
  processHeadPose(mediaPipeResult) {
    if (!mediaPipeResult || !mediaPipeResult.translation) {
      return null;
    }

    const { translation } = mediaPipeResult;

    // Применяем сглаживание к translation для уменьшения дрожания
    const smoothX = smoothValue(translation.x, this.previousTranslationX, this.smoothingFactor);
    const smoothY = smoothValue(translation.y, this.previousTranslationY, this.smoothingFactor);
    const smoothZ = smoothValue(translation.z, this.previousTranslationZ, this.smoothingFactor);

    this.previousTranslationX = smoothX;
    this.previousTranslationY = smoothY;
    this.previousTranslationZ = smoothZ;

    // Преобразуем Z-translation в расстояние до монитора (РМ)
    const distance = zTranslationToDistance(
      smoothZ,
      this.minDistance,
      this.maxDistance
    );

    // Рассчитываем угловой размер экрана (УРЭ)
    const angularSize = calculateAngularSize(this.screenWidth, distance);

    // Преобразуем угловой размер в процент отображения ФИ
    const displayPercent = angularSizeToDisplayPercent(angularSize);

    // Сохраняем текущие значения для отладки
    this.currentDistance = distance;
    this.currentAngularSize = angularSize;
    this.currentDisplayPercent = displayPercent;

    // Рассчитываем смещение viewport на основе смещения головы по X/Y
    // Чувствительность можно будет настроить
    const sensitivity = 0.5;
    const offsetX = smoothX * sensitivity;
    const offsetY = smoothY * sensitivity;

    return {
      displayPercent,
      offsetX,
      offsetY,
      distance,
      angularSize
    };
  }

  /**
   * Получает текущее расстояние до монитора
   * @returns {number|null}
   */
  getCurrentDistance() {
    return this.currentDistance;
  }

  /**
   * Получает текущий угловой размер
   * @returns {number|null}
   */
  getCurrentAngularSize() {
    return this.currentAngularSize;
  }

  /**
   * Получает текущий процент отображения
   * @returns {number}
   */
  getCurrentDisplayPercent() {
    return this.currentDisplayPercent;
  }

  /**
   * Устанавливает параметры калибровки Z-translation
   * @param {number} scale - Масштаб преобразования
   * @param {number} offset - Смещение
   */
  setZTranslationCalibration(scale, offset) {
    this.zTranslationScale = scale;
    this.zTranslationOffset = offset;
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
