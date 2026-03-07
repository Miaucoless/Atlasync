export async function getRoute(coords) {
  const r = await fetch('/api/routes/optimize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ coords })
  });
  return r.json();
}

export async function getPlaces({ categories, filter }) {
  const r = await fetch(`/api/places?categories=${categories}&filter=${filter}`);
  return r.json();
}

export async function getPlaceDetails(id) {
  const r = await fetch(`/api/places/details?id=${id}`);
  return r.json();
}
