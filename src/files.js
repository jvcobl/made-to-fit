// Offering a small file to the player (the save file). Inside a claude.ai artifact the host's downloads capability
// asks the viewer first and saves only if they accept; on an ordinary page a download link does it; anywhere else
// (a frame that offers nothing) the caller shows the text to copy instead. Nothing is ever sent anywhere.
// Returns 'saved', 'declined' or 'unavailable'.
const wait = (ms, v) => new Promise((r) => setTimeout(() => r(v), ms));
const framed = () => { try { return window.self !== window.top; } catch (e) { return true; } };

export async function offerFile(filename, text) {
  const cl = typeof window !== 'undefined' ? window.claude : null;
  if (cl && typeof cl.use === 'function') {
    // use() resolves null when this view cannot save; a host that never answers takes 10 s, so stop waiting at 4
    let dl = null;
    try { dl = await Promise.race([Promise.resolve(cl.use('downloads')).catch(() => null), wait(4000, null)]); } catch (e) { dl = null; }
    if (dl && typeof dl.save === 'function') {
      const once = async () => { try { await dl.save({ filename, data: text }); return 'saved'; } catch (err) { return (err && err.code) || 'unavailable'; } };
      let r = await once();
      if (r === 'rate_limited') { await wait(1500); r = await once(); } // a prompt was already open: wait, then once more
      return r === 'saved' || r === 'declined' ? r : 'unavailable';
    }
  }
  // inside a frame (a host page) a direct download can be blocked without a word, so show the text to copy instead
  if (framed()) return 'unavailable';
  try {
    if (typeof URL === 'undefined' || !URL.createObjectURL || !('download' in document.createElement('a'))) return 'unavailable';
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return 'saved';
  } catch (e) { return 'unavailable'; }
}

// read a file the player picked (a save file is a few kilobytes; anything over a megabyte is not one of ours)
export function readPicked(file) {
  return new Promise((resolve) => {
    if (!file || file.size > 1000000) { resolve(null); return; }
    const fr = new FileReader();
    fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : null);
    fr.onerror = () => resolve(null);
    try { fr.readAsText(file); } catch (e) { resolve(null); }
  });
}
