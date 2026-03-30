// Левый клик по иконке — вкл/выкл первый пресет
chrome.action.onClicked.addListener(async (tab) => {
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'toggle-first' })
    if (res) {
      chrome.action.setBadgeText({ text: res.on ? 'ON' : '', tabId: tab.id })
      chrome.action.setBadgeBackgroundColor({ color: '#3498db', tabId: tab.id })
    }
  } catch (_) {}
})

// Правый клик → «Настройки» — открыть попап под иконкой
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'settings',
    title: 'Настройки',
    contexts: ['action'],
  })
})

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'settings') {
    await chrome.action.setPopup({ popup: 'popup.html' })
    await chrome.action.openPopup()
  }
})

// Когда попап закроется — сбросить, чтобы левый клик снова работал как toggle
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    port.onDisconnect.addListener(() => {
      chrome.action.setPopup({ popup: '' })
    })
  }
})
