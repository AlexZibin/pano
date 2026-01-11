/**
 * Camera Manager
 * Управляет доступом к веб-камере через WebRTC API
 */

/**
 * Класс для управления веб-камерой
 */
export class CameraManager {
  /**
   * Создаёт экземпляр CameraManager
   */
  constructor() {
    this.videoElement = null;
    this.stream = null;
    this.isActive = false;
  }

  /**
   * Инициализирует доступ к веб-камере
   * @param {HTMLVideoElement} videoElement - HTML элемент video для отображения потока
   * @param {Object} constraints - Ограничения для видео потока (разрешение, FPS)
   * @returns {Promise<void>}
   * @throws {Error} Если доступ к камере отклонён или камера недоступна
   */
  async initialize(videoElement, constraints = null) {
    if (!videoElement) {
      throw new Error('Video element is required');
    }

    this.videoElement = videoElement;

    // Стандартные ограничения: разрешение минимум 640x480, ~30 FPS
    const defaultConstraints = {
      video: {
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        frameRate: { ideal: 30, min: 15 },
        facingMode: 'user' // Фронтальная камера
      }
    };

    const videoConstraints = constraints?.video || defaultConstraints.video;

    try {
      // Запрашиваем доступ к камере
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints
      });

      // Подключаем поток к video элементу
      this.videoElement.srcObject = this.stream;
      this.isActive = true;

      console.info('Camera initialized successfully');
      console.info(`Video resolution: ${this.videoElement.videoWidth}x${this.videoElement.videoHeight}`);
      console.info(`Frame rate target: ${videoConstraints.frameRate?.ideal || 30} FPS`);

      return new Promise((resolve, reject) => {
        // Ждём, пока видео будет готово к воспроизведению
        this.videoElement.onloadedmetadata = () => {
          this.videoElement.play()
            .then(() => {
              console.info('Camera stream started');
              resolve();
            })
            .catch(reject);
        };

        this.videoElement.onerror = reject;
      });
    } catch (error) {
      this.isActive = false;
      console.error('Camera initialization error:', error);

      // Обрабатываем различные типы ошибок
      if (error.name === 'NotAllowedError') {
        throw new Error('Доступ к камере запрещён. Разрешите доступ в настройках браузера.');
      } else if (error.name === 'NotFoundError') {
        throw new Error('Камера не найдена. Убедитесь, что камера подключена.');
      } else if (error.name === 'NotReadableError') {
        throw new Error('Камера уже используется другим приложением.');
      } else {
        throw new Error(`Ошибка инициализации камеры: ${error.message}`);
      }
    }
  }

  /**
   * Останавливает видеопоток и освобождает камеру
   */
  stop() {
    if (this.stream) {
      // Останавливаем все треки потока
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.info(`Track stopped: ${track.kind} - ${track.label}`);
      });

      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    this.isActive = false;
    console.info('Camera stopped');
  }

  /**
   * Проверяет, активна ли камера
   * @returns {boolean}
   */
  isCameraActive() {
    return this.isActive && this.stream !== null;
  }

  /**
   * Получает разрешение видео
   * @returns {{width: number, height: number}|null}
   */
  getVideoDimensions() {
    if (!this.videoElement || !this.isActive) {
      return null;
    }

    return {
      width: this.videoElement.videoWidth,
      height: this.videoElement.videoHeight
    };
  }

  /**
   * Проверяет поддержку WebRTC API в браузере
   * @returns {boolean}
   */
  static isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }
}
