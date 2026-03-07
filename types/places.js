/**
 * types/places.js
 * Internal place shapes used by Geoapify normalizer and API responses.
 * Kept stable so UI and Mapbox layers do not change.
 */

/**
 * @typedef {Object} PlaceBasic
 * @property {string} place_id
 * @property {string} name
 * @property {[number, number]} coords - [lng, lat]
 * @property {string} [category]
 * @property {string} [address]
 * @property {'geoapify'} source
 */

/**
 * @typedef {PlaceBasic & {
 *   phone?: string;
 *   website?: string;
 *   opening_hours?: object;
 *   photos?: { url: string; attributions?: string }[];
 *   raw?: object;
 * }} PlaceDetails
 */

export default {};
