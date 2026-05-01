/**
 * עורך מאגר התוכן — זמין רק כשמופעל במפורש (OMG).
 * נשמר ב־localStorage במכשיר זה בלבד.
 */

export const VAULT_EDITOR_STORAGE_KEY = 'faith_science_vault_editor_v1';
export const VAULT_EDITOR_ENABLED_KEY = 'omg_vault_editor_enabled';
export const VAULT_EDITOR_QUERY_PARAM = 'omg_vault_editor';

/** @typedef {{ hidden: string[], order: string[] | null }} VaultEditorPayload */

/** @returns {VaultEditorPayload} */
export function loadVaultEditorPayload() {
  try {
    const raw = localStorage.getItem(VAULT_EDITOR_STORAGE_KEY);
    if (!raw) return { hidden: [], order: null };
    const o = JSON.parse(raw);
    return {
      hidden: Array.isArray(o.hidden) ? o.hidden : [],
      order: Array.isArray(o.order) ? o.order : null,
    };
  } catch {
    return { hidden: [], order: null };
  }
}

/** @param {VaultEditorPayload} payload */
export function saveVaultEditorPayload(payload) {
  localStorage.setItem(VAULT_EDITOR_STORAGE_KEY, JSON.stringify(payload));
}

export function clearVaultEditorPayload() {
  localStorage.removeItem(VAULT_EDITOR_STORAGE_KEY);
}

export function isVaultEditorEnabledFromEnv() {
  return import.meta.env.VITE_OMG_VAULT_EDITOR === 'true';
}

export function readVaultEditorEnabledFlag() {
  return localStorage.getItem(VAULT_EDITOR_ENABLED_KEY) === '1';
}

export function setVaultEditorEnabledFlag(on) {
  if (on) localStorage.setItem(VAULT_EDITOR_ENABLED_KEY, '1');
  else localStorage.removeItem(VAULT_EDITOR_ENABLED_KEY);
}

/**
 * @param {readonly { id: string }[]} baseItems
 * @param {VaultEditorPayload} payload
 */
export function computeVaultItems(baseItems, payload) {
  const hidden = new Set(payload.hidden || []);
  const byId = Object.fromEntries(baseItems.map((x) => [x.id, x]));
  let ids =
    payload.order?.length ?
      payload.order.filter((id) => !hidden.has(id))
    : baseItems.map((x) => x.id).filter((id) => !hidden.has(id));
  for (const x of baseItems) {
    if (!hidden.has(x.id) && !ids.includes(x.id)) ids.push(x.id);
  }
  return ids.map((id) => byId[id]).filter(Boolean);
}

/**
 * @param {VaultEditorPayload} payload
 * @param {string} id
 * @param {readonly { id: string }[]} baseItems
 */
export function vaultEditorRemove(payload, id, baseItems) {
  const hidden = [...new Set([...(payload.hidden || []), id])];
  let order =
    payload.order?.length ?
      [...payload.order]
    : baseItems.map((x) => x.id);
  order = order.filter((x) => x !== id);
  return { hidden, order };
}

/**
 * @param {VaultEditorPayload} payload
 * @param {string} id
 * @param {-1 | 1} delta
 * @param {readonly { id: string }[]} baseItems
 */
export function vaultEditorMove(payload, id, delta, baseItems) {
  const hidden = new Set(payload.hidden || []);
  let order =
    payload.order?.length ?
      [...payload.order]
    : baseItems.map((x) => x.id);
  order = order.filter((x) => !hidden.has(x));
  const idx = order.indexOf(id);
  if (idx < 0) return payload;
  const j = idx + delta;
  if (j < 0 || j >= order.length) return payload;
  const next = [...order];
  [next[idx], next[j]] = [next[j], next[idx]];
  return { ...payload, order: next };
}
