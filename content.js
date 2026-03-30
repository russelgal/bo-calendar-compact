(() => {
  let active = false
  let highlighted = null

  const MIN_SIZE = 20

  // Встроенные пресеты (fallback, если нет загруженных)
  const BUILTIN_PRESETS = {
    'broniruy-online': {
      name: 'БО Шахматка (компактный вид)',
      selectors: [
        '[class*="_categoryHeader_yn735"] > :first-child',
        '[class*="_categoryHeader_yn735"] > :nth-child(2) > :first-child',
        '[class*="_categoryRight_yn735"] > :first-child',
        '[class*="_categoryRight_yn735"] > :nth-child(2)',
      ],
    },
  }

  // Активные пресеты — загруженные или встроенные
  let PRESETS = { ...BUILTIN_PRESETS }

  // Какие пресеты сейчас активны
  const activePresets = new Set()

  function matchElements(rule) {
    if (typeof rule === 'string') return [...document.querySelectorAll(rule)]
    if (rule.xpath) {
      const res = document.evaluate(rule.xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null)
      const els = []
      for (let i = 0; i < res.snapshotLength; i++) els.push(res.snapshotItem(i))
      return els
    }
    let result = [...document.querySelectorAll(rule.css)]
    if (rule.skipIf) result = result.filter(el => !el.textContent.includes(rule.skipIf))
    if (rule.hasText) result = result.filter(el => el.textContent.includes(rule.hasText))
    return result
  }

  function togglePreset(id) {
    const preset = PRESETS[id]
    if (!preset) return false
    const wasActive = activePresets.has(id)
    if (wasActive) {
      for (const rule of preset.selectors) {
        matchElements(rule).forEach(el => el.classList.remove('bh-hidden'))
      }
      activePresets.delete(id)
    } else {
      for (const rule of preset.selectors) {
        matchElements(rule).forEach(el => el.classList.add('bh-hidden'))
      }
      activePresets.add(id)
    }
    updateCount()
    return !wasActive
  }

  function onMouseOver(e) {
    if (!active) return
    const el = e.target
    if (el === document.body || el === document.documentElement) return
    if (el.offsetWidth < MIN_SIZE || el.offsetHeight < MIN_SIZE) return
    if (highlighted && highlighted !== el) highlighted.classList.remove('bh-highlight')
    el.classList.add('bh-highlight')
    highlighted = el
  }

  function onMouseOut(e) {
    if (!active) return
    e.target.classList.remove('bh-highlight')
    if (highlighted === e.target) highlighted = null
  }

  function onClick(e) {
    if (!active) return
    e.preventDefault()
    e.stopPropagation()
    const el = e.target
    el.classList.remove('bh-highlight')
    el.classList.add('bh-hidden')
    highlighted = null
    updateCount()
  }

  function updateCount() {
    const count = document.querySelectorAll('.bh-hidden').length
    chrome.runtime.sendMessage({ type: 'count', count })
  }

  function enable() {
    active = true
    document.addEventListener('mouseover', onMouseOver, true)
    document.addEventListener('mouseout', onMouseOut, true)
    document.addEventListener('click', onClick, true)
  }

  function disable() {
    active = false
    if (highlighted) {
      highlighted.classList.remove('bh-highlight')
      highlighted = null
    }
    document.removeEventListener('mouseover', onMouseOver, true)
    document.removeEventListener('mouseout', onMouseOut, true)
    document.removeEventListener('click', onClick, true)
  }

  function restoreAll() {
    document.querySelectorAll('.bh-hidden').forEach(el => el.classList.remove('bh-hidden'))
    updateCount()
  }

  function restoreLast() {
    const hidden = document.querySelectorAll('.bh-hidden')
    if (hidden.length > 0) {
      hidden[hidden.length - 1].classList.remove('bh-hidden')
      updateCount()
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'toggle') {
      active ? disable() : enable()
      sendResponse({ active })
    } else if (msg.type === 'restore-all') {
      restoreAll()
      sendResponse({ ok: true })
    } else if (msg.type === 'restore-last') {
      restoreLast()
      sendResponse({ ok: true })
    } else if (msg.type === 'get-state') {
      const count = document.querySelectorAll('.bh-hidden').length
      sendResponse({ active, count })
    } else if (msg.type === 'toggle-first') {
      const firstId = Object.keys(PRESETS)[0]
      if (firstId) {
        const on = togglePreset(firstId)
        sendResponse({ on })
      } else {
        sendResponse({ on: false })
      }
    } else if (msg.type === 'toggle-preset') {
      const on = togglePreset(msg.id)
      sendResponse({ on })
    } else if (msg.type === 'get-presets') {
      const list = Object.entries(PRESETS).map(([id, p]) => ({
        id, name: p.name, on: activePresets.has(id), selectors: p.selectors,
      }))
      sendResponse({ presets: list })
    } else if (msg.type === 'update-presets') {
      PRESETS = msg.presets
      sendResponse({ ok: true })
    }
  })
})()
