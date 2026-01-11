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

    // Путь к фоновому изображению
    this.backgroundImagePath = 'assets/images/lake1.jpg';
  }

  /**
   * Инициализирует приложение
   */
  async initialize() {
    try {
      console.info('Initializing panoTest application...');

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

      // Инициализируем компоненты
      await this.initializeComponents();

      // Настраиваем обработчики UI
      this.setupUICallbacks();

      // Обработчик изменения размера окна
      window.addEventListener('resize', () => {
        this.handleResize();
      });

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

    // Инициализируем Camera Manager
    this.cameraManager = new CameraManager();
    this.uiController.updateStatus('Инициализация камеры...');
    await this.cameraManager.initialize(this.videoElement);

    // Инициализируем MediaPipe Handler
    this.mediaPipeHandler = new MediaPipeHandler();
    this.uiController.updateStatus('Загрузка MediaPipe модели...');
    await this.mediaPipeHandler.initialize();

    // Рендерим начальное состояние (50% центральной части)
    this.imageRenderer.render(
      this.viewportManager.getScale(),
      this.viewportManager.getOffsetX(),
      this.viewportManager.getOffsetY()
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

    // Обрабатываем кадр через MediaPipe
    const mediaPipeResult = this.mediaPipeHandler.processFrame(this.videoElement);

    if (mediaPipeResult) {
      // Преобразуем head pose в параметры для viewport
      const trackingResult = this.headTrackingController.processHeadPose(mediaPipeResult);

      if (trackingResult) {
        // Обновляем viewport
        this.viewportManager.updateDisplayPercent(trackingResult.displayPercent);
        this.viewportManager.updateOffset(
          trackingResult.offsetX,
          trackingResult.offsetY
        );

        // Рендерим изображение с обновлённым viewport
        this.imageRenderer.render(
          this.viewportManager.getScale(),
          this.viewportManager.getOffsetX(),
          this.viewportManager.getOffsetY()
        );

        // Обновляем статус (для отладки)
        const statusText = `Отслеживание | РМ: ${trackingResult.distance?.toFixed(2)}м | УРЭ: ${trackingResult.angularSize?.toFixed(1)}° | Масштаб: ${trackingResult.displayPercent.toFixed(1)}%`;
        this.uiController.updateStatus(statusText);
      } else {
        this.uiController.updateStatus('Лицо не обнаружено в кадре');
      }
    }

    // Планируем следующий кадр
    this.animationFrameId = requestAnimationFrame(() => {
      this.processFrames();
    });
  }

  /**
   * Обрабатывает изменение размера окна
   */
  handleResize() {
    if (this.imageRenderer) {
      this.imageRenderer.resizeCanvas();
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
