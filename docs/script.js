// Static site behaviour. No dependencies, no network calls, no tracking.
// Everything here is progressive enhancement: the page reads fine without JS.

(function () {
  'use strict'

  var FONT_KEY = 'simpleos.fontScale'
  var THEME_KEY = 'simpleos.theme'
  var ALLOWED = [1, 1.15, 1.35]

  var status = document.getElementById('preview-status')
  var copyStatus = document.getElementById('copy-status')

  function announce(message) {
    if (status) status.textContent = message
  }

  function announceCopy(message) {
    if (copyStatus) copyStatus.textContent = message
  }

  // --- Text size -----------------------------------------------------------
  function applyScale(value) {
    var scale = ALLOWED.indexOf(value) === -1 ? 1 : value
    document.documentElement.style.setProperty('--font-scale', String(scale))
    try {
      window.localStorage.setItem(FONT_KEY, String(scale))
    } catch (error) {
      // Private browsing can block storage. The change still applies.
    }
  }

  var storedScale = null
  try {
    storedScale = Number(window.localStorage.getItem(FONT_KEY))
  } catch (error) {
    storedScale = null
  }
  if (ALLOWED.indexOf(storedScale) !== -1) {
    applyScale(storedScale)
    var savedRadio = document.querySelector(
      'input[name="text-size"][value="' + storedScale + '"]'
    )
    if (savedRadio) savedRadio.checked = true
  }

  var radios = Array.prototype.slice.call(
    document.querySelectorAll('input[name="text-size"]')
  )
  radios.forEach(function (radio) {
    radio.addEventListener('change', function () {
      applyScale(Number(radio.value))
    })
  })

  // --- Dark mode -----------------------------------------------------------
  var themeToggle = document.getElementById('theme-toggle')
  var prefersDark =
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  var storedTheme = null
  try {
    storedTheme = window.localStorage.getItem(THEME_KEY)
  } catch (error) {
    storedTheme = null
  }
  var dark = storedTheme === 'dark' || (storedTheme === null && prefersDark)

  function applyTheme(isDark) {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    if (!themeToggle) return
    themeToggle.setAttribute('aria-pressed', String(isDark))
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode')
    var label = themeToggle.querySelector('.theme-toggle__label')
    if (label) label.textContent = isDark ? 'Light' : 'Dark'
  }

  applyTheme(dark)

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      dark = !dark
      applyTheme(dark)
      try {
        window.localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light')
      } catch (error) {
        // Storage is optional.
      }
      announceCopy(dark ? 'Dark mode on.' : 'Light mode on.')
    })
  }

  // --- Interactive home screen preview -------------------------------------
  var homeView = document.querySelector('[data-view="home"]')
  var detailView = document.querySelector('[data-view="detail"]')
  var detailPanels = Array.prototype.slice.call(document.querySelectorAll('[data-detail]'))
  var tiles = Array.prototype.slice.call(document.querySelectorAll('.kiosk__tiles button'))

  var detailFor = {
    'Video Call Family': 'video',
    'Web & Email': 'web',
    'Photo Album': 'photos',
    'Daily Reminders': 'reminders',
    'Ask for Help': 'help',
    'Caregiver Settings': 'caregiver'
  }

  var explanations = {
    video: 'Anna, Daughter, with one Call now button. A private video room opens.',
    web: 'An HTTPS page with no pop-ups and no permission requests.',
    photos: 'Pictures saved to Downloads appear here. Choose one to open it.',
    reminders: 'Today: morning tablet at 09:00, call Anna at 16:30, plants at 18:00.',
    help: 'RustDesk opens so someone you trust can see the screen and help.',
    caregiver: 'A PIN gate first. Inside: text size, Wi-Fi and backups.'
  }

  function showDetail(key) {
    var panel = detailPanels.filter(function (item) {
      return item.getAttribute('data-detail') === key
    })[0]
    if (!panel) return
    detailPanels.forEach(function (item) {
      item.hidden = item !== panel
    })
    if (homeView) homeView.hidden = true
    if (detailView) detailView.hidden = false
    announce(explanations[key] || '')
  }

  function showHome() {
    detailPanels.forEach(function (item) {
      item.hidden = true
    })
    if (detailView) detailView.hidden = true
    if (homeView) homeView.hidden = false
    tiles.forEach(function (tile) {
      tile.setAttribute('aria-pressed', 'false')
    })
    announce('Back at the home screen. Six big buttons.')
  }

  tiles.forEach(function (tile) {
    tile.addEventListener('click', function () {
      tiles.forEach(function (other) {
        other.setAttribute('aria-pressed', String(other === tile))
      })
      var name = tile.getAttribute('data-tile')
      showDetail(detailFor[name])
    })
  })

  var back = document.querySelector('[data-action="back"]')
  if (back) back.addEventListener('click', showHome)

  // Small demo actions inside the detail panels.
  document.querySelectorAll('[data-demo-action]').forEach(function (button) {
    button.addEventListener('click', function () {
      var action = button.getAttribute('data-demo-action')
      if (action === 'call') announce('Opening Anna’s private video room.')
      if (action === 'help') announce('This is a preview. On the computer, RustDesk would open now.')
    })
  })

  document.querySelectorAll('.reminder-list input').forEach(function (box) {
    box.addEventListener('change', function () {
      var label = box.parentNode.querySelector('span')
      announce((label ? label.textContent : 'Reminder') + (box.checked ? ' marked done.' : ' marked not done.'))
    })
  })

  // PIN gate: any four digits unlock the preview.
  var pinDigits = []
  var pinDots = Array.prototype.slice.call(document.querySelectorAll('.pin-dots span'))
  var pinGate = document.querySelector('[data-pin-gate]')
  var pinSettings = document.querySelector('[data-pin-settings]')

  function renderPin() {
    pinDots.forEach(function (dot, index) {
      dot.classList.toggle('filled', index < pinDigits.length)
    })
  }

  document.querySelectorAll('[data-key]').forEach(function (key) {
    key.addEventListener('click', function () {
      var value = key.getAttribute('data-key')
      if (value === 'clear') {
        pinDigits = []
        renderPin()
        announce('PIN cleared.')
        return
      }
      if (value === 'unlock') {
        if (pinDigits.length !== 4) {
          announce('Enter four numbers first.')
          return
        }
        if (pinGate) pinGate.hidden = true
        if (pinSettings) pinSettings.hidden = false
        announce('Settings unlocked. Text size, Wi-Fi and backup are ready.')
        return
      }
      if (pinDigits.length < 4) {
        pinDigits.push(value)
        renderPin()
        announce(pinDigits.length + ' of 4 numbers entered.')
      }
    })
  })

  // Read Aloud and Hold to Speak.
  var readAloud = document.querySelector('[data-action="read-aloud"]')
  if (readAloud) {
    readAloud.addEventListener('click', function () {
      var on = readAloud.getAttribute('aria-pressed') !== 'true'
      readAloud.setAttribute('aria-pressed', String(on))
      announce(on ? 'Reading this screen aloud. Press again to stop.' : 'Speech stopped.')
    })
  }

  var holdToSpeak = document.querySelector('[data-action="hold-to-speak"]')
  if (holdToSpeak) {
    holdToSpeak.addEventListener('click', function () {
      announce('This preview does not use your microphone. On the computer, five short commands work offline.')
    })
  }

  document.querySelectorAll('[data-power]').forEach(function (button) {
    button.addEventListener('click', function () {
      var action = button.getAttribute('data-power')
      announce(
        action === 'restart'
          ? 'On the computer this asks you to confirm, then restarts.'
          : 'On the computer this asks you to confirm, then shuts down.'
      )
    })
  })

  // --- Quickstart tabs -----------------------------------------------------
  var tabButtons = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'))
  var panels = tabButtons.map(function (tab) {
    return document.getElementById(tab.getAttribute('aria-controls'))
  })

  function activateTab(index, moveFocus) {
    tabButtons.forEach(function (tab, i) {
      var selected = i === index
      tab.setAttribute('aria-selected', String(selected))
      tab.setAttribute('tabindex', selected ? '0' : '-1')
      if (panels[i]) panels[i].hidden = !selected
    })
    if (moveFocus && tabButtons[index]) tabButtons[index].focus()
  }

  tabButtons.forEach(function (tab, index) {
    tab.addEventListener('click', function () {
      activateTab(index, false)
    })
    tab.addEventListener('keydown', function (event) {
      var next = null
      if (event.key === 'ArrowRight') next = (index + 1) % tabButtons.length
      if (event.key === 'ArrowLeft') next = (index - 1 + tabButtons.length) % tabButtons.length
      if (event.key === 'Home') next = 0
      if (event.key === 'End') next = tabButtons.length - 1
      if (next === null) return
      event.preventDefault()
      activateTab(next, true)
    })
  })

  // --- Copy to clipboard ---------------------------------------------------
  function fallbackCopy(text) {
    var area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'absolute'
    area.style.left = '-9999px'
    document.body.appendChild(area)
    area.select()
    var copied = false
    try {
      copied = document.execCommand('copy')
    } catch (error) {
      copied = false
    }
    document.body.removeChild(area)
    return copied
  }

  document.querySelectorAll('[data-copy]').forEach(function (button) {
    button.addEventListener('click', function () {
      var block = button.closest('.codeblock')
      var code = block ? block.querySelector('code') : null
      if (!code) return
      var text = code.textContent
      var done = function (ok) {
        announceCopy(ok ? 'Copied to clipboard.' : 'Could not copy. Select the text and copy it manually.')
        button.textContent = ok ? 'Copied' : 'Try again'
        window.setTimeout(function () {
          button.textContent = 'Copy'
        }, 1800)
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { done(true) },
          function () { done(fallbackCopy(text)) }
        )
      } else {
        done(fallbackCopy(text))
      }
    })
  })
})()
