const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('baymax', {
  quit: () => ipcRenderer.send('app-quit'),
  getCursorPos: () => ipcRenderer.invoke('get-cursor-pos'),
  moveWindow: (dx, dy) => ipcRenderer.send('move-window', dx, dy),
  getWindowPos: () => ipcRenderer.invoke('get-window-pos'),
  sitOnTaskbar: () => ipcRenderer.invoke('sit-on-taskbar'),
  getWorkArea: () => ipcRenderer.invoke('get-work-area'),
  onSleep: (callback) => ipcRenderer.on('sleep', callback),
  onWakeUp: (callback) => ipcRenderer.on('wake-up', callback)
});
