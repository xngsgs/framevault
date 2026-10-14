export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export const STATUSES = ['draft', 'review', 'approved', 'archived'];
export const TYPES = ['character', 'outfit', 'background', 'prop', 'reference'];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function text(value, name, max = 120, required = false) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw new HttpError(400, `${name} must be text`);
  const result = value.trim();
  if (result.length > max || (required && !result)) throw new HttpError(400, `${name} is invalid`);
  return result;
}

export function tags(value) {
  if (!Array.isArray(value) || value.length > 30) throw new HttpError(400, 'Use at most 30 tags');
  return [...new Set(value.map(item => text(item, 'tag', 40, true)))];
}

export function metadata(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Invalid metadata');
  const status = body.status ?? 'draft';
  const type = body.type ?? 'reference';
  if (!STATUSES.includes(status) || !TYPES.includes(type)) throw new HttpError(400, 'Unknown status or asset type');
  return {
    title: text(body.title, 'title', 120, true),
    project: text(body.project, 'project', 100) || '未分类项目',
    character: text(body.character, 'character', 100),
    type, status,
    tags: tags(body.tags ?? []),
    notes: text(body.notes, 'notes', 4000)
  };
}

export function image(body) {
  const name = text(body.filename, 'filename', 200, true);
  if (typeof body.data !== 'string') throw new HttpError(400, 'An image is required');
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.data);
  if (!match) throw new HttpError(400, 'Only PNG, JPEG and WebP are supported');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new HttpError(413, 'Images must be under 10 MB');
  const mime = match[1];
  const png = bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!(mime === 'image/png' && png || mime === 'image/jpeg' && jpeg || mime === 'image/webp' && webp)) {
    throw new HttpError(400, 'The image content does not match its file type');
  }
  return { name, bytes, mime, extension: { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[mime] };
}
