/**
 * UI Controller
 * Управление интерфейсом пользователя
 */

/**
 * Класс для управления UI элементами
 */
export class UIController {
  /**
   * Создаёт экземпляр UIController
   */
  constructor() {
    this.startButton = null;
    this.stopButton = null;
    this.resetCenterButton = null;
    this.statusText = null;
    this.versionInfo = null;
    this.errorMessage = null;
  }

  /**
   * Инициализирует UI элементы
   */
  initialize() {
    this.startButton = document.getElementById('startButton');
    this.stopButton = document.getElementById('stopButton');
    this.resetCenterButton = document.getElementById('resetCenterButton');
    this.statusText = document.getElementById('status-text');
    this.versionInfo = document.getElementById('version-info');
    this.errorMessage = document.getElementById('error-message');

    // Устанавливаем обработчики событий для кнопок
    if (this.startButton) {
      this.startButton.addEventListener('click', () => {
        if (this.onStartCallback) {
          this.onStartCallback();
        }
      });
    }

    if (this.stopButton) {
      this.stopButton.addEventListener('click', () => {
        if (this.onStopCallback) {
          this.onStopCallback();
        }
      });
    }

    if (this.resetCenterButton) {
      this.resetCenterButton.addEventListener('click', () => {
        if (this.onResetCenterCallback) {
          this.onResetCenterCallback();
        }
      });
    }
  }

  /**
   * Устанавливает callback для кнопки "Старт"
   * @param {Function} callback
   */
  onStart(callback) {
    this.onStartCallback = callback;
  }

  /**
   * Устанавливает callback для кнопки "Стоп"
   * @param {Function} callback
   */
  onStop(callback) {
    this.onStopCallback = callback;
  }

  /**
   * Устанавливает callback для кнопки "Возврат на центр"
   * @param {Function} callback
   */
  onResetCenter(callback) {
    this.onResetCenterCallback = callback;
  }

  /**
   * Обновляет статус текста
   * @param {string} text - Текст статуса
   */
  updateStatus(text) {
    if (this.statusText) {
      this.statusText.textContent = text;
    }
  }

  /**
   * Обновляет информацию о версии
   * @param {string} versionString - Строка с версией и билдом
   */
  updateVersion(versionString) {
    if (this.versionInfo) {
      this.versionInfo.textContent = versionString;
    }
  }

  /**
   * Переключает состояние кнопок при старте
   */
  setStartedState() {
    if (this.startButton) {
      this.startButton.disabled = true;
    }
    if (this.stopButton) {
      this.stopButton.disabled = false;
    }
  }

  /**
   * Переключает состояние кнопок при остановке
   */
  setStoppedState() {
    if (this.startButton) {
      this.startButton.disabled = false;
    }
    if (this.stopButton) {
      this.stopButton.disabled = true;
    }
  }

  /**
   * Показывает сообщение об ошибке
   * @param {string} message - Текст ошибки
   */
  showError(message) {
    if (this.errorMessage) {
      this.errorMessage.textContent = message;
      this.errorMessage.classList.remove('hidden');

      // Автоматически скрываем через 5 секунд
      setTimeout(() => {
        this.hideError();
      }, 5000);
    }
  }

  /**
   * Скрывает сообщение об ошибке
   */
  hideError() {
    if (this.errorMessage) {
      this.errorMessage.classList.add('hidden');
    }
  }
}
