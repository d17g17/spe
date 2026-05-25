let cache = null;
let pending = null;

const load = async () => {
  if (cache) return cache;
  if (pending) return pending;
  pending = fetch('/locations.json')
    .then((r) => (r.ok ? r.json() : {}))
    .then((data) => {
      cache = data || {};
      return cache;
    })
    .catch(() => {
      cache = {};
      return cache;
    });
  return pending;
};

export const lookupLocation = async ({ country, locStateCode, locCityId }) => {
  if (!country) return null;
  const data = await load();
  const c = data?.[country];
  if (!c) return null;
  const countryName = c.name || country;
  if (!locStateCode || !c.states) return { country: countryName };
  const st = c.states[locStateCode];
  if (!st) return { country: countryName };
  const stateName = st.name || locStateCode;
  if (locCityId == null || !st.cities) return { country: countryName, state: stateName };
  const city = st.cities[String(locCityId)] || st.cities[locCityId];
  return { country: countryName, state: stateName, city: city?.name || null };
};

export const formatLocation = (loc) => {
  if (!loc) return null;
  return [loc.city, loc.state, loc.country].filter(Boolean).join(', ');
};
