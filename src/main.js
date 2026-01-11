/**
 * Главный файл приложения
 * Точка входа - инициализирует все компоненты и запускает приложение
 */

import { CameraManager } from './camera/camera-manager.js';
import { MediaPipeHandler } from './mediapipe/mediapipe-handler.js';
import { HeadTrackingController } from './tracking/head-tracking-controller.js';
import { ViewportManager } from './viewport/viewport-manager.js';
import { ImageRenderer } from './renderer/image-renderer.js';
import { UIController } from './ui/ui-controller.js';
import { getVersionString } from './utils/version.js';

/**
 * Главный класс приложения
 */
class PanoTestApp {
  constructor() {
    this.cameraManager = null;
    this.mediaPipeHandler = null;
    this.headTrackingController = null;
    this.viewportManager = null;
    this.imageRenderer = null;
    this.uiController = null;

    this.videoElement = null;
    this.isRunning = false;
    this.animationFrameId = null;
    
    // FPS для обработки кадров (настраивается через UI)
    this.targetFPS = 30;
    this.lastFrameTime = 0;
    this.frameInterval = 1000 / 30; // 33.33ms для 30 FPS

    // Флаги для отображения маркеров и зеркалирования
    this.showLandmarks = true; // По умолчанию показываем маркеры
    this.mirrorFace = false; // По умолчанию не зеркалим

    // Путь к фоновому изображению
    this.backgroundImagePath = 'assets/images/lake1.jpg';
  }
  
  /**
   * Устанавливает целевую частоту кадров
   * @param {number} fps - Целевая частота кадров (15 или 30)
   */
  setTargetFPS(fps) {
    this.targetFPS = fps;
    this.frameInterval = 1000 / fps;
    console.info(`Target FPS set to ${fps}, frame interval: ${this.frameInterval.toFixed(2)}ms`);
  }

  /**
   * Инициализирует приложение
   */
  async initialize() {
    try {
      console.info('Initializing panoTest application...');

      // Загружаем чувствительность из localStorage ДО создания UI
      // чтобы избежать мигания дефолтных значений
      this.loadSensitivityFromStorage();
      
      // Инициализируем UI
      this.uiController = new UIController();
      this.uiController.initialize();

      // Обновляем версию в статус-баре
      this.uiController.updateVersion(getVersionString());

      // Проверяем поддержку камеры
      if (!CameraManager.isSupported()) {
        throw new Error('Ваш браузер не поддерживает доступ к камере. Используйте Chrome, Firefox или Edge.');
      }

      // Создаём скрытый video элемент для MediaPipe
      this.videoElement = document.createElement('video');
      this.videoElement.id = 'videoElement';
      this.videoElement.autoplay = true;
      this.videoElement.playsInline = true;
      document.body.appendChild(this.videoElement);

      // Создаём canvas для визуализации отладки (landmarks)
      this.debugCanvas = document.getElementById('debugCanvas');
      if (this.debugCanvas) {
        this.debugCtx = this.debugCanvas.getContext('2d');
        this.resizeDebugCanvas();
      }

      // Инициализируем компоненты
      await this.initializeComponents();

      // Настраиваем обработчики UI
      this.setupUICallbacks();
      
      // Настраиваем слайдеры чувствительности
      this.setupSensitivityControls();
      
      // Настраиваем селектор FPS
      this.setupFPSSelector();
      
      // Настраиваем кнопку показа маркеров и чекбокс зеркалирования
      this.setupLandmarksControls();
      
      // Обработчик изменения размера окна
      window.addEventListener('resize', () => {
        this.handleResize();
      });

      // Обработчик изменения размера для debug canvas
      if (this.debugCanvas) {
        window.addEventListener('resize', () => {
          this.resizeDebugCanvas();
        });
      }

      this.uiController.updateStatus('Готов к запуску. Нажмите "Старт" для начала отслеживания.');
      console.info('Application initialized successfully');
    } catch (error) {
      console.error('Initialization error:', error);
      this.uiController?.showError(error.message || 'Ошибка инициализации приложения');
      this.uiController?.updateStatus('Ошибка инициализации');
    }
  }

