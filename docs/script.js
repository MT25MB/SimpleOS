// Static site behaviour: text scaling and the home-screen preview.
// No dependencies, no network calls, no tracking.

(function () {
  'use strict'

  var STORAGE_KEY = 'simpleos.fontScale'
  var ALLOWED = [1, 1.15, 1.35]
  var status = document.getElementById('preview-status')
  var tiles = Array.prototype.slice.call(
    document.querySelectorAll('.preview__tiles button')
  )

  // --- Text size -----------------------------------------------------------
  function applyScale(value) {
    var scale = ALLOWED.indexOf(value) === -1 ? 1 : value
    document.documentElement.style.setProperty('--font-scale', String(scale))
    try {
      window.localStorage.setItem(STORAGE_KEY, String(scale))
    } catch (error) {
      // Private browsing can block storage. The change still applies.
    }
  }

  var stored = null
  try {
    stored = Number(window.localStorage.getItem(STORAGE_KEY))
  } catch (error) {
    stored = null
  }
  if (ALLOWED.indexOf(stored) !== -1) {
    applyScale(stored)
    var savedRadio = document.querySelector(
      'input[name="text-size"][value="' + stored + '"]'
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

  // --- Home screen preview -------------------------------------------------
  var explanations = {
    'Video Call Family':
      'On the computer, this opens a video call with family in Firefox.',
    'Web & Email': 'On the computer, this opens Firefox for websites and email.',
    'Photo Album': 'On the computer, this opens your photos in Loupe.',
    'Daily Reminders': 'On the computer, this opens your list for today.',
    'Ask for Help':
      'On the computer, this opens RustDesk so someone you trust can help.',
    'Caregiver Settings':
      'On the computer, this asks for the caregiver PIN first.'
  }

  tiles.forEach(function (tile) {
    tile.addEventListener('click', function () {
      var name = tile.getAttribute('data-tile')
      tiles.forEach(function (other) {
        other.setAttribute('aria-pressed', String(other === tile))
      })
      if (status) status.textContent = explanations[name] || ''
    })
  })
})()
