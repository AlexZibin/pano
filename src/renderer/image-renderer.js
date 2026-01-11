/**
 * Image Renderer
 * Загружает и отображает фоновое изображение (ФИ) на canvas
 */

/**
 * Класс для рендеринга фонового изображения
 */
export class ImageRenderer {
  /**
   * Создаёт экземпляр ImageRenderer
   * @param {HTMLCanvasElement} canvas - Canvas элемент для рендеринга
   */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.image = null;
    this.imageLoaded = false;
  }

  /**
   * Загружает фоновое изображение
   * @param {string} imagePath - Путь к изображению
   * @returns {Promise<void>}
   */
  async loadImage(imagePath) {
    return new Promise((resolve, reject) => {
      console.info(`Loading background image from: ${imagePath}`);

      this.image = new Image();
      this.image.crossOrigin = 'anonymous'; // Для CORS, если нужно

      this.image.onload = () => {
        this.imageLoaded = true;

        // Выводим размер изображения в логи (как просил пользователь)
        console.info(`Background image loaded successfully`);
        console.info(`Image dimensions: ${this.image.width} x ${this.image.height} pixels`);
        console.info(`Image size: ${(this.image.width * this.image.height / 1000000).toFixed(2)} megapixels`);

        // Устанавливаем размер canvas под размер окна
        this.resizeCanvas();

        resolve();
      };

      this.image.onerror = (error) => {
        console.error('Error loading image:', error);
        this.imageLoaded = false;
        reject(new Error(`Не удалось загрузить изображение: ${imagePath}`));
      };

      this.image.src = imagePath;
    });
  }

  /**
   * Устанавливает размер canvas под размер окна браузера
   */
  resizeCanvas() {
    if (!this.canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();

    // Устанавливаем размер canvas в пикселях устройства
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;

    // Масштабируем контекст для правильного отображения
    this.ctx.scale(dpr, dpr);

    // Устанавливаем CSS размер для отображения
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;
  }

  /**
   * Очищает canvas
   */
  clear() {
    if (!this.ctx || !this.canvas) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Рендерит изображение с учётом viewport (масштаб и позиция)
   * @param {number} scale - Масштаб (1.0 = 100%, 2.0 = 50% отображения и т.д.)
   * @param {number} offsetX - Смещение по X (в пикселях изображения)
   * @param {number} offsetY - Смещение по Y (в пикселях изображения)
   */
  render(scale = 1.0, offsetX = 0, offsetY = 0) {
    if (!this.imageLoaded || !this.image || !this.ctx) {
      return;
    }

    // Очищаем canvas
    this.clear();

    const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
    const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);

    // Рассчитываем размер отображаемой области изображения
    // scale = 1.0 означает показываем 100% изображения, scale = 2.0 означает 50%
    const displayWidth = this.image.width / scale;
    const displayHeight = this.image.height / scale;

    // Рассчитываем позицию viewport на изображении
    // offsetX/Y - это смещение центра viewport относительно центра изображения
    const imageCenterX = this.image.width / 2;
    const imageCenterY = this.image.height / 2;

    const sourceX = imageCenterX - displayWidth / 2 + offsetX;
    const sourceY = imageCenterY - displayHeight / 2 + offsetY;

    // Ограничиваем границы, чтобы не выйти за пределы изображения
    const clampedSourceX = Math.max(0, Math.min(this.image.width - displayWidth, sourceX));
    const clampedSourceY = Math.max(0, Math.min(this.image.height - displayHeight, sourceY));

    // Рисуем часть изображения на canvas
    this.ctx.drawImage(
      this.image,
      clampedSourceX,
      clampedSourceY,
      displayWidth,
      displayHeight,
      0,
      0,
      canvasWidth,
      canvasHeight
    );
  }

  /**
   * Проверяет, загружено ли изображение
   * @returns {boolean}
   */
  isImageLoaded() {
    return this.imageLoaded;
  }

  /**
   * Получает размеры изображения
   * @returns {{width: number, height: number}|null}
   */
  getImageDimensions() {
    if (!this.imageLoaded || !this.image) {
      return null;
    }

    return {
      width: this.image.width,
      height: this.image.height
    };
  }
}
