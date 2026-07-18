const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const { autoUpdater } = require('electron-updater');

let mainWindow;

function sendStatus(data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', data);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#08090b', // evita flash branco no load
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));

  // qualquer link com target="_blank" (ex: o botão do Discord) abre
  // no navegador padrão do sistema em vez de tentar abrir dentro do app
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // se algum link tentar navegar a própria janela pra fora do app, redireciona também
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

/* =========================================================
   Auto-update (electron-updater + GitHub Releases)
========================================================= */
autoUpdater.autoDownload = true;          // baixa sozinho assim que encontra uma versão nova
autoUpdater.autoInstallOnAppQuit = false; // só instala quando o usuário clicar em "reiniciar"

autoUpdater.on('checking-for-update', () => {
  sendStatus({ state: 'checking', message: 'Verificando atualizações...' });
});

autoUpdater.on('update-available', (info) => {
  sendStatus({ state: 'available', message: `Nova versão ${info.version} encontrada. Baixando...` });
});

autoUpdater.on('update-not-available', () => {
  sendStatus({ state: 'latest', message: 'Você já está na versão mais recente.' });
});

autoUpdater.on('download-progress', (progress) => {
  sendStatus({
    state: 'downloading',
    message: `Baixando atualização... ${Math.round(progress.percent)}%`,
    percent: progress.percent
  });
});

autoUpdater.on('update-downloaded', (info) => {
  sendStatus({ state: 'downloaded', message: `Versão ${info.version} pronta. Clique para reiniciar.` });
});

autoUpdater.on('error', (err) => {
  sendStatus({ state: 'error', message: 'Erro ao verificar atualização: ' + (err && err.message ? err.message : err) });
});

ipcMain.on('check-for-updates', () => {
  if (!app.isPackaged) {
    // auto-update não funciona rodando via "npm start" (sem build), só no app empacotado
    sendStatus({ state: 'dev', message: 'Auto-update só funciona no app instalado (dist), não no modo dev.' });
    return;
  }
  autoUpdater.checkForUpdates().catch((err) => {
    sendStatus({ state: 'error', message: 'Erro ao verificar atualização: ' + err.message });
  });
});

ipcMain.on('restart-app', () => {
  autoUpdater.quitAndInstall();
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});