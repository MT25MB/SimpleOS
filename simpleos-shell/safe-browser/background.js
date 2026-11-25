/* SimpleOS Safe Browser: downloads can install unwanted software, so they are
 * blocked here. A calm notification tells the person to ask a caregiver. */
browser.downloads.onCreated.addListener(async (item) => {
  try {
    await browser.downloads.cancel(item.id)
  } catch (error) {
    // The download may already have finished; nothing else we can do.
  }
  try {
    await browser.downloads.removeFile(item.id)
  } catch (error) {
    // No file to remove, or it is outside the profile. Best effort only.
  }
  try {
    await browser.notifications.create({
      type: 'basic',
      title: 'Downloads are turned off',
      message: 'Ask a caregiver if you need to save a file.',
    })
  } catch (error) {
    // Notifications are optional; the download is still stopped.
  }
})
