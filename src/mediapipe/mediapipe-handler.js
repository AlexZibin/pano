/**
 * MediaPipe Handler
 * Интеграция с MediaPipe Face Landmarker для отслеживания положения головы
 * 
 * MediaPipe - это фреймворк от Google для машинного обучения на мобильных и веб-платформах.
 * Face Landmarker позволяет отслеживать ключевые точки на лице и положение головы в 3D пространстве.
 * 
 * MediaPipe загружается динамически из CDN через import()
 */

// URL для загрузки MediaPipe из CDN
const MEDIAPIPE_CDN_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9';

// Кэш загруженного модуля
let mediaPipeModule = null;

/**
 * Загружает MediaPipe модуль из CDN
 * @returns {Promise<Object>} Модуль MediaPipe с FaceLandmarker, FilesetResolver, DrawingUtils
 */
async function loadMediaPipe() {
  if (!mediaPipeModule) {
    console.info('Loading MediaPipe from CDN...');
    try {
      // Импортируем модуль напрямую из CDN
      mediaPipeModule = await import(MEDIAPIPE_CDN_URL);
      console.info('MediaPipe loaded successfully');
    } catch (error) {
      console.error('Failed to load MediaPipe from CDN:', error);
      // Пробуем альтернативный CDN (unpkg)
      console.info('Trying alternative CDN (unpkg)...');
      try {
        mediaPipeModule = await import('https://unpkg.com/@mediapipe/tasks-vision@0.10.9');
        console.info('MediaPipe loaded from unpkg successfully');
      } catch (unpkgError) {
        console.error('Failed to load from unpkg:', unpkgError);
        throw new Error(`Не удалось загрузить MediaPipe: ${error.message}`);
      }
    }
  }
  return mediaPipeModule;
}

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

      // Шаг 0: Загружаем MediaPipe модуль из CDN
      const mediaPipe = await loadMediaPipe();
      const { FaceLandmarker, FilesetResolver, DrawingUtils } = mediaPipe;

      // Шаг 1: Загружаем файлы MediaPipe из CDN
      // FilesetResolver автоматически загрузит необходимые файлы (WASM, модели и т.д.)
      // из публичного CDN Google
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.9/wasm'
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
        outputFacialTransformationMatrixes: true, // ВАЖНО: включаем для получения transformation matrix (head pose)
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

      // Отладочный вывод (только при первом успешном обнаружении)
      if (results && results.faceLandmarks && results.faceLandmarks.length > 0 && !this._debugLogged) {
        console.info('MediaPipe results structure:', {
          hasFaceLandmarks: !!results.faceLandmarks,
          faceLandmarksCount: results.faceLandmarks?.length,
          hasFacialTransformationMatrixes: !!results.facialTransformationMatrixes,
          facialTransformationMatrixesCount: results.facialTransformationMatrixes?.length,
          facialTransformationMatrixesType: typeof results.facialTransformationMatrixes,
          isArray: Array.isArray(results.facialTransformationMatrixes),
          firstElement: results.facialTransformationMatrixes?.[0],
          firstElementType: typeof results.facialTransformationMatrixes?.[0],
          firstElementIsArray: Array.isArray(results.facialTransformationMatrixes?.[0]),
          firstElementLength: results.facialTransformationMatrixes?.[0]?.length,
          allKeys: Object.keys(results)
        });
        this._debugLogged = true;
      }

      // Проверяем, найдено ли лицо
      if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
        return null; // Лицо не обнаружено
      }

      // Извлекаем данные первого лица (мы отслеживаем только одно)
      const faceLandmarks = results.faceLandmarks[0];

      // Получаем transformation matrix - матрицу преобразования, содержащую информацию о положении головы
      // Эта матрица включает rotation (поворот) и translation (смещение) головы
      // Структура: facialTransformationMatrixes[0] = {rows: 4, columns: 4, data: Array(16)}
      let transformationMatrix = null;
      
      if (results.facialTransformationMatrixes && results.facialTransformationMatrixes.length > 0) {
        const matrixObject = results.facialTransformationMatrixes[0];
        
        // MediaPipe возвращает объект с полями rows, columns, data
        if (matrixObject && matrixObject.data && Array.isArray(matrixObject.data)) {
          transformationMatrix = matrixObject.data;
        } else if (Array.isArray(matrixObject) && matrixObject.length >= 16) {
          // Fallback: если это уже массив
          transformationMatrix = matrixObject;
        }
      }

      if (!transformationMatrix || !Array.isArray(transformationMatrix) || transformationMatrix.length < 16) {
        // Если transformation matrix недоступна, выводим детальную отладочную информацию
        if (!this._matrixDebugLogged) {
          console.warn('No transformation matrix found. Details:', {
            hasProperty: !!results.facialTransformationMatrixes,
            propertyType: typeof results.facialTransformationMatrixes,
            isArray: Array.isArray(results.facialTransformationMatrixes),
            length: results.facialTransformationMatrixes?.length,
            firstElement: results.facialTransformationMatrixes?.[0],
            firstElementType: typeof results.facialTransformationMatrixes?.[0]
          });
          this._matrixDebugLogged = true;
        }
        return null;
      }

      // Извлекаем translation (смещение) из матрицы преобразования
      // ВАЖНО: MediaPipe использует column-major формат для матрицы 4x4
      // В column-major: [m00, m10, m20, m30, m01, m11, m21, m31, m02, m12, m22, m32, m03, m13, m23, m33]
      // Translation находится в последнем столбце: [m03, m13, m23] = индексы [3, 7, 11]
      // Или можно использовать индексы [12, 13, 14] если это row-major, но MediaPipe использует column-major
      
      // Проверяем формат: если это объект с rows/columns, используем data напрямую
      // В column-major формате translation в индексах [3, 7, 11] (последний столбец)
      // В row-major формате translation в индексах [12, 13, 14] (последняя строка)
      
      // Логируем всю матрицу для отладки (только первый раз)
      if (!this._matrixFullDebugLogged) {
        console.info('Full transformation matrix:', {
          matrix: Array.from(transformationMatrix).map(v => v.toFixed(4)),
          indices: {
            colMajor: { x: transformationMatrix[3], y: transformationMatrix[7], z: transformationMatrix[11] },
            rowMajor: { x: transformationMatrix[12], y: transformationMatrix[13], z: transformationMatrix[14] }
          }
        });
        this._matrixFullDebugLogged = true;
      }

      // Пробуем оба варианта и выбираем тот, где значения в разумном диапазоне
      const colMajorTranslation = {
        x: transformationMatrix[3],  // column-major: [3] = m03
        y: transformationMatrix[7],  // column-major: [7] = m13
        z: transformationMatrix[11]  // column-major: [11] = m23
      };
      
      const rowMajorTranslation = {
        x: transformationMatrix[12], // row-major: [12] = m30
        y: transformationMatrix[13],  // row-major: [13] = m31
        z: transformationMatrix[14]  // row-major: [14] = m32
      };
      
      // Выбираем вариант с меньшими абсолютными значениями (обычно translation в диапазоне -0.1 до 0.1)
      // Column-major обычно даёт более разумные значения для MediaPipe
      // Но если оба варианта дают нули или очень большие значения, пробуем другие индексы
      const translation = (Math.abs(colMajorTranslation.x) < Math.abs(rowMajorTranslation.x) && 
                          Math.abs(colMajorTranslation.x) > 0.0001)
        ? colMajorTranslation
        : (Math.abs(rowMajorTranslation.x) > 0.0001)
          ? rowMajorTranslation
          : {
              // Если оба варианта дают нули, пробуем альтернативные индексы
              // Возможно, это другой формат матрицы
              x: transformationMatrix[0] || transformationMatrix[4] || transformationMatrix[8] || 0,
              y: transformationMatrix[1] || transformationMatrix[5] || transformationMatrix[9] || 0,
              z: transformationMatrix[2] || transformationMatrix[6] || transformationMatrix[10] || 0
            };

      // Логирование для отладки (только первые несколько раз)
      if (!this._translationDebugCount || this._translationDebugCount < 5) {
        console.info('Translation extracted:', {
          x: translation.x.toFixed(4),
          y: translation.y.toFixed(4),
          z: translation.z.toFixed(4),
          matrixLength: transformationMatrix.length,
          colMajor: { x: colMajorTranslation.x.toFixed(4), y: colMajorTranslation.y.toFixed(4), z: colMajorTranslation.z.toFixed(4) },
          rowMajor: { x: rowMajorTranslation.x.toFixed(4), y: rowMajorTranslation.y.toFixed(4), z: rowMajorTranslation.z.toFixed(4) }
        });
        this._translationDebugCount = (this._translationDebugCount || 0) + 1;
      }

      this.lastDetectionTime = nowInMs;

      // Вычисляем стабильную точку внутри объёмной головы (центр масс landmarks)
      // Используем центр масс всех landmarks для более стабильного отслеживания,
      // которое не зависит от поворотов головы
      // Смещаем центр масс на 5 см вглубь головы (в центр объёма головы)
      let stablePoint = null;
      if (faceLandmarks && faceLandmarks.length > 0) {
        // Вычисляем центр масс всех landmarks (3D центр головы)
        // Это точка внутри объёма головы, которая не меняется при поворотах
        let sumX = 0;
        let sumY = 0;
        let sumZ = 0;
        let validCount = 0;
        
        for (let i = 0; i < faceLandmarks.length; i++) {
          const landmark = faceLandmarks[i];
          if (landmark && landmark.x !== undefined && landmark.y !== undefined) {
            sumX += landmark.x;
            sumY += landmark.y;
            if (landmark.z !== undefined) {
              sumZ += landmark.z;
            }
            validCount++;
          }
        }
        
        if (validCount > 0) {
          const centerX = sumX / validCount;
          const centerY = sumY / validCount;
          const centerZ = sumZ / validCount;
          
          // Смещаем центр масс на 5 см вглубь головы (в направлении от камеры)
          // Landmarks в MediaPipe нормализованы относительно размера лица
          // Средний размер лица ~15-20 см, поэтому 5 см ≈ 0.25-0.33 в нормализованных единицах
          // Используем среднее значение 0.03 (примерно 5 см для среднего лица)
          // Смещаем в направлении увеличения Z (вглубь, от камеры)
          const depthOffset = 0.03; // ~5 см в нормализованных единицах
          
          stablePoint = {
            x: centerX,
            y: centerY,
            z: centerZ + depthOffset // Смещаем вглубь (увеличиваем Z)
          };
        }
      }

      return {
        translation,
        faceLandmarks,
        transformationMatrix,
        stablePoint // Стабильная точка на лице для отслеживания без влияния поворотов
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
