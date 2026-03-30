const PRESETS_URL = 'https://raw.githubusercontent.com/russelgal/bo-calendar-compact/main/presets.json'

// Подключиться к background чтобы он знал когда попап закроется
chrome.runtime.connect({ name: 'popup' })

function sendToTab(msg) {
  return new Promise(resolve => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab) return resolve(null)
      chrome.tabs.sendMessage(tab.id, msg, resolve)
    })
  })
}

/* Ручное скрытие кликом — пока отключено
const toggleBtn = document.getElementById('toggle')
const undoBtn = document.getElementById('undo')
const restoreBtn = document.getElementById('restore')
const countEl = document.getElementById('count')
const dot = document.getElementById('dot')

function updateUI(active, count) {
  toggleBtn.textContent = active ? 'Выключить' : 'Включить'
  toggleBtn.className = active ? 'active' : 'primary'
  dot.className = 'dot' + (active ? ' on' : '')
  countEl.textContent = count ?? 0
}

sendToTab({ type: 'get-state' }).then(res => {
  if (res) updateUI(res.active, res.count)
})

toggleBtn.addEventListener('click', async () => {
  const res = await sendToTab({ type: 'toggle' })
  if (res) {
    const state = await sendToTab({ type: 'get-state' })
    updateUI(res.active, state?.count)
  }
})

undoBtn.addEventListener('click', async () => {
  await sendToTab({ type: 'restore-last' })
  const state = await sendToTab({ type: 'get-state' })
  if (state) updateUI(state.active, state.count)
})

restoreBtn.addEventListener('click', async () => {
  await sendToTab({ type: 'restore-all' })
  const state = await sendToTab({ type: 'get-state' })
  if (state) updateUI(state.active, state.count)
})

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'count') countEl.textContent = msg.count
})
*/

// Обновление пресетов с GitHub
const COMMITS_URL = 'https://api.github.com/repos/russelgal/bo-calendar-compact/commits?path=presets.json&per_page=1'
const updateBtn = document.getElementById('update')
const statusEl = document.getElementById('status')

function fmtDate(ts) {
  const d = new Date(ts)
  return d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

// Проверить дату последнего изменения presets.json на GitHub
async function checkRemoteDate() {
  try {
    const res = await fetch(COMMITS_URL, { cache: 'no-cache' })
    if (!res.ok) return
    const [commit] = await res.json()
    if (!commit) return
    const remoteDate = commit.commit.committer.date
    const remoteSha = commit.sha
    const appliedSha = localStorage.getItem('presets-sha')

    statusEl.textContent = 'Правила от ' + fmtDate(remoteDate)

    if (appliedSha === remoteSha) {
      updateBtn.disabled = true
      updateBtn.textContent = 'Актуально'
      statusEl.className = 'status ok'
    } else {
      updateBtn.disabled = false
      updateBtn.textContent = 'Обновить правила'
      statusEl.className = 'status new'
    }
  } catch (_) {}
}

checkRemoteDate()

async function updatePresets() {
  updateBtn.disabled = true
  updateBtn.textContent = 'Загрузка…'
  statusEl.className = 'status'
  try {
    const [presetsRes, commitsRes] = await Promise.all([
      fetch(PRESETS_URL, { cache: 'no-cache' }),
      fetch(COMMITS_URL, { cache: 'no-cache' }),
    ])
    if (!presetsRes.ok) throw new Error(presetsRes.status)
    const presets = await presetsRes.json()
    await sendToTab({ type: 'update-presets', presets })

    let sha = null
    if (commitsRes.ok) {
      const [commit] = await commitsRes.json()
      if (commit) sha = commit.sha
    }
    if (sha) localStorage.setItem('presets-sha', sha)

    updateBtn.disabled = true
    updateBtn.textContent = 'Актуально'
    statusEl.textContent = 'Обновлено: ' + fmtDate(Date.now())
    statusEl.className = 'status ok'
    renderPresets(presets)
  } catch (e) {
    statusEl.textContent = 'Ошибка: ' + e.message
    statusEl.className = 'status err'
    updateBtn.disabled = false
    updateBtn.textContent = 'Обновить правила'
  }
}

updateBtn.addEventListener('click', updatePresets)

// Пресеты
const presetsEl = document.getElementById('presets')

function renderPresets(presetsObj) {
  presetsEl.innerHTML = ''
  const entries = Object.entries(presetsObj)
  if (!entries.length) {
    presetsEl.style.display = 'none'
    return
  }
  presetsEl.style.display = ''
  sendToTab({ type: 'get-presets' }).then(res => {
    const activeIds = new Set((res?.presets || []).filter(p => p.on).map(p => p.id))
    for (const [id, p] of entries) {
      const isOn = activeIds.has(id)
      const btn = document.createElement('button')
      btn.className = 'preset' + (isOn ? ' on' : '')
      btn.textContent = isOn ? p.name + ' ✕' : p.name
      btn.addEventListener('click', async () => {
        const r = await sendToTab({ type: 'toggle-preset', id })
        if (r) {
          btn.className = 'preset' + (r.on ? ' on' : '')
          btn.textContent = r.on ? p.name + ' ✕' : p.name
        }
      })
      presetsEl.appendChild(btn)
    }
  })
}

sendToTab({ type: 'get-presets' }).then(res => {
  if (!res || !res.presets.length) {
    presetsEl.style.display = 'none'
    return
  }
  const presetsObj = {}
  for (const p of res.presets) presetsObj[p.id] = p
  renderPresets(presetsObj)
})
