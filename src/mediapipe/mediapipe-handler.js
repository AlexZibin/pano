/**
 * MediaPipe Handler
 * Интеграция с MediaPipe Face Landmarker для отслеживания положения головы
 * 
 * MediaPipe - это фреймворк от Google для машинного обучения на мобильных и веб-платформах.
 * Face Landmarker позволяет отслеживать ключевые точки на лице и положение головы в 3D пространстве.
 */

import { FaceLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';

/**
 * Класс для работы с MediaPipe Face Landmarker
 * 
 * Как это работает:
 * 1. Загружаем модель Face Landmarker (весёлые предобученные веса модели)
 * 2. Инициализируем детектор лица с этой моделью
 * 3. Для каждого кадра видео вызываем detectForVideo() и получаем результаты
 * 4. Из результатов извлекаем head pose (translation X/Y/Z) - это положение головы относительно камеры
 */
export class MediaPipeHandler {
  /**
   * Создаёт экземпляр MediaPipeHandler
   */
  constructor() {
    this.faceLandmarker = null;
    this.drawingUtils = null;
    this.isInitialized = false;
    this.lastDetectionTime = 0;
  }

  /**
   * Инициализирует MediaPipe Face Landmarker
   * 
   * Что происходит:
   * 1. Загружаем файлы модели из CDN Google (FilesetResolver)
   * 2. Создаём FaceLandmarker с опциями:
   *    - baseOptions: путь к модели и режим работы (CPU или GPU)
   *    - outputFaceBlendshapes: получать ли детали лица (для анимации)
   *    - runningMode: VIDEO - режим для обработки видеопотока
   *    - numFaces: сколько лиц отслеживать одновременно (1 достаточно)
   * 
   * @returns {Promise<void>}
   * @throws {Error} Если не удалось загрузить модель
   */
  async initialize() {
    try {
      console.info('Initializing MediaPipe Face Landmarker...');

      // Шаг 1: Загружаем файлы MediaPipe из CDN
      // FilesetResolver автоматически загрузит необходимые файлы (WASM, модели и т.д.)
      // из публичного CDN Google
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      console.info('MediaPipe files loaded, creating FaceLandmarker...');

      // Шаг 2: Создаём FaceLandmarker с опциями
      // Важно: используем runningMode: 'VIDEO' для обработки видеопотока
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
          delegate: 'GPU' // Используем GPU для лучшей производительности, если доступно
        },
        outputFaceBlendshapes: false, // Не нужны детали лица, только положение головы
        runningMode: 'VIDEO', // Режим для видео (не статичных изображений)
        numFaces: 1 // Отслеживаем только одно лицо
      });

      // Шаг 3: Создаём утилиты для отрисовки (если понадобится для отладки)
      this.drawingUtils = new DrawingUtils();

      this.isInitialized = true;
      console.info('MediaPipe Face Landmarker initialized successfully');
    } catch (error) {
      console.error('MediaPipe initialization error:', error);
      this.isInitialized = false;
      throw new Error(`Ошибка инициализации MediaPipe: ${error.message}`);
    }
  }

  /**
   * Обрабатывает один кадр видео и возвращает результаты детекции
   * 
   * Как это работает:
   * 1. Получаем текущий кадр из video элемента
   * 2. Вызываем detectForVideo() - это основной метод MediaPipe для обработки видео
   * 3. Получаем результаты детекции с информацией о положении головы
   * 4. Извлекаем translation X/Y/Z - это координаты головы относительно камеры
   * 
   * Важно: detectForVideo() требует timestamp кадра для правильной работы
   * 
   * @param {HTMLVideoElement} videoElement - Элемент video с текущим кадром
   * @returns {Object|null} Результаты детекции с translation X/Y/Z или null, если лицо не обнаружено
   */
  processFrame(videoElement) {
    if (!this.isInitialized || !this.faceLandmarker) {
      console.warn('MediaPipe not initialized');
      return null;
    }

    if (!videoElement || videoElement.readyState !== videoElement.HAVE_ENOUGH_DATA) {
      // Видео ещё не готово к обработке
      return null;
    }

    try {
      // Получаем timestamp текущего кадра
      // Для видео используем performance.now() для точного времени
      const nowInMs = performance.now();

      // Вызываем detectForVideo() - основной метод MediaPipe для обработки видеокадров
      // Он принимает:
      // - videoElement: элемент video с кадром
      // - timestamp: время кадра в миллисекундах
      const results = this.faceLandmarker.detectForVideo(videoElement, nowInMs);

      // Проверяем, найдено ли лицо
      if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
        return null; // Лицо не обнаружено
      }

      // Извлекаем данные первого лица (мы отслеживаем только одно)
      const faceLandmarks = results.faceLandmarks[0];

      // Получаем transformation matrix - матрицу преобразования, содержащую информацию о положении головы
      // Эта матрица включает rotation (поворот) и translation (смещение) головы
      if (!results.facialTransformationMatrixes || results.facialTransformationMatrixes.length === 0) {
        console.warn('No transformation matrix found');
        return null;
      }

      const transformationMatrix = results.facialTransformationMatrixes[0];

      // Извлекаем translation (смещение) из матрицы преобразования
      // Translation - это координаты головы относительно камеры:
      // - X: смещение влево/вправо (отрицательное = влево, положительное = вправо)
      // - Y: смещение вверх/вниз (отрицательное = вверх, положительное = вниз)
      // - Z: расстояние до камеры (отрицательное значение, чем дальше, тем меньше значение)
      const translation = {
        x: transformationMatrix[12], // Элемент матрицы в позиции [3][0]
        y: transformationMatrix[13], // Элемент матрицы в позиции [3][1]
        z: transformationMatrix[14]  // Элемент матрицы в позиции [3][2]
      };

      this.lastDetectionTime = nowInMs;

      return {
        translation,
        faceLandmarks,
        transformationMatrix
      };
    } catch (error) {
      console.error('Error processing frame:', error);
      return null;
    }
  }

  /**
   * Проверяет, инициализирован ли MediaPipe
   * @returns {boolean}
   */
  isReady() {
    return this.isInitialized && this.faceLandmarker !== null;
  }

  /**
   * Освобождает ресурсы MediaPipe
   */
  dispose() {
    if (this.faceLandmarker) {
      // MediaPipe автоматически освобождает ресурсы
      this.faceLandmarker = null;
    }

    this.drawingUtils = null;
    this.isInitialized = false;
    console.info('MediaPipe resources disposed');
  }
}
