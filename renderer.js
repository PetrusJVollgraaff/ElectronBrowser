const tabsContainer = document.getElementById('tabs-container');
const addressBar = document.getElementById('address-bar');
const addressForm = document.getElementById('address-form');

let currentTabs = [];
let currentActiveId = null;
let userIsTypingAddress = false;

function renderTabs({ tabs, activeTabId }) {
  currentTabs = tabs;
  currentActiveId = activeTabId;

  tabsContainer.innerHTML = '';

  for (const tab of tabs) {
    const el = document.createElement('div');
    el.className = 'tab' + (tab.id === activeTabId ? ' active' : '');
    el.setAttribute('role', 'tab');
    el.setAttribute('aria-selected', tab.id === activeTabId ? 'true' : 'false');

    const favicon = document.createElement('div');
    favicon.className = 'tab-favicon';
    if (tab.favicon) favicon.style.backgroundImage = `url("${tab.favicon}")`;

    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title || 'New Tab';

    const close = document.createElement('button');
    close.className = 'tab-close';
    close.textContent = '\u2715';
    close.title = 'Close tab';
    close.addEventListener('click', (e) => {
      e.stopPropagation();
      window.browserAPI.closeTab(tab.id);
    });

    el.appendChild(favicon);
    el.appendChild(title);
    el.appendChild(close);

    el.addEventListener('click', () => window.browserAPI.switchTab(tab.id));

    tabsContainer.appendChild(el);
  }

  // Keep the address bar in sync with the active tab, unless the
  // person is actively typing a new destination.
  if (!userIsTypingAddress) {
    const active = tabs.find(t => t.id === activeTabId);
    addressBar.value = active ? active.url || '' : '';
  }
}

window.browserAPI.onTabsUpdated(renderTabs);
window.browserAPI.getTabs().then(renderTabs);

document.getElementById('new-tab-btn').addEventListener('click', () => {
  window.browserAPI.newTab();
});

document.getElementById('back-btn').addEventListener('click', () => window.browserAPI.goBack());
document.getElementById('forward-btn').addEventListener('click', () => window.browserAPI.goForward());
document.getElementById('reload-btn').addEventListener('click', () => window.browserAPI.reload());

addressBar.addEventListener('focus', () => {
  userIsTypingAddress = true;
  addressBar.select();
});
addressBar.addEventListener('blur', () => {
  userIsTypingAddress = false;
  const active = currentTabs.find(t => t.id === currentActiveId);
  addressBar.value = active ? active.url || '' : '';
});

addressForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const value = addressBar.value.trim();
  if (!value) return;
  userIsTypingAddress = false;
  addressBar.blur();
  window.browserAPI.navigate(value);
});

// ---- Window controls ----
document.getElementById('min-btn').addEventListener('click', () => window.browserAPI.minimize());
document.getElementById('max-btn').addEventListener('click', () => window.browserAPI.maximizeToggle());
document.getElementById('close-btn').addEventListener('click', () => window.browserAPI.close());

window.browserAPI.onWindowState(({ maximized }) => {
  const maxBtn = document.getElementById('max-btn');
  maxBtn.querySelector('.glyph').textContent = maximized ? '\u29C9' : '\u25A1';
  maxBtn.title = maximized ? 'Restore' : 'Maximize';
});
