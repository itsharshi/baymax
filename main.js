const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');

let win;
let tray;

function createTrayIcon() {
  const img = nativeImage.createEmpty();
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const cx = x - size / 2;
      const cy = y - size / 2;
      const inEllipse = (cx * cx) / (7 * 7) + (cy * cy) / (6 * 6) <= 1;
      const isLeftEye = Math.sqrt((x - 5) ** 2 + (y - 7) ** 2) <= 1.5;
      const isRightEye = Math.sqrt((x - 11) ** 2 + (y - 7) ** 2) <= 1.5;
      const isLine = y === 7 && x >= 5 && x <= 11;

      if (isLeftEye || isRightEye || isLine) {
        buffer[idx] = 51; buffer[idx + 1] = 51; buffer[idx + 2] = 51; buffer[idx + 3] = 255;
      } else if (inEllipse) {
        buffer[idx] = 255; buffer[idx + 1] = 255; buffer[idx + 2] = 255; buffer[idx + 3] = 255;
      } else {
        buffer[idx] = 0; buffer[idx + 1] = 0; buffer[idx + 2] = 0; buffer[idx + 3] = 0;
      }
    }
  }
  return nativeImage.createFromBuffer(buffer, { width: size, height: size });
}

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const workArea = display.workAreaSize;

  win = new BrowserWindow({
    width: 350,
    height: 550,
    x: workArea.width - 380,
    y: workArea.height - 580,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: false,
    skipTaskbar: false,
    title: 'Baymax',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('closed', () => { win = null; });

  try {
    const icon = createTrayIcon();
    tray = new Tray(icon);
    tray.setToolTip('Baymax Companion');

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show/Hide',
        click: () => {
          if (win && win.isVisible()) win.hide();
          else if (win) win.show();
        }
      },
      {
        label: 'Sleep',
        click: () => { if (win) win.webContents.send('sleep'); }
      },
      {
        label: 'Wake Up',
        click: () => { if (win) win.webContents.send('wake-up'); }
      },
      { type: 'separator' },
      {
        label: 'Exit',
        click: () => { app.quit(); }
      }
    ]);

    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (win && win.isVisible()) win.hide();
      else if (win) win.show();
    });
  } catch (e) {
    console.error('Tray creation failed:', e);
  }
}

ipcMain.on('app-quit', () => { app.quit(); });

ipcMain.handle('get-cursor-pos', () => {
  const point = screen.getCursorScreenPoint();
  if (!win) return { x: 0, y: 0 };
  const bounds = win.getBounds();
  return {
    x: point.x - bounds.x,
    y: point.y - bounds.y
  };
});

ipcMain.on('move-window', (event, deltaX, deltaY) => {
  if (!win) return;
  const [x, y] = win.getPosition();
  win.setPosition(x + deltaX, y + deltaY);
});

ipcMain.handle('get-window-pos', () => {
  if (!win) return { x: 0, y: 0 };
  const [x, y] = win.getPosition();
  return { x, y };
});

ipcMain.handle('sit-on-taskbar', () => {
  if (!win) return;
  const display = screen.getPrimaryDisplay();
  const workArea = display.workArea;
  const bounds = win.getBounds();
  const x = workArea.width + workArea.x - bounds.width - 30;
  const y = workArea.height + workArea.y - bounds.height;
  win.setPosition(x, y);
  return { x, y };
});

ipcMain.handle('get-work-area', () => {
  const display = screen.getPrimaryDisplay();
  return display.workArea;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => { app.quit(); });
