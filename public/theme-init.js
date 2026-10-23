// Pasang tema (terang/gelap) sebelum halaman tampil agar tidak berkedip.
// Dimuat sebagai berkas terpisah karena Content-Security-Policy melarang skrip inline.
;(function () {
  var pref = 'system'
  try {
    pref = localStorage.getItem('lms-theme') || 'system'
  } catch (e) {}
  var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
})()