  /**
   * Инициализирует все компоненты приложения
   */
  async initializeComponents() {
    // Получаем canvas элемент
    const canvas = document.getElementById('backgroundCanvas');
    if (!canvas) {
      throw new Error('Canvas element not found');
    }

    // Инициализируем Image Renderer и загружаем фоновое изображение
    this.imageRenderer = new ImageRenderer(canvas);
    this.uiController.updateStatus('Загрузка фонового изображения...');
    await this.imageRenderer.loadImage(this.backgroundImagePath);

    // Получаем размеры изображения и экрана
    const imageDimensions = this.imageRenderer.getImageDimensions();
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    // Инициализируем Viewport Manager
    this.viewportManager = new ViewportManager(
      imageDimensions.width,
      imageDimensions.height,
      screenWidth,
      screenHeight
    );

    // Инициализируем Head Tracking Controller
    this.headTrackingController = new HeadTrackingController(
      screenWidth,
      screenHeight
    );
    
    // Применяем загруженную чувствительность к контроллеру (если уже загружена)
    // Если нет, значения по умолчанию уже установлены в конструкторе
    if (this._savedSensitivityX !== undefined && this._savedSensitivityY !== undefined && this._savedSensitivityZ !== undefined) {
      this.headTrackingController.setSensitivity(
        parseFloat(this._savedSensitivityX),
        parseFloat(this._savedSensitivityY),
        parseFloat(this._savedSensitivityZ)
      );
    }

    // Инициализируем Camera Manager
    this.cameraManager = new CameraManager();
    this.uiController.updateStatus('Инициализация камеры...');
    await this.cameraManager.initialize(this.videoElement);

    // Инициализируем MediaPipe Handler
    this.mediaPipeHandler = new MediaPipeHandler();
    this.uiController.updateStatus('Загрузка MediaPipe модели...');
    await this.mediaPipeHandler.initialize();

    // Рендерим начальное состояние (50% центральной части)
    // Убеждаемся, что изображение отображается даже без данных от MediaPipe
    const initialScale = this.viewportManager.getScale();
    const initialOffsetX = this.viewportManager.getOffsetX();
    const initialOffsetY = this.viewportManager.getOffsetY();
    
    console.info('Initial render - scale:', initialScale, 'offsetX:', initialOffsetX, 'offsetY:', initialOffsetY);
    
    this.imageRenderer.render(
      initialScale,
      initialOffsetX,
      initialOffsetY
    );

    this.uiController.updateStatus('Готов к запуску');
  }

  /**
   * Настраивает обработчики событий UI
   */
  setupUICallbacks() {
    this.uiController.onStart(() => {
      this.start();
    });

    this.uiController.onStop(() => {
      this.stop();
    });

    this.uiController.onResetCenter(() => {
      this.resetToCenter();
    });
  }

  /**
   * Возвращает viewport в начальное состояние (центр, начальный масштаб)
   */
  resetToCenter() {
    if (this.viewportManager) {
      this.viewportManager.reset();
    }

    if (this.headTrackingController) {
      this.headTrackingController.resetBasePosition();
    }

    // Перерисовываем с начальными параметрами
    if (this.imageRenderer && this.viewportManager) {
      this.imageRenderer.render(
        this.viewportManager.getScale(),
        this.viewportManager.getOffsetX(),
        this.viewportManager.getOffsetY()
      );
    }

    this.uiController.updateStatus('Возврат на центр выполнен');
    console.info('Viewport reset to center');
  }

  /**
   * Загружает чувствительность из localStorage
   * ВАЖНО: Z сохраняется как целое число (умноженное на 1000) для точности
   */
  loadSensitivityFromStorage() {
    const savedSensitivityX = localStorage.getItem('panoTest_sensitivityX');
    const savedSensitivityY = localStorage.getItem('panoTest_sensitivityY');
    const savedSensitivityZ = localStorage.getItem('panoTest_sensitivityZ'); // Сохраняется как целое число * 1000

    const defaultSensitivityX = 1000.0;
    const defaultSensitivityY = 1000.0;
    const defaultSensitivityZ = 0.025; // Дефолт 0.025 (отображается как 25)

    // Восстанавливаем Z: если сохранено как целое число, делим на 1000
    let restoredZ = defaultSensitivityZ;
    if (savedSensitivityZ !== null) {
      const parsedZ = parseFloat(savedSensitivityZ);
      // Если значение > 1, значит сохранено как целое число (умноженное на 1000)
      if (parsedZ > 1) {
        restoredZ = parsedZ / 1000;
      } else {
        restoredZ = parsedZ;
      }
      // Округляем до 3 знаков после запятой для точности
      restoredZ = Math.round(restoredZ * 1000) / 1000;
    }

    // Восстанавливаем X/Y
    const restoredX = savedSensitivityX ? parseFloat(savedSensitivityX) : defaultSensitivityX;
    const restoredY = savedSensitivityY ? parseFloat(savedSensitivityY) : defaultSensitivityY;

    // Применяем загруженные значения к контроллеру сразу (если он уже создан)
    if (this.headTrackingController) {
      this.headTrackingController.setSensitivity(
        restoredX,
        restoredY,
        restoredZ
      );
    }

    // Сохраняем для использования в setupSensitivityControls
    this._savedSensitivityX = restoredX.toString();
    this._savedSensitivityY = restoredY.toString();
    this._savedSensitivityZ = restoredZ.toString();
  }

