import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:8000/api/db';

export function generateBackgroundStars(count = 800) {
  const bgStars = [];
  for (let i = 0; i < count; i++) {
    const ra = Math.random() * 24;
    const dec = (Math.acos(2 * Math.random() - 1) * 180 / Math.PI) - 90;
    const mag = 4 + Math.random() * 3;
    bgStars.push({
      id: 100000 + i, name: null, ra, dec, mag,
      color: ['#FFFFFF', '#FFF4EA', '#FFD2A1', '#AABFFF'][Math.floor(Math.random() * 4)],
      constellation: null
    });
  }
  return bgStars;
}

const EMPTY_DATA = {
  brightStars: [],
  constellationData: [],
  sunData: { id: 'sun', name: 'Nap', color: '#FFD700', glowColor: '#FFA500', size: 0.08, description: 'A Naprendszer központi csillaga.' },
  planets: [],
  moonData: { id: 'moon', name: 'Hold', color: '#C0C0C0', glowColor: '#888888', size: 0.04, description: 'A Föld természetes műholdja.' },
  galaxies: [], nebulaeData: [], exoplanetsData: [], deepSkyObjects: [],
};

export default function usePlanetariumDB() {
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      try {
        console.log('🔭 Adatok betöltése a planetarium.db-ből...');
        const resp = await fetch(`${API_BASE}/all`);
        if (!resp.ok) throw new Error(`API hiba: ${resp.status} ${resp.statusText}`);
        const json = await resp.json();
        if (cancelled) return;
        
        const stars = (json.brightStars || []).map(s => ({ ...s, color: s.color || '#ffffff' }));
        
        setData({
          brightStars: stars,
          constellationData: json.constellationData || [],
          sunData: json.sunData || EMPTY_DATA.sunData,
          planets: json.planets || [],
          moonData: json.moonData || EMPTY_DATA.moonData,
          galaxies: json.galaxies || [],
          nebulaeData: json.nebulaeData || [],
          exoplanetsData: json.exoplanetsData || [],
          deepSkyObjects: [],
        });
        setError(null);
        console.log(`✅ DB betöltve: ${stars.length} csillag, ${(json.constellationData||[]).length} csillagkép`);
      } catch (e) {
        if (cancelled) return;
        console.error('❌ DB hiba:', e.message);
        setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadAll();
    return () => { cancelled = true; };
  }, []);

  return { data, loading, error };
}
