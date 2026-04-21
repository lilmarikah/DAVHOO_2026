import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

const API_URL = 'http://localhost:8000';

const NASA_API_KEY = "NzSejzWcRrqymu0auyvQXgj8lyt2VD3q6TN0P7Gy";

export function APODWidget({ expanded = false, onToggle }) {
  const [apod, setApod] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showFullExplanation, setShowFullExplanation] = useState(false);

  useEffect(() => {
    fetchAPOD();
  }, []);

  const fetchAPOD = async () => {
    try {
      setLoading(true);
      let apodData = null;
      
      try {
        const resp = await fetch(`${API_URL}/nasa/apod`);
        if (resp.ok) {
          const data = await resp.json();
          apodData = Array.isArray(data) ? data[0] : data;
        }
      } catch (e) { /* backend nem elérhető */ }
      
      if (!apodData) {
        try {
          const resp = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${NASA_API_KEY}`);
          if (resp.ok) apodData = await resp.json();
        } catch (e) { /* NASA API sem elérhető */ }
      }
      
      if (apodData) {
        setApod(apodData);
        setError(null);
      } else {
        setError('Nem sikerült betölteni az APOD-ot');
      }
    } catch (err) {
      setError('Nem sikerült betölteni az APOD-ot');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="nasa-widget apod-widget loading">
        <div className="widget-header">
          <span className="widget-icon">🖼️</span>
          <span className="widget-title">APOD</span>
        </div>
        <div className="loading-spinner">
          <div className="spinner"></div>
          <span>Betöltés...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="nasa-widget apod-widget error">
        <div className="widget-header">
          <span className="widget-icon">🖼️</span>
          <span className="widget-title">APOD</span>
        </div>
        <div className="error-message">
          <span>⚠️ {error}</span>
          <button onClick={fetchAPOD} className="retry-btn">Újra</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`nasa-widget apod-widget expanded`}>
      <div className="widget-header">
        <span className="widget-icon">🖼️</span>
        <span className="widget-title">Astronomy Picture of the Day</span>
        <span className="widget-date">{apod?.date}</span>
      </div>
      
      <div className="widget-content">
        <div className="apod-image-container">
          {apod?.media_type === 'video' ? (
            <div className="video-thumbnail">
              <img 
                src={apod?.thumbnail_url || '/video-placeholder.png'} 
                alt={apod?.title}
                onClick={() => window.open(apod?.url, '_blank')}
              />
              <div className="play-overlay">▶</div>
            </div>
          ) : (
            <img 
              src={apod?.url} 
              alt={apod?.title}
              className="apod-image"
              onClick={() => window.open(apod?.hdurl || apod?.url, '_blank')}
            />
          )}
        </div>
        
        <div className="apod-info">
          <h3 className="apod-title">{apod?.title}</h3>
          
          {apod?.copyright && (
            <p className="apod-copyright">© {apod.copyright}</p>
          )}
          
          <p className={`apod-explanation ${showFullExplanation ? 'full' : 'truncated'}`}>
            {apod?.explanation}
          </p>
          
          {apod?.explanation?.length > 200 && (
            <button 
              className="read-more-btn"
              onClick={() => setShowFullExplanation(!showFullExplanation)}
            >
              {showFullExplanation ? 'Kevesebb ▲' : 'Több ▼'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AsteroidTracker({ expanded = false, onToggle }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAsteroid, setSelectedAsteroid] = useState(null);
  const [sortBy, setSortBy] = useState('distance'); // distance, size, hazard

  useEffect(() => {
    fetchAsteroids();
  }, []);

  const fetchAsteroids = async () => {
    try {
      setLoading(true);
      let neoData = null;
      
      try {
        const resp = await fetch(`${API_URL}/nasa/neo`);
        if (resp.ok) neoData = await resp.json();
      } catch (e) { /* backend nem elérhető */ }
      
      if (!neoData) {
        try {
          const today = new Date().toISOString().split('T')[0];
          const resp = await fetch(`https://api.nasa.gov/neo/rest/v1/feed?start_date=${today}&api_key=${NASA_API_KEY}`);
          if (resp.ok) neoData = await resp.json();
        } catch (e) { /* NASA API sem elérhető */ }
      }
      
      if (neoData) {
        setData(neoData);
        setError(null);
      } else {
        setError('Nem sikerült betölteni az aszteroidákat');
      }
    } catch (err) {
      setError('Nem sikerült betölteni az aszteroidákat');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getAllAsteroids = useCallback(() => {
    if (!data?.near_earth_objects) return [];
    
    const all = [];
    Object.entries(data.near_earth_objects).forEach(([date, asteroids]) => {
      asteroids.forEach(a => all.push({ ...a, approach_date: date }));
    });
    
    switch (sortBy) {
      case 'distance':
        all.sort((a, b) => a.miss_distance_lunar - b.miss_distance_lunar);
        break;
      case 'size':
        all.sort((a, b) => b.estimated_diameter_max_m - a.estimated_diameter_max_m);
        break;
      case 'hazard':
        all.sort((a, b) => {
          if (a.is_potentially_hazardous === b.is_potentially_hazardous) {
            return a.miss_distance_lunar - b.miss_distance_lunar;
          }
          return b.is_potentially_hazardous - a.is_potentially_hazardous;
        });
        break;
      default:
        break;
    }
    
    return all;
  }, [data, sortBy]);

  const formatDistance = (km) => {
    if (km >= 1000000) return `${(km / 1000000).toFixed(2)} M km`;
    if (km >= 1000) return `${(km / 1000).toFixed(0)} ezer km`;
    return `${km.toFixed(0)} km`;
  };

  if (loading) {
    return (
      <div className="nasa-widget asteroid-widget loading">
        <div className="widget-header">
          <span className="widget-icon">☄️</span>
          <span className="widget-title">Aszteroidák</span>
        </div>
        <div className="loading-spinner">
          <div className="spinner"></div>
          <span>Betöltés...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="nasa-widget asteroid-widget error">
        <div className="widget-header">
          <span className="widget-icon">☄️</span>
          <span className="widget-title">Aszteroidák</span>
        </div>
        <div className="error-message">
          <span>⚠️ {error}</span>
          <button onClick={fetchAsteroids} className="retry-btn">Újra</button>
        </div>
      </div>
    );
  }

  const asteroids = getAllAsteroids();

  return (
    <div className={`nasa-widget asteroid-widget ${expanded ? 'expanded' : ''}`}>
      <div className="widget-header" onClick={onToggle}>
        <span className="widget-icon">☄️</span>
        <span className="widget-title">Közel-Föld Aszteroidák</span>
        <span className="widget-count">{data?.element_count} objektum</span>
        <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
      </div>
      
      <div className="widget-content">
        {/* Summary stats */}
        <div className="asteroid-stats">
          <div className="stat">
            <span className="stat-value">{data?.element_count}</span>
            <span className="stat-label">Összes</span>
          </div>
          <div className="stat hazardous">
            <span className="stat-value">{data?.potentially_hazardous_count}</span>
            <span className="stat-label">Veszélyes</span>
          </div>
          <div className="stat">
            <span className="stat-value">{data?.start_date?.slice(5)}</span>
            <span className="stat-label">-tól</span>
          </div>
          <div className="stat">
            <span className="stat-value">{data?.end_date?.slice(5)}</span>
            <span className="stat-label">-ig</span>
          </div>
        </div>

        {/* Sort controls */}
        <div className="sort-controls">
          <span>Rendezés:</span>
          <button 
            className={sortBy === 'distance' ? 'active' : ''}
            onClick={() => setSortBy('distance')}
          >
            Távolság
          </button>
          <button 
            className={sortBy === 'size' ? 'active' : ''}
            onClick={() => setSortBy('size')}
          >
            Méret
          </button>
          <button 
            className={sortBy === 'hazard' ? 'active' : ''}
            onClick={() => setSortBy('hazard')}
          >
            Veszély
          </button>
        </div>

        {/* Asteroid list */}
        <div className="asteroid-list">
          {asteroids.slice(0, expanded ? 20 : 5).map((asteroid) => (
            <div 
              key={asteroid.id}
              className={`asteroid-item ${asteroid.is_potentially_hazardous ? 'hazardous' : ''} ${selectedAsteroid?.id === asteroid.id ? 'selected' : ''}`}
              onClick={() => setSelectedAsteroid(selectedAsteroid?.id === asteroid.id ? null : asteroid)}
            >
              <div className="asteroid-main">
                <div className="asteroid-name">
                  {asteroid.is_potentially_hazardous && <span className="hazard-icon">⚠️</span>}
                  <span>{asteroid.name.replace(/[()]/g, '')}</span>
                </div>
                <div className="asteroid-distance">
                  <span className="lunar-distance">{asteroid.miss_distance_lunar.toFixed(1)} LD</span>
                  <span className="km-distance">{formatDistance(asteroid.miss_distance_km)}</span>
                </div>
              </div>
              
              {selectedAsteroid?.id === asteroid.id && (
                <div className="asteroid-details">
                  <div className="detail-row">
                    <span className="detail-label">📅 Elhaladás:</span>
                    <span className="detail-value">{asteroid.close_approach_date}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">📏 Átmérő:</span>
                    <span className="detail-value">
                      {asteroid.estimated_diameter_min_m.toFixed(0)} - {asteroid.estimated_diameter_max_m.toFixed(0)} m
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">🚀 Sebesség:</span>
                    <span className="detail-value">
                      {(asteroid.relative_velocity_kmh / 1000).toFixed(1)} km/s
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">📊 Kategória:</span>
                    <span className="detail-value">{asteroid.size_category}</span>
                  </div>
                  <a 
                    href={asteroid.nasa_jpl_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="jpl-link"
                  >
                    NASA JPL Adatlap →
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>

        {!expanded && asteroids.length > 5 && (
          <div className="show-more" onClick={onToggle}>
            + {asteroids.length - 5} további aszteroida
          </div>
        )}
      </div>
    </div>
  );
}

export function NASASpaceGallery({ expanded = false, onToggle }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [topic, setTopic] = useState('nebula');

  const topics = [
    { id: 'nebula', name: 'Ködök', emoji: '🌫️' },
    { id: 'galaxy', name: 'Galaxisok', emoji: '🌌' },
    { id: 'james webb', name: 'Webb', emoji: '🔭' },
    { id: 'hubble deep field', name: 'Hubble', emoji: '✨' },
    { id: 'mars surface', name: 'Mars', emoji: '🔴' },
    { id: 'saturn', name: 'Szaturnusz', emoji: '🪐' },
  ];

  useEffect(() => {
    const loadPhotos = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await fetch(
          `https://images-api.nasa.gov/search?q=${encodeURIComponent(topic)}&media_type=image&page_size=20`
        );
        if (resp.ok) {
          const json = await resp.json();
          const items = (json.collection?.items || [])
            .filter(item => item.links && item.links[0]?.href)
            .map(item => ({
              id: item.data?.[0]?.nasa_id || Math.random().toString(),
              title: item.data?.[0]?.title || '',
              description: item.data?.[0]?.description || '',
              date: item.data?.[0]?.date_created?.split('T')[0] || '',
              center: item.data?.[0]?.center || 'NASA',
              img_src: item.links[0].href,
            }));
          setPhotos(items);
          if (items.length === 0) setError('Nincs találat');
        } else {
          setError('Nem sikerült betölteni');
        }
      } catch (err) {
        console.error('NASA Images error:', err);
        setError('Hálózati hiba');
      } finally {
        setLoading(false);
      }
    };
    loadPhotos();
  }, [topic]);

  return (
    <div className={`nasa-widget gallery-widget ${expanded ? 'expanded' : ''}`}>
      <div className="widget-header" onClick={onToggle}>
        <span className="widget-icon">🔭</span>
        <span className="widget-title">NASA Űrgaléria</span>
        <span className="widget-topic">{topics.find(t => t.id === topic)?.name}</span>
        <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
      </div>
      
      <div className="widget-content">
        {/* Topic selector */}
        <div className="topic-selector">
          {topics.map(t => (
            <button
              key={t.id}
              className={`topic-btn ${topic === t.id ? 'active' : ''}`}
              onClick={() => setTopic(t.id)}
            >
              <span className="topic-emoji">{t.emoji}</span>
              <span className="topic-name">{t.name}</span>
            </button>
          ))}
        </div>

        {/* Photo grid */}
        {loading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <span>Fotók betöltése...</span>
          </div>
        ) : error ? (
          <div className="error-message">
            <span>⚠️ {error}</span>
            <button onClick={() => setTopic(topic)} className="retry-btn">Újra</button>
          </div>
        ) : (
          <>
            <div className="photo-count">
              {photos.length} kép
            </div>
            <div className="photo-grid">
              {photos.slice(0, expanded ? 20 : 6).map((photo) => (
                <div 
                  key={photo.id}
                  className="photo-item"
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <img 
                    src={photo.img_src} 
                    alt={photo.title}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23333" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="%23666" font-size="12">🔭</text></svg>';
                    }}
                  />
                  <div className="photo-overlay">
                    <span className="camera-name">{photo.title?.slice(0, 30)}</span>
                  </div>
                </div>
              ))}
            </div>
            {!expanded && photos.length > 6 && (
              <div className="show-more" onClick={onToggle}>
                + {photos.length - 6} további fotó
              </div>
            )}
          </>
        )}
      </div>

      {/* Photo modal — portál */}
      {selectedPhoto && ReactDOM.createPortal(
        <div className="photo-modal" onClick={() => setSelectedPhoto(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedPhoto(null)}>×</button>
            <img src={selectedPhoto.img_src} alt={selectedPhoto.title} />
            <div className="modal-info">
              <h3>{selectedPhoto.title}</h3>
              {selectedPhoto.description && (
                <p style={{ maxHeight: '120px', overflowY: 'auto', fontSize: '0.8rem' }}>
                  {selectedPhoto.description.slice(0, 400)}{selectedPhoto.description.length > 400 ? '...' : ''}
                </p>
              )}
              <p>Dátum: {selectedPhoto.date}</p>
              <p>Forrás: {selectedPhoto.center}</p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export function EarthViewer({ expanded = false, onToggle }) {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [collection, setCollection] = useState('natural');

  useEffect(() => {
    fetchImages();
  }, [collection]);

  const fetchImages = async () => {
    try {
      setLoading(true);
      let imageData = null;
      
      try {
        const resp = await fetch(`${API_URL}/nasa/epic?collection=${collection}`);
        if (resp.ok) imageData = await resp.json();
      } catch (e) { /* backend nem elérhető */ }
      
      if (!imageData || imageData.length === 0) {
        try {
          const resp = await fetch(`https://epic.gsfc.nasa.gov/api/${collection}`);
          if (resp.ok) {
            const rawData = await resp.json();
            if (rawData && rawData.length > 0) {
              imageData = rawData.map(img => ({
                identifier: img.identifier,
                caption: img.caption,
                date: img.date,
                thumbnail_url: `https://epic.gsfc.nasa.gov/archive/${collection}/${img.date.split(' ')[0].replace(/-/g, '/')}/thumbs/${img.image}.jpg`,
                image_url: `https://epic.gsfc.nasa.gov/archive/${collection}/${img.date.split(' ')[0].replace(/-/g, '/')}/png/${img.image}.png`,
                coords: img.centroid_coordinates
              }));
            }
          }
        } catch (e) { /* EPIC API sem elérhető */ }
      }
      
      if (!imageData || imageData.length === 0) {
        try {
          const datesResp = await fetch(`https://epic.gsfc.nasa.gov/api/${collection}/all`);
          if (datesResp.ok) {
            const allDates = await datesResp.json();
            if (allDates && allDates.length > 0) {
              const latestDate = allDates[allDates.length - 1].date.split(' ')[0];
              const imgResp = await fetch(`https://epic.gsfc.nasa.gov/api/${collection}/date/${latestDate}`);
              if (imgResp.ok) {
                const rawData = await imgResp.json();
                if (rawData && rawData.length > 0) {
                  imageData = rawData.map(img => ({
                    identifier: img.identifier,
                    caption: img.caption,
                    date: img.date,
                    thumbnail_url: `https://epic.gsfc.nasa.gov/archive/${collection}/${img.date.split(' ')[0].replace(/-/g, '/')}/thumbs/${img.image}.jpg`,
                    image_url: `https://epic.gsfc.nasa.gov/archive/${collection}/${img.date.split(' ')[0].replace(/-/g, '/')}/png/${img.image}.png`,
                    coords: img.centroid_coordinates
                  }));
                }
              }
            }
          }
        } catch (e) { /* fallback sem működik */ }
      }
      
      if (imageData && imageData.length > 0) {
        setImages(imageData);
        setError(null);
      } else {
        setError('Nem sikerült betölteni a képeket');
      }
    } catch (err) {
      setError('Nem sikerült betölteni a képeket');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`nasa-widget earth-widget ${expanded ? 'expanded' : ''}`}>
      <div className="widget-header" onClick={onToggle}>
        <span className="widget-icon">🌍</span>
        <span className="widget-title">Föld az Űrből (EPIC)</span>
        <span className="expand-icon">{expanded ? '▼' : '▶'}</span>
      </div>
      
      <div className="widget-content">
        {/* Collection toggle */}
        <div className="collection-toggle">
          <button 
            className={collection === 'natural' ? 'active' : ''}
            onClick={() => setCollection('natural')}
          >
            🌎 Természetes
          </button>
          <button 
            className={collection === 'enhanced' ? 'active' : ''}
            onClick={() => setCollection('enhanced')}
          >
            ✨ Javított
          </button>
        </div>

        {loading ? (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <span>Képek betöltése...</span>
          </div>
        ) : error ? (
          <div className="error-message">
            <span>⚠️ {error}</span>
            <button onClick={fetchImages} className="retry-btn">Újra</button>
          </div>
        ) : (
          <div className="earth-grid">
            {images.slice(0, expanded ? 12 : 4).map((img, idx) => (
              <div 
                key={img.identifier}
                className="earth-item"
                onClick={() => setSelectedImage(img)}
              >
                <img src={img.thumbnail_url} alt="Earth" />
                <div className="earth-overlay">
                  <span>{img.date?.split(' ')[1]?.slice(0, 5) || ''}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {!expanded && images.length > 4 && (
          <div className="show-more" onClick={onToggle}>
            + {images.length - 4} további kép
          </div>
        )}
      </div>

      {/* Image modal — portál a body-ba a backdrop-filter probléma miatt */}
      {selectedImage && ReactDOM.createPortal(
        <div className="photo-modal" onClick={() => setSelectedImage(null)}>
          <div className="modal-content earth-modal" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setSelectedImage(null)}>×</button>
            <img src={selectedImage.image_url} alt="Earth" />
            <div className="modal-info">
              <h3>Föld - DSCOVR/EPIC</h3>
              <p>{selectedImage.caption}</p>
              <p>Időpont: {selectedImage.date}</p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default function NASADashboard({ isOpen, onClose }) {
  const [expandedWidget, setExpandedWidget] = useState(null);

  const toggleWidget = (widget) => {
    setExpandedWidget(expandedWidget === widget ? null : widget);
  };

  if (!isOpen) return null;

  return (
    <div className="nasa-dashboard-overlay">
      <div className="nasa-dashboard">
        <div className="dashboard-header">
          <h2>🚀 NASA Dashboard</h2>
          <p>Valós idejű űrkutatási adatok</p>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="dashboard-content">
          <APODWidget 
            expanded={true} 
            onToggle={() => {}} 
          />
          
          <AsteroidTracker 
            expanded={expandedWidget === 'asteroid'} 
            onToggle={() => toggleWidget('asteroid')} 
          />
          
          <NASASpaceGallery 
            expanded={expandedWidget === 'gallery'} 
            onToggle={() => toggleWidget('gallery')} 
          />
          
          <EarthViewer 
            expanded={expandedWidget === 'earth'} 
            onToggle={() => toggleWidget('earth')} 
          />
        </div>
      </div>
    </div>
  );
}