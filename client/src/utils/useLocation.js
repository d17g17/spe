import { useEffect, useState } from 'react';
import { lookupLocation } from '../lib/locations.js';

export default function useLocation(profile) {
  const [loc, setLoc] = useState(null);
  useEffect(() => {
    if (!profile?.country) { setLoc(null); return; }
    let alive = true;
    lookupLocation({
      country: profile.country,
      locStateCode: profile.locStateCode,
      locCityId: profile.locCityId,
    }).then((l) => { if (alive) setLoc(l); });
    return () => { alive = false; };
  }, [profile?.country, profile?.locStateCode, profile?.locCityId]);
  return loc;
}
