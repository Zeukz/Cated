const { app, BrowserWindow, ipcMain, desktopCapturer, session, dialog, Notification } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

const isDevelopment = !app.isPackaged;
let selectedSourceId = null;
let mainWindow = null;
let updateCheckTimer = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 680,
    backgroundColor: '#0f1118',
    title: 'Cated',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (isDevelopment) {
    mainWindow.loadURL('http://127.0.0.1:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.on('closed', () => { mainWindow = null; });
}

function showUpdateNotification(title, body) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}

function configureAutoUpdater() {
  if (isDevelopment) return;

  // O instalador NSIS será por usuário. A instalação só ocorre quando a pessoa confirmar.
  // A pessoa escolhe quando iniciar o download; a descoberta da versão não fica silenciosa.
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.fullChangelog = true;

  autoUpdater.on('checking-for-update', () => {
    console.log('[Atualizações] Verificando novas versões...');
  });

  autoUpdater.on('update-available', async (info) => {
    showUpdateNotification('Atualização disponível', `A versão ${info.version} do Cated está disponível.`);
    const result = await dialog.showMessageBox(mainWindow || BrowserWindow.getFocusedWindow(), {
      type: 'info',
      title: 'Atualização disponível',
      message: `O Cated encontrou a versão ${info.version}.`,
      detail: 'Deseja baixar a atualização agora? Você poderá continuar usando o aplicativo durante o download.',
      buttons: ['Baixar atualização', 'Mais tarde'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });
    if (result.response === 0) {
      autoUpdater.downloadUpdate().catch((error) => {
        showUpdateNotification('Falha na atualização', 'Não foi possível iniciar o download. Tente novamente mais tarde.');
        console.warn('[Atualizações] Falha no download:', error?.message || error);
      });
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[Atualizações] Você já está na versão mais recente.');
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[Atualizações] Download: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const result = await dialog.showMessageBox(mainWindow || BrowserWindow.getFocusedWindow(), {
      type: 'info',
      title: 'Atualização pronta',
      message: `A versão ${info.version} do Cated foi baixada.`,
      detail: 'Reinicie agora para instalar a atualização. Você também pode continuar usando o aplicativo e atualizar mais tarde.',
      buttons: ['Reiniciar e atualizar', 'Mais tarde'],
      defaultId: 0,
      cancelId: 1,
      noLink: true
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });

  autoUpdater.on('error', (error) => {
    // Erros de rede ou ausência do primeiro release não impedem o uso do aplicativo.
    console.warn('[Atualizações] Não foi possível verificar atualizações:', error?.message || error);
  });

  const checkForUpdates = () => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.warn('[Atualizações] Falha na verificação:', error?.message || error);
    });
  };

  setTimeout(checkForUpdates, 3000);
  updateCheckTimer = setInterval(checkForUpdates, 30 * 60 * 1000);
}

app.whenReady().then(() => {
  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 }
    });
    const selected = sources.find((source) => source.id === selectedSourceId) || sources[0];
    callback({ video: selected });
  });

  ipcMain.handle('desktop:get-sources', async () => {
    const sources = await desktopCapturer.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 320, height: 180 }
    });
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      type: source.id.startsWith('screen:') ? 'screen' : 'window',
      thumbnail: source.thumbnail.toDataURL()
    }));
  });

  ipcMain.handle('desktop:select-source', (_event, sourceId) => {
    selectedSourceId = sourceId;
    return true;
  });

  ipcMain.handle('app:get-version', () => app.getVersion());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  createWindow();
  configureAutoUpdater();
});

app.on('before-quit', () => {
  if (updateCheckTimer) clearInterval(updateCheckTimer);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
