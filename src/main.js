// Do not use import to avoid the issue
//import { app, BrowserWindow } from 'electron';
//import path from 'node:path';
//import started from 'electron-squirrel-startup';
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const started = require('electron-squirrel-startup');

const windowStateKeeper = require('electron-window-state');
let mainWindow;

const Store = require('electron-store');
store = new Store({
  defaults: {
    test: 'testres'
  }
});

// To avoid screen off
const { powerSaveBlocker } = require('electron');
const id = powerSaveBlocker.start('prevent-display-sleep');
// powerSaveBlocker.stop(id);  /// It's better to use this method to disable 'prevent-display-sleep'


// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

function handleSetTitle(event, title) {
  const webContents = event.sender;
  const win = BrowserWindow.fromWebContents(webContents);
  if(title) {
    win.setTitle(title + ' - Choppy ' + app.getVersion());
  } else {
    win.setTitle('Choppy ' + app.getVersion());
  }
}

const createWindow = () => {
  // Create the browser window.
  let mainWindowState =windowStateKeeper({
    defaultWidth: 580,
    defaultHeight: 80
  });

//  const mainWindow = new BrowserWindow({
  mainWindow = new BrowserWindow({
    'x': mainWindowState.x,
    'y': mainWindowState.y,
    'width': mainWindowState.width,
//    'height': mainWindowState.height,
    'height': 80,
    minWidth: 580,
    maxWidth: 1920,
    minHeight: 80,
    maxHeight: 640+20,
    webPreferences: {
      nodeIntegration: true, // Node.jsの統合を有効化
      contextIsolation: false, // コンテキスト分離を無効化
//      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    title: "Choppy " + app.getVersion()
  });


  // Let us register listeners on the window, so we can update the state
  // automatically (the listeners will be removed when the window is closed)
  // and restore the maximized or full screen state
  mainWindowState.manage(mainWindow);

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('Another instance is already running.');
  app.quit();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  ipcMain.on('set-title', handleSetTitle);  
  createWindow();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    // Load the previous state with fallback to defaults
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.


/*
ipc.on('get-app-version', function(event) {
  event.sender.send('got-app-version', app.getVersion())
})

ipc.on('set-name', function(event) {
  mainWindow.title =  "Choppy app " + app.getVersion()

  event.sender.send('got-app-version', app.getVersion())
})
*/

ipcMain.on("set-store-data", function(event, key, data) {
  store.set(key, data);
})

ipcMain.on("get-store-data", function(event, key) {
  event.returnValue = store.get(key);
})

