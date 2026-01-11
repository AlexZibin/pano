# panoTest

Web application for interactive image control on screen using head position tracking via webcam.

## Description

panoTest is a prototype of an innovative interface that allows controlling image panning and zooming on screen without using a mouse or keyboard. Instead, it uses tracking of the user's head position relative to the webcam through MediaPipe.

### How it works

1. **Head tracking**: MediaPipe Face Landmarker tracks the user's head position in real-time (translation X/Y/Z relative to the camera)

2. **Zooming**: When the head approaches the screen, the percentage of the displayed background image area increases. The transformation is based on calculating the angular size of the screen using the formula: α = 2 × arctan(W / (2 × L))

3. **Panning**: When the head moves left/right/up/down, the viewing "window" shifts across the background image, creating a virtual window effect

## Technologies

- **JavaScript (ES6+)** - main development language
- **MediaPipe** - computer vision for head tracking
- **Canvas API** - image rendering
- **WebRTC API** - webcam access
- **Three.js** - planned for particle system (future)

## Requirements

- Modern browser with WebRTC support (Chrome 90+, Firefox 88+, Edge 90+)
- Webcam
- Good lighting for stable face tracking
- Sufficiently powerful device for real-time video processing (~30 FPS)

## Installation and Running

### Prerequisites
- Node.js and npm (or yarn)
- Local web server (HTTP/HTTPS required for camera access)

### Installation Steps

1. Clone the repository:
```bash
git clone <repository-url>
cd pano
```

2. Install dependencies:
```bash
npm install
```

