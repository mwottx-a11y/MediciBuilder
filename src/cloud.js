// Optional cloud backup of the save when running as a claude.ai artifact with the `db` capability.
// Outside that viewer `window.claude` is absent and this quietly does nothing.
const RELOAD_FLAG = 'medici-cloud-restored';

export async function startCloud(game) {
  const use = window.claude?.use;
  if (!use) return;
  let db, user;
  try { [db, user] = await Promise.all([use('db'), use('user')]); } catch (e) { return; }
  if (!db || !user) return;
  const id = await user.id();
  if (!id) return;
  const doc = db.doc(`data/users/${id}/saves/main`);

  // restore: if the cloud copy is newer than the local one, adopt it once
  try {
    const snap = await doc.get();
    const remote = snap?.data?.() ?? snap?.data ?? null;
    let restored = false;
    try { restored = sessionStorage.getItem(RELOAD_FLAG) === '1'; } catch (e) { /* storage unavailable */ }
    if (remote?.json && remote.time > (game.s.time ?? 0) + 5000 && !restored) {
      if (game.importSave(remote.json)) {
        try { sessionStorage.setItem(RELOAD_FLAG, '1'); } catch (e) { /* storage unavailable */ }
        location.reload();
        return;
      }
    }
  } catch (e) { /* offline or not granted: keep playing locally */ }

  let lastSent = '';
  async function push() {
    game.save();
    const json = JSON.stringify(game.s);
    if (json === lastSent || json.length > 240000) return;
    try { await doc.set({ json, time: game.s.time }); lastSent = json; } catch (e) { /* retry next interval */ }
  }
  setInterval(push, 30000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) push(); });
}
