/**
 * lib/normalizeGeoapify.js
 * Normalize Geoapify Places API responses to stable internal shapes (PlaceBasic, PlaceDetails).
 * Keeps UI and Mapbox layer contracts unchanged.
 */

/**
 * @param {object} feature - GeoJSON Feature from Geoapify /v2/places
 * @returns {import('../types/places').PlaceBasic}
 */
export function toPlaceBasic(feature) {
  const props = feature?.properties || {};
  const coords = feature?.geometry?.coordinates;
  const lng = coords?.[0];
  const lat = coords?.[1];
  const placeId = props.place_id || '';
  const name = props.name || 'Unknown place';
  const categories = props.categories || [];
  const primaryCategory = Array.isArray(categories) ? categories[0] : (categories && categories[0]) || '';
  const category = typeof primaryCategory === 'string' ? primaryCategory : '';
  const address = props.formatted || props.address_line2 || props.address_line1 || '';

  return {
    place_id: placeId,
    name,
    coords: [Number(lng), Number(lat)].every(Number.isFinite) ? [Number(lng), Number(lat)] : [0, 0],
    category: category || undefined,
    address: address || undefined,
    source: 'geoapify',
  };
}

/**
 * @param {import('../types/places').PlaceBasic[]} items
 * @returns {import('geojson').FeatureCollection}
 */
export function toFeatureCollection(items) {
  const features = items.map((item) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: item.coords },
    properties: {
      place_id: item.place_id,
      name: item.name,
      category: item.category,
      address: item.address,
      source: item.source,
    },
  }));
  return { type: 'FeatureCollection', features };
}

/**
 * Geoapify place-details returns a FeatureCollection; the main place info is in the feature with feature_type === 'details'.
 * @param {object} payload - Response from Geoapify /v2/place-details (FeatureCollection or single feature)
 * @returns {import('../types/places').PlaceDetails}
 */
export function toPlaceDetails(payload) {
  const features = payload?.features || [];
  const detailsFeature = features.find((f) => f?.properties?.feature_type === 'details') || features[0] || payload;
  const feature = detailsFeature?.properties ? detailsFeature : payload;
  const props = feature?.properties || feature || {};
  const coords = feature?.geometry?.coordinates || [];
  const lng = coords[0];
  const lat = coords[1];

  const placeId = props.place_id || '';
  const name = props.name || 'Unknown place';
  const categories = props.categories || [];
  const primaryCategory = Array.isArray(categories) ? categories[0] : '';
  const category = typeof primaryCategory === 'string' ? primaryCategory : undefined;
  const address = props.formatted || props.address_line2 || props.address_line1 || undefined;

  const basic = {
    place_id: placeId,
    name,
    coords: [Number(lng), Number(lat)].every(Number.isFinite) ? [Number(lng), Number(lat)] : [0, 0],
    category,
    address,
    source: 'geoapify',
  };

  const contact = props.contact || {};
  const phone = contact.phone || props.phone || undefined;
  const website = props.website || undefined;
  const opening_hours = props.opening_hours != null ? props.opening_hours : undefined;
  const description = typeof props.description === 'string' ? props.description.trim() || undefined : undefined;

  let photos = [];
  if (props.datasource?.raw?.image) {
    photos.push({ url: props.datasource.raw.image, attributions: '© OpenStreetMap' });
  }

  return {
    ...basic,
    description,
    phone,
    website,
    opening_hours,
    photos: photos.length ? photos : undefined,
    raw: payload,
  };
}
