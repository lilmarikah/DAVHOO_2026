import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function fetchAPI(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status}`);
  }
  
  return response.json();
}


export function useStars(options = {}) {
  const [stars, setStars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { constellation, maxMag, limit = 500 } = options;
  
  useEffect(() => {
    async function loadStars() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (constellation) params.append('constellation', constellation);
        if (maxMag) params.append('max_mag', maxMag);
        params.append('limit', limit);
        
        const data = await fetchAPI(`/api/db/stars?${params}`);
        setStars(data.data || data);
        setError(null);
      } catch (err) {
        setError(err.message);
        console.error('Stars loading error:', err);
      } finally {
        setLoading(false);
      }
    }
    
    loadStars();
  }, [constellation, maxMag, limit]);
  
  return { stars, loading, error };
}


export function usePlanets() {
  const [planets, setPlanets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function loadPlanets() {
      try {
        setLoading(true);
        const data = await fetchAPI('/api/db/planets');
        setPlanets(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadPlanets();
  }, []);
  
  return { planets, loading, error };
}


export function usePlanetPositions(date = null) {
  const [positions, setPositions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function loadPositions() {
      try {
        setLoading(true);
        const params = date ? `?date=${date.toISOString()}` : '';
        const data = await fetchAPI(`/api/planets${params}`);
        setPositions(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadPositions();
  }, [date]);
  
  return { positions, loading, error };
}


export function useGalaxies(options = {}) {
  const [galaxies, setGalaxies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { type, constellation, maxMag, limit = 100 } = options;
  
  useEffect(() => {
    async function loadGalaxies() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (type) params.append('type', type);
        if (constellation) params.append('constellation', constellation);
        if (maxMag) params.append('max_mag', maxMag);
        params.append('limit', limit);
        
        const data = await fetchAPI(`/api/db/galaxies?${params}`);
        setGalaxies(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadGalaxies();
  }, [type, constellation, maxMag, limit]);
  
  return { galaxies, loading, error };
}


export function useDeepSkyObjects(options = {}) {
  const [dsos, setDsos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { type, objectType, constellation, limit = 100 } = options;
  
  useEffect(() => {
    async function loadDSOs() {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (type) params.append('type', type);
        if (objectType) params.append('object_type', objectType);
        if (constellation) params.append('constellation', constellation);
        params.append('limit', limit);
        
        const data = await fetchAPI(`/api/db/dso?${params}`);
        setDsos(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadDSOs();
  }, [type, objectType, constellation, limit]);
  
  return { dsos, loading, error };
}


export function useConstellations() {
  const [constellations, setConstellations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function loadConstellations() {
      try {
        setLoading(true);
        const data = await fetchAPI('/api/db/constellations');
        setConstellations(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadConstellations();
  }, []);
  
  return { constellations, loading, error };
}


export function useSearch(query) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    
    async function search() {
      try {
        setLoading(true);
        const data = await fetchAPI(`/api/db/search?q=${encodeURIComponent(query)}`);
        setResults(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    const timer = setTimeout(search, 300);
    return () => clearTimeout(timer);
  }, [query]);
  
  return { results, loading, error };
}


export function useDatabaseStats() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const data = await fetchAPI('/api/db/stats');
        setStats(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    loadStats();
  }, []);
  
  return { stats, loading, error };
}


export function useCelestialData() {
  const { stars, loading: starsLoading } = useStars({ maxMag: 4.5 });
  const { planets, loading: planetsLoading } = usePlanets();
  const { galaxies, loading: galaxiesLoading } = useGalaxies();
  const { dsos, loading: dsosLoading } = useDeepSkyObjects();
  const { constellations, loading: constsLoading } = useConstellations();
  
  const loading = starsLoading || planetsLoading || galaxiesLoading || dsosLoading || constsLoading;
  
  return {
    stars,
    planets,
    galaxies,
    dsos,
    constellations,
    loading,
    allLoaded: !loading
  };
}

export default {
  useStars,
  usePlanets,
  usePlanetPositions,
  useGalaxies,
  useDeepSkyObjects,
  useConstellations,
  useSearch,
  useDatabaseStats,
  useCelestialData
};