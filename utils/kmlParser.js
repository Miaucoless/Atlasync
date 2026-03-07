/**
 * kmlParser.js
 * Parse KML (Google My Maps export) to extract placemarks as location objects.
 * Supports standard KML Placemark elements with name, coordinates, and description.
 */

/**
 * Parse KML XML string and extract placemarks as location objects.
 * @param {string} kmlText - Raw KML XML string
 * @returns {Array<{ name: string, lat: number, lng: number, address?: string, notes?: string }>}
 */
export function parseKML(kmlText) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlText, 'text/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error('Invalid KML: could not parse XML');
  }

  const placemarks = doc.getElementsByTagName('Placemark');
  const locations = [];

  for (let i = 0; i < placemarks.length; i++) {
    const pm = placemarks[i];
    const loc = parsePlacemark(pm);
    if (loc) locations.push(loc);
  }

  return locations;
}

/**
 * Parse a single Placemark element.
 * @param {Element} placemark
 * @returns {{ name: string, lat: number, lng: number, address?: string, notes?: string } | null}
 */
function parsePlacemark(placemark) {
  const nameEl = placemark.getElementsByTagName('name')[0];
  const name = nameEl?.textContent?.trim() || 'Unnamed place';

  // Coordinates: KML format is "lng,lat,alt" or "lng,lat" - can have multiple points for LineString/Polygon
  const coordsEl = placemark.querySelector('coordinates');
  if (!coordsEl?.textContent?.trim()) return null;

  const coordText = coordsEl.textContent.trim();
  const firstPoint = coordText.split(/\s+/)[0]; // First coordinate tuple
  const parts = firstPoint.split(',');
  const lng = parseFloat(parts[0]);
  const lat = parseFloat(parts[1]);

  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

  const descEl = placemark.getElementsByTagName('description')[0];
  const description = descEl?.textContent?.trim() || '';

  // Address often in ExtendedData or description
  let address = null;
  const addressData = placemark.querySelector('ExtendedData Data[name="address"] value');
  if (addressData?.textContent) {
    address = addressData.textContent.trim();
  } else if (description && !description.startsWith('<')) {
    address = description.length > 100 ? null : description;
  }

  return {
    name,
    lat,
    lng,
    address: address || undefined,
    notes: description && description.length > 100 ? description : undefined,
  };
}

/**
 * Parse an uploaded File (KML or KMZ).
 * KMZ is a zip containing doc.kml - we'll need to extract it.
 * @param {File} file
 * @returns {Promise<Array<{ name: string, lat: number, lng: number, address?: string, notes?: string }>>}
 */
export async function parseKMLFile(file) {
  const name = (file.name || '').toLowerCase();

  if (name.endsWith('.kmz')) {
    return parseKMZFile(file);
  }

  if (name.endsWith('.kml') || name.endsWith('.xml')) {
    const text = await file.text();
    return parseKML(text);
  }

  throw new Error('Unsupported file type. Please upload a .kml or .kmz file from Google My Maps.');
}

/**
 * Parse KMZ (zipped KML). Uses dynamic import of JSZip to avoid bundle bloat when not used.
 * @param {File} file
 */
async function parseKMZFile(file) {
  try {
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(file);
    const kmlEntry = zip.file('doc.kml') || zip.file(/\.kml$/)[0];
    if (!kmlEntry) throw new Error('KMZ file has no doc.kml inside.');
    const text = await kmlEntry.async('text');
    return parseKML(text);
  } catch (e) {
    if (e.message?.includes('doc.kml')) throw e;
    throw new Error('Could not read KMZ file. Try exporting as KML instead.');
  }
}
