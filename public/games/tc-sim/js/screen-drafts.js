// Session-only form drafts. Never persist them or restore security/revision fields.
const drafts = new Map();
export function clearScreenDrafts(view) { if (!view) drafts.clear(); else for (const key of drafts.keys()) if (key.startsWith(`${view}:`)) drafts.delete(key); }
export function bindScreenDrafts(root, view) {
  if (!root?.querySelectorAll) return;
  const forms = [...root.querySelectorAll('.workspace form')];
  const keyFor = (form, index) => `${view}:${form.id || form.getAttribute('data-bank-form') || index}:${form.querySelector('[name="action"]')?.value || ''}`;
  forms.forEach((form, index) => {
    const key = keyFor(form, index), saved = drafts.get(key);
    const fields = [...form.querySelectorAll('input:not([type="hidden"]),select,textarea')].filter(field => field.name && field.type !== 'password' && field.type !== 'file');
    fields.forEach((field, fieldIndex) => {
      const fieldKey = `${field.name}:${fieldIndex}`, previous = saved?.[fieldKey];
      if (previous) { field.value = previous.value; if (['checkbox','radio'].includes(field.type)) field.checked = previous.checked; }
    });
    const capture = () => drafts.set(key, Object.fromEntries(fields.map((field, fieldIndex) => [`${field.name}:${fieldIndex}`, {value:field.value,checked:field.checked}])));
    form.addEventListener('input', capture); form.addEventListener('change', capture);
    // Canonical submit handlers clear consumed drafts only after success.
  });
}