  /**
   * Настраивает слайдеры чувствительности
   */
  setupSensitivityControls() {
    const sensitivityXSlider = document.getElementById('sensitivityX');
    const sensitivityYSlider = document.getElementById('sensitivityY');
    const sensitivityZSlider = document.getElementById('sensitivityZ');
    const sensitivityXValue = document.getElementById('sensitivityXValue');
    const sensitivityYValue = document.getElementById('sensitivityYValue');
    const sensitivityZValue = document.getElementById('sensitivityZValue');
    const resetSensitivityButton = document.getElementById('resetSensitivityButton');

    // Используем уже загруженные значения (из loadSensitivityFromStorage)
    const savedSensitivityX = this._savedSensitivityX || 1000.0;
    const savedSensitivityY = this._savedSensitivityY || 1000.0;
    const savedSensitivityZ = this._savedSensitivityZ || 0.025;

    const defaultSensitivityX = 1000.0;
    const defaultSensitivityY = 1000.0;
    const defaultSensitivityZ = 0.025; // Дефолт 0.025 (отображается как 25)

    // Загружаем состояние чекбоксов из localStorage
    const savedEnableX = localStorage.getItem('panoTest_enableX');
    const savedEnableY = localStorage.getItem('panoTest_enableY');
    const savedEnableZ = localStorage.getItem('panoTest_enableZ');
    
    const enableXCheckbox = document.getElementById('enableXCheckbox');
    const enableYCheckbox = document.getElementById('enableYCheckbox');
    const enableZCheckbox = document.getElementById('enableZCheckbox');
    
    // Устанавливаем состояние чекбоксов (по умолчанию включены)
    if (enableXCheckbox) {
      enableXCheckbox.checked = savedEnableX !== null ? savedEnableX === 'true' : true;
    }
    if (enableYCheckbox) {
      enableYCheckbox.checked = savedEnableY !== null ? savedEnableY === 'true' : true;
    }
    if (enableZCheckbox) {
      enableZCheckbox.checked = savedEnableZ !== null ? savedEnableZ === 'true' : true;
    }

    // Устанавливаем значения слайдеров
    if (sensitivityXSlider) {
      sensitivityXSlider.min = 0;
      sensitivityXSlider.max = 3500; // Увеличено до 3500
      sensitivityXSlider.step = 10;
      sensitivityXSlider.value = savedSensitivityX || defaultSensitivityX;
      if (sensitivityXValue) {
        sensitivityXValue.textContent = Math.round(parseFloat(sensitivityXSlider.value));
      }
    }

    if (sensitivityYSlider) {
      sensitivityYSlider.min = 0;
      sensitivityYSlider.max = 3500; // Увеличено до 3500
      sensitivityYSlider.step = 10;
      sensitivityYSlider.value = savedSensitivityY || defaultSensitivityY;
      if (sensitivityYValue) {
        sensitivityYValue.textContent = Math.round(parseFloat(sensitivityYSlider.value));
      }
    }

    if (sensitivityZSlider) {
      // Обновляем min/max для Z-слайдера (для отображения умножаем на 1000)
      sensitivityZSlider.min = 0.0;
      sensitivityZSlider.max = 0.03;
      sensitivityZSlider.step = 0.0001; // Точный шаг для диапазона 0.001-0.03
      sensitivityZSlider.value = savedSensitivityZ || defaultSensitivityZ;
      if (sensitivityZValue) {
        // Отображаем умноженное на 1000 (0.025 → 25)
        const displayValue = parseFloat(sensitivityZSlider.value) * 1000;
        sensitivityZValue.textContent = Math.round(displayValue);
      }
    }

    // Применяем загруженные значения к контроллеру с учётом чекбоксов
    const enabledX = enableXCheckbox ? enableXCheckbox.checked : true;
    const enabledY = enableYCheckbox ? enableYCheckbox.checked : true;
    const enabledZ = enableZCheckbox ? enableZCheckbox.checked : true;
    
    if (this.headTrackingController) {
      const effectiveX = enabledX ? parseFloat(savedSensitivityX || defaultSensitivityX) : 0;
      const effectiveY = enabledY ? parseFloat(savedSensitivityY || defaultSensitivityY) : 0;
      const effectiveZ = enabledZ ? parseFloat(savedSensitivityZ || defaultSensitivityZ) : 0;
      
      this.headTrackingController.setSensitivity(effectiveX, effectiveY, effectiveZ);
    }

    // Функция для применения чувствительности с учётом чекбоксов
    const applySensitivity = () => {
      if (!this.headTrackingController) return;
      
      const enabledX = enableXCheckbox ? enableXCheckbox.checked : true;
      const enabledY = enableYCheckbox ? enableYCheckbox.checked : true;
      const enabledZ = enableZCheckbox ? enableZCheckbox.checked : true;
      
      const effectiveX = enabledX && sensitivityXSlider ? parseFloat(sensitivityXSlider.value) : 0;
      const effectiveY = enabledY && sensitivityYSlider ? parseFloat(sensitivityYSlider.value) : 0;
      const effectiveZ = enabledZ && sensitivityZSlider ? parseFloat(sensitivityZSlider.value) : 0;
      
      this.headTrackingController.setSensitivity(effectiveX, effectiveY, effectiveZ);
    };

    // Обработчики для чекбоксов
    if (enableXCheckbox) {
      enableXCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('panoTest_enableX', e.target.checked.toString());
        applySensitivity();
      });
    }

    if (enableYCheckbox) {
      enableYCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('panoTest_enableY', e.target.checked.toString());
        applySensitivity();
      });
    }

    if (enableZCheckbox) {
      enableZCheckbox.addEventListener('change', (e) => {
        localStorage.setItem('panoTest_enableZ', e.target.checked.toString());
        applySensitivity();
      });
    }

    // Обработчики для слайдеров
    if (sensitivityXSlider && sensitivityXValue) {
      sensitivityXSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        sensitivityXValue.textContent = Math.round(value);
        localStorage.setItem('panoTest_sensitivityX', value.toString());
        applySensitivity();
      });
    }

    if (sensitivityYSlider && sensitivityYValue) {
      sensitivityYSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        sensitivityYValue.textContent = Math.round(value);
        localStorage.setItem('panoTest_sensitivityY', value.toString());
        applySensitivity();
      });
    }

    if (sensitivityZSlider && sensitivityZValue) {
      sensitivityZSlider.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        // Округляем до 4 знаков после запятой для точности
        const roundedValue = Math.round(value * 10000) / 10000;
        
        // Отображаем умноженное на 1000 (0.025 → 25)
        const displayValue = roundedValue * 1000;
        sensitivityZValue.textContent = Math.round(displayValue);
        
        // Сохраняем как целое число (умноженное на 1000) для точности
        const savedValue = Math.round(roundedValue * 1000);
        localStorage.setItem('panoTest_sensitivityZ', savedValue.toString());
        
        applySensitivity();
      });
    }

    // Обработчик для кнопки сброса
    if (resetSensitivityButton) {
      resetSensitivityButton.addEventListener('click', () => {
        // Сбрасываем значения
        if (sensitivityXSlider) {
          sensitivityXSlider.value = defaultSensitivityX;
          if (sensitivityXValue) {
            sensitivityXValue.textContent = defaultSensitivityX;
          }
        }
        if (sensitivityYSlider) {
          sensitivityYSlider.value = defaultSensitivityY;
          if (sensitivityYValue) {
            sensitivityYValue.textContent = defaultSensitivityY;
          }
        }
        if (sensitivityZSlider) {
          sensitivityZSlider.value = defaultSensitivityZ;
          if (sensitivityZValue) {
            // Отображаем умноженное на 1000 (0.025 → 25)
            const displayValue = defaultSensitivityZ * 1000;
            sensitivityZValue.textContent = Math.round(displayValue);
          }
        }

        // Сохраняем в localStorage
        localStorage.setItem('panoTest_sensitivityX', defaultSensitivityX.toString());
        localStorage.setItem('panoTest_sensitivityY', defaultSensitivityY.toString());
        // Z сохраняем как целое число (умноженное на 1000) для точности
        const savedZ = Math.round(defaultSensitivityZ * 1000);
        localStorage.setItem('panoTest_sensitivityZ', savedZ.toString());

        // Сбрасываем чекбоксы в состояние по умолчанию (включены)
        if (enableXCheckbox) {
          enableXCheckbox.checked = true;
          localStorage.setItem('panoTest_enableX', 'true');
        }
        if (enableYCheckbox) {
          enableYCheckbox.checked = true;
          localStorage.setItem('panoTest_enableY', 'true');
        }
        if (enableZCheckbox) {
          enableZCheckbox.checked = true;
          localStorage.setItem('panoTest_enableZ', 'true');
        }

        // Применяем к контроллеру с учётом чекбоксов
        if (this.headTrackingController) {
          this.headTrackingController.setSensitivity(
            defaultSensitivityX,
            defaultSensitivityY,
            defaultSensitivityZ
          );
        }
      });
    }
  }

  /**
   * Настраивает селектор FPS
   */
  setupFPSSelector() {
    const fpsSelector = document.getElementById('fpsSelector');
    
    // Загружаем сохранённое значение FPS
    const savedFPS = localStorage.getItem('panoTest_fps');
    const defaultFPS = 30;
    const targetFPS = parseInt(savedFPS || defaultFPS, 10);
    
    if (fpsSelector) {
      fpsSelector.value = targetFPS.toString();
      this.setTargetFPS(targetFPS);
      
      fpsSelector.addEventListener('change', (e) => {
        const fps = parseInt(e.target.value, 10);
        this.setTargetFPS(fps);
        localStorage.setItem('panoTest_fps', fps.toString());
      });
    }
  }

  /**
   * Настраивает элементы управления маркерами и зеркалированием
   */
  setupLandmarksControls() {
    // Загружаем сохранённые значения из localStorage
    const savedShowLandmarks = localStorage.getItem('panoTest_showLandmarks');
    const savedMirrorFace = localStorage.getItem('panoTest_mirrorFace');
    
    // Устанавливаем значения по умолчанию
    this.showLandmarks = savedShowLandmarks !== null ? savedShowLandmarks === 'true' : true;
    this.mirrorFace = savedMirrorFace !== null ? savedMirrorFace === 'true' : false;
    
    // Кнопка показа/скрытия маркеров
    const toggleLandmarksButton = document.getElementById('toggleLandmarksButton');
    if (toggleLandmarksButton) {
      // Обновляем текст кнопки в зависимости от состояния
      toggleLandmarksButton.textContent = this.showLandmarks ? 'Скрыть маркеры лица' : 'Показать маркеры лица';
      
      toggleLandmarksButton.addEventListener('click', () => {
        this.showLandmarks = !this.showLandmarks;
        toggleLandmarksButton.textContent = this.showLandmarks ? 'Скрыть маркеры лица' : 'Показать маркеры лица';
        localStorage.setItem('panoTest_showLandmarks', this.showLandmarks.toString());
        
        // Очищаем canvas если маркеры скрыты
        if (!this.showLandmarks && this.debugCanvas && this.debugCtx) {
          this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
        }
      });
    }
    
    // Чекбокс зеркалирования
    const mirrorFaceCheckbox = document.getElementById('mirrorFaceCheckbox');
    if (mirrorFaceCheckbox) {
      mirrorFaceCheckbox.checked = this.mirrorFace;
      
      mirrorFaceCheckbox.addEventListener('change', (e) => {
        this.mirrorFace = e.target.checked;
        localStorage.setItem('panoTest_mirrorFace', this.mirrorFace.toString());
      });
    }
  }

  /**
   * Запускает отслеживание
   */
  async start() {
    if (this.isRunning) {
      return;
    }

    try {
      this.uiController.setStartedState();
      this.uiController.updateStatus('Отслеживание запущено...');
      this.isRunning = true;
      this.lastFrameTime = performance.now(); // Инициализируем время для FPS ограничения

      // Запускаем цикл обработки кадров
      this.processFrames();
    } catch (error) {
      console.error('Start error:', error);
      this.uiController.showError(error.message || 'Ошибка запуска отслеживания');
      this.stop();
    }
  }

  /**
   * Останавливает отслеживание
   */
  stop() {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this.uiController.setStoppedState();
    this.uiController.updateStatus('Отслеживание остановлено');
  }

  /**
   * Основной цикл обработки кадров
   */
  processFrames() {
    if (!this.isRunning) {
      return;
    }

    // Ограничиваем частоту кадров
    const now = performance.now();
    const elapsed = now - this.lastFrameTime;
    
    if (elapsed < this.frameInterval) {
      // Слишком рано для следующего кадра
      this.animationFrameId = requestAnimationFrame(() => {
        this.processFrames();
      });
      return;
    }
    
    this.lastFrameTime = now - (elapsed % this.frameInterval);

    // Обрабатываем кадр через MediaPipe
    const mediaPipeResult = this.mediaPipeHandler.processFrame(this.videoElement);

    if (mediaPipeResult) {
      // Визуализируем landmarks для отладки (если включено)
      if (mediaPipeResult.faceLandmarks && this.showLandmarks) {
        // Логируем структуру для отладки (только первый раз)
        if (!this._landmarksStructureLogged) {
          console.info('FaceLandmarks structure:', {
            isArray: Array.isArray(mediaPipeResult.faceLandmarks),
            length: mediaPipeResult.faceLandmarks?.length,
            firstElement: mediaPipeResult.faceLandmarks?.[0],
            firstElementType: typeof mediaPipeResult.faceLandmarks?.[0],
            firstElementIsArray: Array.isArray(mediaPipeResult.faceLandmarks?.[0]),
            firstElementLength: mediaPipeResult.faceLandmarks?.[0]?.length
          });
          this._landmarksStructureLogged = true;
        }
        this.drawDebugLandmarks(mediaPipeResult.faceLandmarks);
      } else if (this.debugCanvas && this.debugCtx) {
        // Очищаем canvas если маркеры скрыты
        this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);
      }

      // Преобразуем head pose в параметры для viewport
      const trackingResult = this.headTrackingController.processHeadPose(mediaPipeResult);

      if (trackingResult) {
        // Логирование перед обновлением viewport (каждые 30 кадров)
        if (!this._frameCount) this._frameCount = 0;
        this._frameCount++;
        if (this._frameCount % 30 === 0) {
          console.info(`[Frame ${this._frameCount}] Main processFrames - before viewport update:`, {
            displayPercent: trackingResult.displayPercent.toFixed(2),
            offsetX: trackingResult.offsetX.toFixed(4),
            offsetY: trackingResult.offsetY.toFixed(4),
            currentScale: this.viewportManager.getScale().toFixed(2),
            currentOffsetX: this.viewportManager.getOffsetX().toFixed(2),
            currentOffsetY: this.viewportManager.getOffsetY().toFixed(2)
          });
        }

        // Обновляем viewport
        this.viewportManager.updateDisplayPercent(trackingResult.displayPercent);
        
        // ВАЖНО: offsetX/Y уже вычислены как прямые дельты без накопления
        // Если голова неподвижна (deltaX/Y = 0), offsetX/Y = 0, и viewport не меняется
        // Передаём дельты напрямую (чувствительность уже применена в HeadTrackingController)
        this.viewportManager.updateOffset(
          trackingResult.offsetX,
          trackingResult.offsetY,
          1.0 // sensitivity уже применена в HeadTrackingController
        );

        // Логирование после обновления viewport (каждые 30 кадров)
        if (this._frameCount % 30 === 0) {
          console.info(`[Frame ${this._frameCount}] Main processFrames - after viewport update:`, {
            newScale: this.viewportManager.getScale().toFixed(2),
            newOffsetX: this.viewportManager.getOffsetX().toFixed(2),
            newOffsetY: this.viewportManager.getOffsetY().toFixed(2),
            newDisplayPercent: this.viewportManager.getDisplayPercent().toFixed(2)
          });
        }

        // Рендерим изображение с обновлённым viewport
        this.imageRenderer.render(
          this.viewportManager.getScale(),
          this.viewportManager.getOffsetX(),
          this.viewportManager.getOffsetY()
        );

        // Обновляем статус (для отладки)
        // Проверяем на NaN перед форматированием
        const distanceStr = trackingResult.distance && !isNaN(trackingResult.distance) 
          ? trackingResult.distance.toFixed(2) 
          : 'N/A';
        const angularStr = trackingResult.angularSize && !isNaN(trackingResult.angularSize)
          ? trackingResult.angularSize.toFixed(1)
          : 'N/A';
        const percentStr = trackingResult.displayPercent && !isNaN(trackingResult.displayPercent)
          ? trackingResult.displayPercent.toFixed(1)
          : '50.0';
        const statusText = `Отслеживание | РМ: ${distanceStr}м | УРЭ: ${angularStr}° | Масштаб: ${percentStr}%`;
        this.uiController.updateStatus(statusText);
      } else {
        this.uiController.updateStatus('Лицо не обнаружено в кадре');
      }
    }

    // Планируем следующий кадр (FPS ограничение уже применено в начале функции)
    this.animationFrameId = requestAnimationFrame(() => {
      this.processFrames();
    });
  }

  /**
   * Устанавливает размер debug canvas
   */
  resizeDebugCanvas() {
    if (!this.debugCanvas || !this.debugCtx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = this.debugCanvas.getBoundingClientRect();

    this.debugCanvas.width = rect.width * dpr;
    this.debugCanvas.height = rect.height * dpr;
    this.debugCtx.scale(dpr, dpr);

    this.debugCanvas.style.width = `${rect.width}px`;
    this.debugCanvas.style.height = `${rect.height}px`;
  }

  /**
   * Рисует landmarks на debug canvas для отладки
   * @param {Array} faceLandmarks - Массив landmarks от MediaPipe
   */
  drawDebugLandmarks(faceLandmarks) {
    if (!this.debugCanvas || !this.debugCtx || !faceLandmarks) {
      return;
    }

    // Очищаем canvas
    this.debugCtx.clearRect(0, 0, this.debugCanvas.width, this.debugCanvas.height);

    // Проверяем структуру данных
    if (!Array.isArray(faceLandmarks) || faceLandmarks.length === 0) {
      return;
    }

    // MediaPipe возвращает массив объектов с координатами: [{x, y, z}, {x, y, z}, ...]
    // Каждый элемент - это landmark с координатами x, y, z (нормализованные 0-1)
    let landmarks = null;
    
    if (Array.isArray(faceLandmarks) && faceLandmarks.length > 0) {
      // Проверяем, это массив массивов или массив объектов
      const firstElement = faceLandmarks[0];
      if (Array.isArray(firstElement)) {
        // Формат: [[{x,y,z}, {x,y,z}], ...] - массив массивов
        landmarks = firstElement;
      } else if (firstElement && typeof firstElement === 'object' && ('x' in firstElement || Array.isArray(firstElement))) {
        // Формат: [{x,y,z}, {x,y,z}, ...] - массив объектов (это наш случай!)
        landmarks = faceLandmarks;
      }
    }
    
    if (!landmarks || !Array.isArray(landmarks) || landmarks.length === 0) {
      // Логируем только первый раз для отладки
      if (!this._landmarksErrorLogged) {
        console.warn('Invalid landmarks structure:', {
          faceLandmarks,
          type: typeof faceLandmarks,
          isArray: Array.isArray(faceLandmarks),
          length: faceLandmarks?.length,
          firstElement: faceLandmarks?.[0],
          firstElementType: typeof faceLandmarks?.[0],
          firstElementKeys: faceLandmarks?.[0] ? Object.keys(faceLandmarks[0]) : null
        });
        this._landmarksErrorLogged = true;
      }
      return;
    }
    
    // Логируем структуру landmarks (только первый раз)
    if (!this._landmarksStructureLogged && landmarks.length > 0) {
      console.info('Landmarks structure confirmed:', {
        totalLandmarks: landmarks.length,
        firstLandmark: landmarks[0],
        hasX: 'x' in landmarks[0],
        hasY: 'y' in landmarks[0],
        hasZ: 'z' in landmarks[0]
      });
      this._landmarksStructureLogged = true;
    }

    // Получаем размеры canvas (уже масштабированы)
    const canvasWidth = this.debugCanvas.width / (window.devicePixelRatio || 1);
    const canvasHeight = this.debugCanvas.height / (window.devicePixelRatio || 1);

    // Рисуем landmarks
    this.debugCtx.strokeStyle = '#00ff00';
    this.debugCtx.fillStyle = '#00ff00';
    this.debugCtx.lineWidth = 2;

    landmarks.forEach((landmark, index) => {
      // Проверяем формат landmark - может быть объект с x/y или массив [x, y, z]
      let x, y;
      if (landmark && typeof landmark === 'object') {
        x = landmark.x !== undefined ? landmark.x : (Array.isArray(landmark) ? landmark[0] : 0);
        y = landmark.y !== undefined ? landmark.y : (Array.isArray(landmark) ? landmark[1] : 0);
      } else if (Array.isArray(landmark)) {
        x = landmark[0] || 0;
        y = landmark[1] || 0;
      } else {
        return; // Пропускаем невалидные landmarks
      }

      // Применяем зеркалирование если включено
      let normalizedX = x;
      if (this.mirrorFace) {
        normalizedX = 1 - x; // Зеркалим по горизонтали
      }
      
      // Нормализуем координаты (MediaPipe возвращает нормализованные 0-1)
      const canvasX = normalizedX * canvasWidth;
      const canvasY = y * canvasHeight;

      // Рисуем точку
      this.debugCtx.beginPath();
      this.debugCtx.arc(canvasX, canvasY, 2, 0, 2 * Math.PI);
      this.debugCtx.fill();

      // Рисуем номер для ключевых точек (первые 10)
      if (index < 10) {
        this.debugCtx.fillStyle = '#ffffff';
        this.debugCtx.font = '10px Arial';
        this.debugCtx.fillText(index.toString(), canvasX + 3, canvasY - 3);
        this.debugCtx.fillStyle = '#00ff00';
      }
    });

    // Рисуем контур лица (соединяем ключевые точки)
    if (landmarks.length >= 468) {
      // MediaPipe Face Mesh имеет 468 landmarks
      // Рисуем контур лица (примерные индексы для контура)
      const faceOutline = [
        10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
        397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
        172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
      ];

      this.debugCtx.strokeStyle = '#00ffff';
      this.debugCtx.beginPath();
      faceOutline.forEach((idx, i) => {
        if (landmarks[idx]) {
          const landmark = landmarks[idx];
          let x, y;
          if (landmark && typeof landmark === 'object') {
            x = landmark.x !== undefined ? landmark.x : (Array.isArray(landmark) ? landmark[0] : 0);
            y = landmark.y !== undefined ? landmark.y : (Array.isArray(landmark) ? landmark[1] : 0);
          } else if (Array.isArray(landmark)) {
            x = landmark[0] || 0;
            y = landmark[1] || 0;
          } else {
            return;
          }
          
          // Применяем зеркалирование если включено
          let normalizedX = x;
          if (this.mirrorFace) {
            normalizedX = 1 - x; // Зеркалим по горизонтали
          }
          
          const canvasX = normalizedX * canvasWidth;
          const canvasY = y * canvasHeight;
          
          if (i === 0) {
            this.debugCtx.moveTo(canvasX, canvasY);
          } else {
            this.debugCtx.lineTo(canvasX, canvasY);
          }
        }
      });
      this.debugCtx.closePath();
      this.debugCtx.stroke();
    }
  }

  /**
   * Обрабатывает изменение размера окна
   */
  handleResize() {
    if (this.imageRenderer) {
      this.imageRenderer.resizeCanvas();
    }

    if (this.debugCanvas) {
      this.resizeDebugCanvas();
    }

    if (this.viewportManager && this.headTrackingController) {
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      this.viewportManager.updateScreenSize(screenWidth, screenHeight);
      this.headTrackingController.updateScreenSize(screenWidth, screenHeight);
    }

    // Перерисовываем с текущими параметрами
    if (this.imageRenderer && this.viewportManager) {
      this.imageRenderer.render(
        this.viewportManager.getScale(),
        this.viewportManager.getOffsetX(),
        this.viewportManager.getOffsetY()
      );
    }
  }

  /**
   * Освобождает ресурсы при завершении
   */
  dispose() {
    this.stop();

    if (this.cameraManager) {
      this.cameraManager.stop();
    }

    if (this.mediaPipeHandler) {
      this.mediaPipeHandler.dispose();
    }
  }
}

// Инициализируем приложение при загрузке DOM
document.addEventListener('DOMContentLoaded', async () => {
  const app = new PanoTestApp();
  await app.initialize();

  // Сохраняем ссылку на приложение для отладки
  window.panoTestApp = app;
});