3. Start the local server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3002
```

5. Allow webcam access when prompted by the browser

## Usage

1. On first launch, the application will request access to your webcam - allow access
2. Make sure your face is clearly visible in the camera and well-lit
3. Click the "Start" button to begin tracking
4. Slowly move closer to and away from the screen - the image will zoom
5. Move your head left/right/up/down - the viewport will pan across the image

## Project Structure

```
pano/
├── src/                    # Source code
│   ├── camera/            # Camera management
│   ├── mediapipe/         # MediaPipe integration
│   ├── tracking/          # Tracking logic
│   ├── viewport/          # Viewport management
│   ├── renderer/          # Image rendering
│   ├── ui/                # UI components
│   └── utils/             # Utilities
├── assets/                # Resources
│   └── images/           # Background images
├── styles/                # Styles
└── index.html            # Main page
```

## Development

### Code Style
- ESLint with Airbnb configuration
- 2 spaces for indentation
- JSDoc comments for all functions
- See [RULES.md](RULES.md) for details

### Versioning
The project uses SemVer. Version and build are displayed in the application's status bar.

## Documentation

- [PROJECT.md](PROJECT.md) - detailed project description and architecture
- [REQUIREMENTS.md](REQUIREMENTS.md) - functional and non-functional requirements
- [RULES.md](RULES.md) - development rules and code style

## Known Limitations

- Works only in browsers with WebRTC support
- Requires good lighting for stable tracking
- Accuracy depends on camera quality
- Does not work when no face is detected in frame
- HTTPS required for production (for camera access)

## Future Plans

- [ ] Three.js integration for particle system (snowflakes)
- [ ] User background image upload
- [ ] Sensitivity parameter configuration
- [ ] Calibration for different screen sizes
- [ ] Debug mode with performance metrics
- [ ] Support for 2-3 simultaneously connected monitors - will require initial setup of their sizes and relative positions

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Authors

Alexander Zibin

---

# panoTest

Веб-приложение для интерактивного управления изображением на экране с помощью отслеживания положения головы через веб-камеру.

## Описание

panoTest - это прототип инновационного интерфейса, который позволяет управлять панорамированием и масштабированием изображения на экране без использования мыши и клавиатуры. Вместо этого используется отслеживание положения головы пользователя относительно веб-камеры через MediaPipe.

### Как это работает

1. **Отслеживание головы**: MediaPipe Face Landmarker отслеживает положение головы пользователя в реальном времени (translation X/Y/Z относительно камеры)

2. **Масштабирование**: При приближении головы к экрану увеличивается процент отображаемой области фонового изображения. Преобразование основано на расчёте углового размера экрана по формуле: α = 2 × arctan(W / (2 × L))

3. **Панорамирование**: При движении головы влево/вправо/вверх/вниз происходит сдвиг "окна" просмотра по фоновому изображению, создавая эффект виртуального окна

## Технологии

- **JavaScript (ES6+)** - основной язык разработки
- **MediaPipe** - компьютерное зрение для отслеживания головы
- **Canvas API** - рендеринг изображения
- **WebRTC API** - доступ к веб-камере
- **Three.js** - планируется для системы частиц (будущее)

## Требования

- Современный браузер с поддержкой WebRTC (Chrome 90+, Firefox 88+, Edge 90+)
- Веб-камера
- Хорошее освещение для стабильного отслеживания лица
- Достаточно мощное устройство для обработки видео в реальном времени (~30 FPS)

## Установка и запуск

### Предварительные требования
- Node.js и npm (или yarn)
- Локальный веб-сервер (для работы с камерой требуется HTTP/HTTPS)

### Шаги установки

1. Клонируйте репозиторий:
```bash
git clone <repository-url>
cd pano
```

2. Установите зависимости:
```bash
npm install
```

3. Запустите локальный сервер:
```bash
npm start
```

4. Откройте браузер и перейдите по адресу:
```
http://localhost:3002
```

5. Разрешите доступ к веб-камере при запросе браузера

## Использование

1. При первом запуске приложение запросит доступ к вашей веб-камере - разрешите доступ
2. Убедитесь, что ваше лицо хорошо видно в камере и достаточно освещено
3. Нажмите кнопку "Старт" для начала отслеживания
4. Медленно приближайтесь и удаляйтесь от экрана - изображение будет масштабироваться
5. Двигайте головой влево/вправо/вверх/вниз - viewport будет панорамироваться по изображению

## Структура проекта

```
pano/
├── src/                    # Исходный код
│   ├── camera/            # Управление камерой
│   ├── mediapipe/         # Интеграция MediaPipe
│   ├── tracking/          # Логика отслеживания
│   ├── viewport/          # Управление viewport
│   ├── renderer/          # Рендеринг изображения
│   ├── ui/                # UI компоненты
│   └── utils/             # Утилиты
├── assets/                # Ресурсы
│   └── images/           # Фоновые изображения
├── styles/                # Стили
└── index.html            # Главная страница
```

## Разработка

### Стиль кода
- ESLint с конфигурацией Airbnb
- 2 пробела для отступов
- JSDoc комментарии для всех функций
- См. [RULES.md](RULES.md) для подробностей

### Версионирование
Проект использует SemVer. Версия и билд отображаются в статус-баре приложения.

## Документация

- [PROJECT.md](PROJECT.md) - подробное описание проекта и архитектуры
- [REQUIREMENTS.md](REQUIREMENTS.md) - функциональные и нефункциональные требования
- [RULES.md](RULES.md) - правила разработки и стиль кода

## Известные ограничения

- Работает только в браузерах с поддержкой WebRTC
- Требуется хорошее освещение для стабильного отслеживания
- Точность зависит от качества камеры
- Не работает при отсутствии лица в кадре
- Для production требуется HTTPS (для доступа к камере)

## Планы на будущее

- [ ] Интеграция Three.js для системы частиц (снежинки)
- [ ] Загрузка пользовательских фоновых изображений
- [ ] Настройка параметров чувствительности
- [ ] Калибровка под разные размеры экранов
- [ ] Режим отладки с метриками производительности
- [ ] Поддержка 2-3 одновременно подключённых мониторов - потребуется первоначальная настройка их размеров и взаимного расположения

## Лицензия

MIT License - см. [LICENSE](LICENSE) файл для деталей.

## Авторы

Александр Зибин
