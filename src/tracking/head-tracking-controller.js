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
    this.minDistance = 0.1; // минимальное расстояние 10 см
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
    
    // Базовое (начальное) положение головы для расчёта дельт
    this.baseTranslationX = null;
    this.baseTranslationY = null;
    this.baseTranslationZ = null;
    this.baseInitialized = false;
    
    // Базовое положение стабильной точки (центр между глазами)
    this.baseStablePointX = null;
    this.baseStablePointY = null;
    this.baseStablePointZ = null;

    // Фактор сглаживания для уменьшения jitter (только для Z, для X/Y не используем)
    this.smoothingFactor = 0.7;
    
    // Чувствительность для X/Y/Z (настраивается через UI)
    this.sensitivityX = 3440.0;
    this.sensitivityY = 1780.0;
    this.sensitivityZ = 0.005; // Дефолт 0.005 (отображается как 5, потому что х1000 для отображения)
    
    // Порог минимального изменения для предотвращения дрифта
    // Если изменение меньше порога, не обновляем offset
    this.minChangeThreshold = 0.001; // Увеличен порог для предотвращения дрифта
    
    // Текущее абсолютное положение viewport (для прямого маппирования)
    this.currentViewportX = 0;
    this.currentViewportY = 0;
  }
  
  /**
   * Устанавливает чувствительность для осей X/Y/Z
   * @param {number} sensitivityX - Чувствительность по X
   * @param {number} sensitivityY - Чувствительность по Y
   * @param {number} sensitivityZ - Чувствительность по Z (для масштаба)
   */
  setSensitivity(sensitivityX, sensitivityY, sensitivityZ) {
    this.sensitivityX = sensitivityX;
    this.sensitivityY = sensitivityY;
    this.sensitivityZ = sensitivityZ;
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

    const { translation, stablePoint } = mediaPipeResult;

    // Используем стабильную точку (центр между глазами) для отслеживания X/Y
    // Это предотвращает движение экрана при поворотах головы
    let deltaX = 0;
    let deltaY = 0;
    
    if (stablePoint) {
      // Инициализируем базовое положение стабильной точки
      if (this.baseStablePointX === null) {
        this.baseStablePointX = stablePoint.x;
        this.baseStablePointY = stablePoint.y;
        this.baseStablePointZ = stablePoint.z;
        console.info('Base stable point initialized:', {
          baseX: this.baseStablePointX.toFixed(4),
          baseY: this.baseStablePointY.toFixed(4),
          baseZ: this.baseStablePointZ.toFixed(4)
        });
      }
      
      // Рассчитываем дельты стабильной точки (не зависит от поворотов)
      deltaX = stablePoint.x - this.baseStablePointX;
      deltaY = stablePoint.y - this.baseStablePointY;
    } else {
      // Fallback: используем translation, если стабильная точка недоступна
      if (!this.baseInitialized) {
        this.baseTranslationX = translation.x;
        this.baseTranslationY = translation.y;
        this.baseTranslationZ = translation.z;
        this.baseInitialized = true;
        console.info('Base head position initialized (fallback):', {
          baseX: this.baseTranslationX.toFixed(4),
          baseY: this.baseTranslationY.toFixed(4),
          baseZ: this.baseTranslationZ.toFixed(4)
        });
      }
      
      deltaX = translation.x - this.baseTranslationX;
      deltaY = translation.y - this.baseTranslationY;
    }

    // Для Z (масштаб) используем translation, так как расстояние не зависит от поворотов
    if (!this.baseInitialized) {
      this.baseTranslationZ = translation.z;
      this.baseInitialized = true;
    }
    const deltaZ = translation.z - this.baseTranslationZ;

    // Логирование входных данных (каждые 30 кадров для мониторинга)
    if (!this._frameCount) this._frameCount = 0;
    this._frameCount++;
    if (this._frameCount % 30 === 0) {
      console.info(`[Frame ${this._frameCount}] HeadTrackingController input:`, {
        rawX: translation.x.toFixed(4),
        rawY: translation.y.toFixed(4),
        rawZ: translation.z.toFixed(4),
        deltaX: deltaX.toFixed(4),
        deltaY: deltaY.toFixed(4),
        deltaZ: deltaZ.toFixed(4),
        baseZ: this.baseTranslationZ.toFixed(4)
      });
    }

    // ВАЖНО: ЖЕСТКИЙ МАППИНГ - используем абсолютное положение вместо дельт
    // Это предотвращает дрифт при неподвижной голове
    // Вычисляем абсолютное положение viewport на основе текущего положения стабильной точки
    let absoluteOffsetX = 0;
    let absoluteOffsetY = 0;
    
    if (stablePoint && this.baseStablePointX !== null) {
      // Вычисляем абсолютное смещение от базовой точки
      const absoluteDeltaX = stablePoint.x - this.baseStablePointX;
      const absoluteDeltaY = stablePoint.y - this.baseStablePointY;
      
      // Применяем порог только для фильтрации шума, но не обнуляем значение
      const absDeltaX = Math.abs(absoluteDeltaX);
      const absDeltaY = Math.abs(absoluteDeltaY);
      
      // Жесткое маппирование: если изменение больше порога, применяем чувствительность
      // Если меньше порога - используем 0 (голова неподвижна)
      if (absDeltaX > this.minChangeThreshold) {
        absoluteOffsetX = absoluteDeltaX * this.sensitivityX;
      }
      
      if (absDeltaY > this.minChangeThreshold) {
        absoluteOffsetY = absoluteDeltaY * this.sensitivityY;
      }
    }
    
    // Используем абсолютные значения (не дельты от предыдущего кадра)
    const offsetX = absoluteOffsetX;
    const offsetY = absoluteOffsetY;
    
    // Для Z применяем сглаживание (для масштаба это допустимо)
    // ВАЖНО: для Z используем очень маленький порог (0.0001), чтобы работали значения 0.01-0.03
    const absDeltaZ = Math.abs(deltaZ);
    const minZThreshold = 0.0001; // Очень маленький порог для Z, чтобы не обнулять малые значения
    let smoothDeltaZ = 0;
    if (absDeltaZ > minZThreshold) {
      smoothDeltaZ = smoothValue(deltaZ, this.previousTranslationZ, this.smoothingFactor);
      this.previousTranslationZ = smoothDeltaZ;
    } else {
      // Если изменение очень мало, сбрасываем накопленное значение (предотвращаем дрифт)
      this.previousTranslationZ = 0;
      smoothDeltaZ = 0;
    }

    // Преобразуем Z-translation в расстояние до монитора (РМ)
    // Используем абсолютное значение Z (не дельту) для расчёта расстояния
    // Базовое расстояние рассчитываем от базового Z
    const baseDistance = zTranslationToDistance(
      this.baseTranslationZ,
      this.minDistance,
      this.maxDistance
    );
    
    // Изменение расстояния на основе изменения Z
    // Чем больше deltaZ (приближение), тем меньше расстояние
    // ВАЖНО: для малых значений чувствительности (0.01-0.03) используем увеличенный множитель
    // чтобы компенсировать малые значения и обеспечить работу масштаба
    const effectiveSensitivityZ = this.sensitivityZ * 2.5; // Увеличиваем эффективность для малых значений
    // Применяем изменение расстояния (не обнуляем даже при малых значениях, если smoothDeltaZ != 0)
    const distanceChange = -smoothDeltaZ * effectiveSensitivityZ; // Масштабируем изменение
    const distance = Math.max(this.minDistance, Math.min(this.maxDistance, baseDistance + distanceChange));

    // Рассчитываем угловой размер экрана (УРЭ)
    const angularSize = calculateAngularSize(this.screenWidth, distance);

    // Преобразуем угловой размер в процент отображения ФИ
    const displayPercent = angularSizeToDisplayPercent(angularSize);

    // Сохраняем текущие значения для отладки
    this.currentDistance = distance;
    this.currentAngularSize = angularSize;
    this.currentDisplayPercent = displayPercent;

    // offsetX и offsetY уже вычислены выше (прямое маппирование без накопления)

    // Логирование результатов (каждые 30 кадров для мониторинга)
    if (this._frameCount % 30 === 0) {
      // Отдельное логирование для Пана и Зума
      console.info(`[Frame ${this._frameCount}] PAN (X/Y):`, {
        deltaX: deltaX.toFixed(4),
        deltaY: deltaY.toFixed(4),
        offsetX: offsetX.toFixed(2),
        offsetY: offsetY.toFixed(2),
        sensitivityX: this.sensitivityX,
        sensitivityY: this.sensitivityY
      });
      
      console.info(`[Frame ${this._frameCount}] ZOOM (Z):`, {
        smoothDeltaZ: smoothDeltaZ.toFixed(4),
        baseDistance: baseDistance.toFixed(3),
        distance: distance.toFixed(3),
        distanceChange: distanceChange.toFixed(4),
        effectiveSensitivityZ: (this.sensitivityZ * 2.5).toFixed(4),
        angularSize: angularSize.toFixed(2),
        displayPercent: displayPercent.toFixed(2),
        sensitivityZ: this.sensitivityZ
      });
    }

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
  
  /**
   * Сбрасывает базовое положение (для кнопки "Возврат на центр")
   */
  resetBasePosition() {
    // Сбрасываем базу X/Y, но НЕ сбрасываем Z, чтобы сохранить текущий РМ
    this.baseInitialized = true; // оставляем инициализацию активной для Z
    this.baseTranslationX = null;
    this.baseTranslationY = null;
    // this.baseTranslationZ сохраняем, чтобы не сбрасывать РМ
    this.baseStablePointX = null;
    this.baseStablePointY = null;
    this.baseStablePointZ = null;
    this.previousTranslationX = 0;
    this.previousTranslationY = 0;
    // previousTranslationZ оставляем как есть
    console.info('Base position reset (X/Y only) - Z preserved to keep current distance');
  }
}
