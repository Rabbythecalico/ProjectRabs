// ====== STORAGE ======
async function sGet(key) {
  try {
    if (window.storage && typeof window.storage.get === 'function') {
      const r = await window.storage.get(key, true);
      return r ? JSON.parse(r.value) : null;
    }
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (e) { return null; }
}

async function sSet(key, val) {
  try {
    if (window.storage && typeof window.storage.set === 'function') {
      return window.storage.set(key, JSON.stringify(val), true);
    }
    localStorage.setItem(key, JSON.stringify(val));
    return true;
  } catch (e) { return null; }
}

async function sDelete(key) {
  try {
    if (window.storage && typeof window.storage.delete === 'function') {
      return await window.storage.delete(key, true);
    }
    localStorage.removeItem(key);
    return true;
  } catch (e) { return null; }
}

async function sList(prefix) {
  try {
    if (window.storage && typeof window.storage.list === 'function') {
      const r = await window.storage.list(prefix, true);
      return r ? r.keys : [];
    }
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) keys.push(k);
    }
    return keys;
  } catch (e) { return []; }
}

