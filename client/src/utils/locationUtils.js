import locationData from '../steam_locations.json';

/**
 * Converts location codes to readable names
 * @param {string} countryCode - Country code (e.g., "US")
 * @param {string} stateCode - State code (e.g., "AK")
 * @param {string|number} cityId - City ID (e.g., 59 for Anchorage)
 * @returns {Object} Object containing readable location names
 */
export const getLocationNames = (countryCode, stateCode, cityId) => {
  const result = {
    countryName: '',
    stateName: '',
    cityName: ''
  };

  // Return early if no country code
  if (!countryCode) return result;

  try {
    // Look up country
    const country = locationData[countryCode];
    if (country) {
      result.countryName = country.name;

      // Look up state if provided
      if (stateCode && country.states && country.states[stateCode]) {
        const state = country.states[stateCode];
        result.stateName = state.name;

        // Look up city if provided
        if (cityId && state.cities && state.cities[cityId]) {
          result.cityName = state.cities[cityId].name;
        }
      }
    }
  } catch (error) {

  }

  return result;
};

/**
 * Returns a formatted location string based on available data
 * @param {string} countryCode - Country code
 * @param {string} stateCode - State code
 * @param {string|number} cityId - City ID
 * @returns {string} Formatted location string
 */
export const getFormattedLocation = (countryCode, stateCode, cityId) => {
  const { countryName, stateName, cityName } = getLocationNames(countryCode, stateCode, cityId);
  
  const parts = [];
  if (cityName) parts.push(cityName);
  if (stateName) parts.push(stateName);
  if (countryName) parts.push(countryName);
  
  return parts.join(', ') || 'Unknown location';
};
