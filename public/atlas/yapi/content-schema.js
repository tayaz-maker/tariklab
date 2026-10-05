// Pure, offline validation. This v1 schema permits only explicitly unreviewed drafts.
export const LOCALES = Object.freeze(['tr', 'en', 'pl']);
export const STRUCTURE_IDS = Object.freeze(['skull', 'spine', 'thoracic-cage', 'shoulder-girdle', 'pelvis', 'upper-limbs', 'lower-limbs', 'brain', 'heart', 'lungs', 'liver', 'stomach', 'kidneys']);
export const REQUIRED_NOTICES = Object.freeze(['education', 'draft', 'scope', 'accuracy', 'variation', 'unknownSourceDate', 'polishReview']);
const REQUIRED_TR = {
  education: 'Eğitim amaçlıdır; kişisel tıbbi tavsiye, tanı veya tedavi aracı değildir.',
  scope: 'Tam anatomi sistemleri daha sonra ayrı içerik dalgalarında eklenecek.',
  accuracy: 'Anatomik doğruluk için kaynak ve uzman inceleme kaydı olmadan tam/klinik kesin iddiası koymayacağız.',
};
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const isoDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;

export function validateFoundation(content) {
  const errors = [];
  const fail = (path, why) => errors.push(`${path}: ${why}`);
  const localized = (value, path, list = false) => {
    for (const locale of LOCALES) {
      if (list ? !Array.isArray(value?.[locale]) || value[locale].length === 0 || !value[locale].every(text) : !text(value?.[locale])) fail(`${path}.${locale}`, 'required');
    }
  };
  const draft = (entry, path) => {
    if (entry?.review?.status !== 'NOT_REVIEWED' || entry?.releaseEligible !== false) fail(path, 'v1 must remain NOT_REVIEWED / releaseEligible=false');
    for (const key of ['reviewer', 'reviewedAt', 'contentHash', 'geometryHash']) if (entry?.review?.[key] !== null) fail(`${path}.review.${key}`, 'unreviewed draft requires null');
  };
  if (!plain(content)) return { valid: false, errors: ['foundation: object required'] };
  if (content.version !== 1 || content.publicationMode !== 'DRAFT_LEARNING_PREVIEW') fail('foundation', 'v1 draft learning preview required');
  draft(content, 'foundation');
  localized(content.title, 'title');
  localized(content.subtitle, 'subtitle');
  for (const notice of REQUIRED_NOTICES) localized(content.notices?.[notice], `notices.${notice}`);
  for (const [notice, exact] of Object.entries(REQUIRED_TR)) if (content.notices?.[notice]?.tr !== exact) fail(`notices.${notice}.tr`, 'required publication notice altered');
  const sources = Array.isArray(content.sources) ? content.sources : [];
  if (!sources.length) fail('sources', 'nonempty source registry required');
  const sourceIds = new Set();
  for (const item of sources) {
    const path = `sources.${item?.id ?? '?'}`;
    if (!text(item?.id) || sourceIds.has(item.id)) fail(path, 'unique source ID required');
    sourceIds.add(item?.id);
    if (!text(item?.title) || !text(item?.owner)) fail(path, 'title and owner required');
    localized(item?.claim, `${path}.claim`);
    try {
      const url = new URL(item.url);
      if (url.protocol !== 'https:' || !['training.seer.cancer.gov', 'www.nhlbi.nih.gov', 'www.niddk.nih.gov'].includes(url.hostname)) fail(`${path}.url`, 'approved primary factual source required');
    } catch { fail(`${path}.url`, 'valid URL required'); }
    if (!isoDay(item?.accessedAt)) fail(`${path}.accessedAt`, 'real calendar date required');
    if (item?.sourceDate === null) {
      if (item.datePrecision !== null || item.dateKind !== null) fail(`${path}.sourceDate`, 'unknown date must retain null precision and kind');
    } else {
      const knownDate = item?.datePrecision === 'day' ? isoDay(item.sourceDate) : item?.datePrecision === 'month' && /^\d{4}-(0[1-9]|1[0-2])$/.test(item.sourceDate);
      if (!knownDate || !['updated', 'reviewed'].includes(item?.dateKind)) fail(`${path}.sourceDate`, 'date and recorded precision/kind required');
      if (knownDate && isoDay(item?.accessedAt) && item.sourceDate > item.accessedAt) fail(`${path}.sourceDate`, 'cannot postdate access');
    }
  }
  const refs = (values, path, allowed = sourceIds) => {
    if (!Array.isArray(values) || !values.length || !values.every(id => typeof id === 'string' && allowed.has(id))) fail(path, 'known nonempty source references required');
  };
  const systems = Array.isArray(content.systems) ? content.systems : [];
  if (systems.map(s => s?.id).sort().join('|') !== 'organs|skeleton|surface') fail('systems', 'surface, skeleton and organs required exactly once');
  for (const system of systems) {
    const path = `systems.${system?.id ?? '?'}`;
    draft(system, path);
    refs(system?.sourceRefs, `${path}.sourceRefs`);
    localized(system?.uncertainty, `${path}.uncertainty`);
    for (const field of ['label', 'description']) {
      localized(system?.[field], `${path}.${field}`);
      refs(system?.fieldSources?.[field], `${path}.fieldSources.${field}`, new Set(Array.isArray(system?.sourceRefs) ? system.sourceRefs : []));
    }
  }
  const structures = Array.isArray(content.structures) ? content.structures : [];
  if (structures.map(s => s?.id).sort().join('|') !== [...STRUCTURE_IDS].sort().join('|')) fail('structures', '13 stable foundation IDs required exactly once');
  for (const item of structures) {
    const path = `structures.${item?.id ?? '?'}`;
    draft(item, path);
    refs(item?.sourceRefs, `${path}.sourceRefs`);
    localized(item?.uncertainty, `${path}.uncertainty`);
    for (const field of ['label', 'description', 'function', 'location', 'searchTerms']) localized(item?.[field], `${path}.${field}`, field === 'searchTerms');
    if (!Array.isArray(item?.systems) || item.systems.length !== 1 || item.systems[0] !== (STRUCTURE_IDS.indexOf(item.id) < 7 ? 'skeleton' : 'organs')) fail(`${path}.systems`, 'foundation layer does not match structure');
    for (const field of ['label', 'description', 'function', 'location', 'systems', 'searchTerms']) refs(item?.fieldSources?.[field], `${path}.fieldSources.${field}`, new Set(Array.isArray(item?.sourceRefs) ? item.sourceRefs : []));
  }
  if (!Array.isArray(content.later) || !content.later.length) fail('later', 'future system plan required');
  else for (const item of content.later) {
    if (!text(item?.id) || item.status !== 'LATER') fail('later', 'only explicitly deferred systems allowed');
    localized(item?.label, `later.${item?.id ?? '?'}.label`);
  }
  return { valid: errors.length === 0, errors };
}
