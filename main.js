const { app, BrowserWindow, BrowserView, Menu, ipcMain, clipboard } = require('electron');
const path = require('path');

// Remove the native File / Edit / View / Window menu entirely.
// The custom title bar (tabs + search bar) replaces it.
Menu.setApplicationMenu(null);

const CHROME_HEIGHT = 84; // px reserved at the top for tab row + address row

let mainWindow;
let tabs = [];       // { id, view, title, url }
let activeTabId = null;
let tabCounter = 0;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 480,
    minHeight: 360,
    frame: false, // <-- this is the "no native frame" piece: we draw our own
    backgroundColor: '#1b1d22',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('resize', resizeActiveView);
  mainWindow.on('maximize', () => mainWindow.webContents.send('window-state', { maximized: true }));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-state', { maximized: false }));

  mainWindow.webContents.on('did-finish-load', () => {
    createTab('https://www.google.com');
  });
}

function resizeActiveView() {
  const tab = tabs.find(t => t.id === activeTabId);
  if (!tab || !mainWindow) return;
  const { width, height } = mainWindow.getContentBounds();
  tab.view.setBounds({
    x: 0,
    y: CHROME_HEIGHT,
    width,
    height: Math.max(0, height - CHROME_HEIGHT)
  });
}

// Right-click menu for the *page content* inside a tab's BrowserView.
// This is intentionally never attached to mainWindow.webContents, so
// right-clicking the tab strip / address bar keeps doing nothing.
function attachContextMenu(view) {
  view.webContents.on('context-menu', (_event, params) => {
    const template = [];

    if (params.linkURL) {
      template.push({
        label: 'Open Link in New Tab',
        click: () => createTab(params.linkURL)
      });
      template.push({
        label: 'Copy Link Address',
        click: () => clipboard.writeText(params.linkURL)
      });
      template.push({ type: 'separator' });
    }

    if (params.mediaType === 'image') {
      template.push({
        label: 'Copy Image',
        click: () => view.webContents.copyImageAt(params.x, params.y)
      });
      template.push({ type: 'separator' });
    }

    if (params.selectionText) {
      template.push({ label: 'Copy', role: 'copy' });
      template.push({ type: 'separator' });
    }

    if (params.isEditable) {
      template.push({ label: 'Cut', role: 'cut' });
      template.push({ label: 'Paste', role: 'paste' });
      template.push({ type: 'separator' });
    }

    template.push({ label: 'Reload', click: () => view.webContents.reload() });
    template.push({ type: 'separator' });
    template.push({
      label: 'Inspect Element',
      click: () => {
        if (!view.webContents.isDevToolsOpened()) {
          // 'detach' pops DevTools into its own window, which reads much
          // better here than docking inside the BrowserView's small bounds.
          view.webContents.openDevTools({ mode: 'detach' });
        }
        view.webContents.inspectElement(params.x, params.y);
      }
    });

    Menu.buildFromTemplate(template).popup({ window: mainWindow });
  });
}

function createTab(url) {
  const id = ++tabCounter;
  const view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const tab = { id, view, title: 'New Tab', url };
  tabs.push(tab);

  view.webContents.on('page-title-updated', (_e, title) => {
    tab.title = title;
    broadcastTabs();
  });
  view.webContents.on('did-navigate', (_e, navUrl) => {
    tab.url = navUrl;
    broadcastTabs();
  });
  view.webContents.on('did-navigate-in-page', (_e, navUrl) => {
    tab.url = navUrl;
    broadcastTabs();
  });
  view.webContents.on('page-favicon-updated', (_e, favicons) => {
    tab.favicon = favicons[0] || null;
    broadcastTabs();
  });

  attachContextMenu(view);

  view.webContents.loadURL(url);
  switchTab(id);
  return id;
}

function switchTab(id) {
  const tab = tabs.find(t => t.id === id);
  if (!tab) return;
  activeTabId = id;
  mainWindow.setBrowserView(tab.view);
  resizeActiveView();
  broadcastTabs();
}

function closeTab(id) {
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;

  const [closed] = tabs.splice(idx, 1);
  mainWindow.removeBrowserView(closed.view);
  closed.view.webContents.close();

  if (activeTabId === id) {
    if (tabs.length > 0) {
      const next = tabs[idx] || tabs[idx - 1];
      switchTab(next.id);
    } else {
      activeTabId = null;
      createTab('https://www.google.com');
      return;
    }
  }
  broadcastTabs();
}

function getActiveTab() {
  return tabs.find(t => t.id === activeTabId);
}

function broadcastTabs() {
  if (!mainWindow) return;
  mainWindow.webContents.send('tabs-updated', {
    tabs: tabs.map(t => ({ id: t.id, title: t.title, url: t.url, favicon: t.favicon || null })),
    activeTabId
  });
}

// Turn address-bar input into either a URL or a search query.
function resolveInput(raw) {
  const input = raw.trim();
  const looksLikeUrl =
    /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input) ||        // has a scheme already
    /^[\w-]+(\.[\w-]+)+(:\d+)?([/?#].*)?$/.test(input);    // looks like a domain

  if (!looksLikeUrl) {
    return 'https://www.google.com/search?q=' + encodeURIComponent(input);
  }
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(input) ? input : 'https://' + input;
}

function navigate(input) {
  const tab = getActiveTab();
  if (!tab) return;
  tab.view.webContents.loadURL(resolveInput(input));
}

// ---- IPC: chrome UI -> main process ----
ipcMain.on('new-tab', () => createTab('https://www.google.com'));
ipcMain.on('switch-tab', (_e, id) => switchTab(id));
ipcMain.on('close-tab', (_e, id) => closeTab(id));
ipcMain.on('navigate', (_e, input) => navigate(input));
ipcMain.on('go-back', () => getActiveTab()?.view.webContents.goBack());
ipcMain.on('go-forward', () => getActiveTab()?.view.webContents.goForward());
ipcMain.on('reload', () => getActiveTab()?.view.webContents.reload());

ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize-toggle', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow.close());

ipcMain.handle('get-tabs', () => ({
  tabs: tabs.map(t => ({ id: t.id, title: t.title, url: t.url, favicon: t.favicon || null })),
  activeTabId
}));
ipcMain.handle('get-active-url', () => getActiveTab()?.url || '');

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});
