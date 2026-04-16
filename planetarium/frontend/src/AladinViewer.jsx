import React, { useEffect, useRef, useState, useCallback } from 'react';

const SURVEYS = [
  { id: 'DSS', name: 'DSS Color', url: 'https://alasky.cds.unistra.fr/DSS/DSSColor/', desc: 'Optikai' },
  { id: 'DSS2', name: 'DSS2 Red', url: 'https://alasky.cds.unistra.fr/DSS/DSS2Merged/', desc: 'Mély optikai' },
  { id: '2MASS', name: '2MASS', url: 'https://alasky.cds.unistra.fr/2MASS/Color/', desc: 'Közeli infravörös' },
  { id: 'allWISE', name: 'AllWISE', url: 'https://alasky.cds.unistra.fr/AllWISE/RGB-W4-W2-W1/', desc: 'Távoli infravörös' },
  { id: 'Fermi', name: 'Fermi', url: 'https://alasky.cds.unistra.fr/Fermi/Color/', desc: 'Gamma-sugárzás' },
  { id: 'SDSS9', name: 'SDSS', url: 'https://alasky.cds.unistra.fr/SDSS/DR9/color/', desc: 'Sloan Survey' },
  { id: 'Mellinger', name: 'Mellinger', url: 'https://alasky.cds.unistra.fr/Mellinger/color/', desc: 'Optikai Survey' },
];

let _loaded = false, _loading = false, _cbs = [];
function loadAladinScript() {
  return new Promise((resolve, reject) => {
    if (_loaded && window.A) { resolve(window.A); return; }
    if (_loading) { _cbs.push({ resolve, reject }); return; }
    _loading = true;
    const s = document.createElement('script');
    s.src = 'https://aladin.cds.unistra.fr/AladinLite/api/v3/latest/aladin.js';
    s.charset = 'utf-8';
    s.onload = () => {
      _loaded = true; _loading = false;
      if (window.A?.init) {
        window.A.init.then(() => { resolve(window.A); _cbs.forEach(c => c.resolve(window.A)); _cbs = []; }).catch(reject);
      } else reject(new Error('A not found'));
    };
    s.onerror = (e) => { _loading = false; reject(e); };
    document.head.appendChild(s);
  });
}

export default function AladinInlineViewer({ selectedObject, fov }) {
  const containerRef = useRef(null);
  const aladinRef = useRef(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [activeSurvey, setActiveSurvey] = useState(SURVEYS[0]);
  const [showPicker, setShowPicker] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const prevObjectRef = useRef(null);

  const isDeepSky = selectedObject && ['galaxy', 'nebula', 'exoplanet'].includes(selectedObject.type);

  const getCoords = useCallback(() => {
    if (!selectedObject) return null;
    let ra = selectedObject.ra, dec = selectedObject.dec;
    if (ra === undefined || dec === undefined) return null;
    if (ra <= 24) ra *= 15;
    return { ra, dec };
  }, [selectedObject]);

  useEffect(() => {
    if (!isDeepSky || !isOpen || !containerRef.current) return;

    const objectChanged = prevObjectRef.current !== selectedObject?.id;
    if (aladinRef.current && !objectChanged) {
      const c = getCoords();
      if (c) try { aladinRef.current.gotoRaDec(c.ra, c.dec); } catch(e) {}
      return;
    }

    if (aladinRef.current) {
      containerRef.current.innerHTML = '';
      aladinRef.current = null;
    }

    prevObjectRef.current = selectedObject?.id;
    setIsLoading(true);
    setLoadError(null);

    loadAladinScript().then((A) => {
      if (!containerRef.current) return;
      const c = getCoords();
      const targetFov = Math.min(Math.max(fov, 0.05), 15);

      const aladin = A.aladin(containerRef.current, {
        survey: activeSurvey.url,
        fov: targetFov,
        target: c ? `${c.ra.toFixed(6)} ${c.dec.toFixed(6)}` : '0 0',
        cooFrame: 'ICRSd',
        projection: 'SIN',
        showCooGridControl: false,
        showSimbadPointerControl: true,
        showCooGrid: false,
        showLayersControl: false,
        showGotoControl: false,
        showZoomControl: false,
        showFullscreenControl: false,
        showFrame: false,
        showCooLocation: false,
        showContextMenu: false,
        reticleColor: '#00d4ff',
        reticleSize: 18,
      });
      aladinRef.current = aladin;
      setIsLoading(false);
    }).catch((err) => {
      console.error('Aladin hiba:', err);
      setLoadError('Betöltési hiba');
      setIsLoading(false);
    });

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = '';
      aladinRef.current = null;
    };
  }, [selectedObject?.id, isDeepSky, isOpen]);

  const changeSurvey = useCallback((s) => {
    setActiveSurvey(s);
    setShowPicker(false);
    if (aladinRef.current) try { aladinRef.current.setBaseImageLayer(s.url); } catch(e) {}
  }, []);

  if (!isDeepSky) return null;

  return (
    <div style={{ marginTop: '14px', borderTop: '1px solid rgba(0,212,255,0.2)', paddingTop: '12px' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%', background: 'none', border: 'none',
          color: '#00d4ff', fontFamily: 'Orbitron, monospace',
          fontSize: '10px', letterSpacing: '1px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 0 8px 0',
        }}
      >
        <span>📡 SURVEY NÉZET</span>
        <span style={{ fontSize: '8px', opacity: 0.5 }}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <>
          <div style={{
            position: 'relative', width: '100%', height: '220px',
            borderRadius: '8px', overflow: 'hidden',
            border: '1px solid rgba(0,212,255,0.2)',
          }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

            {isLoading && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                color: '#00d4ff', fontSize: '11px', fontFamily: 'Exo 2, sans-serif',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <div style={{
                  width: 14, height: 14,
                  border: '2px solid rgba(0,212,255,0.3)',
                  borderTop: '2px solid #00d4ff',
                  borderRadius: '50%', animation: 'aladin-spin 1s linear infinite',
                }} />
                Betöltés...
              </div>
            )}

            {loadError && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                color: '#ff6666', fontSize: '11px', fontFamily: 'Exo 2, sans-serif',
              }}>
                ⚠️ {loadError}
              </div>
            )}
          </div>

          <div style={{ position: 'relative', marginTop: '8px' }}>
            <button
              onClick={() => setShowPicker(!showPicker)}
              style={{
                width: '100%', background: 'rgba(0,20,40,0.6)',
                border: '1px solid rgba(0,212,255,0.2)', borderRadius: '6px',
                padding: '6px 10px', color: '#00d4ff',
                fontFamily: 'Exo 2, sans-serif', fontSize: '10px',
                cursor: 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>📡 {activeSurvey.name} <span style={{ color: '#445566', marginLeft: '4px' }}>{activeSurvey.desc}</span></span>
              <span style={{ fontSize: '8px', opacity: 0.4 }}>{showPicker ? '▲' : '▼'}</span>
            </button>

            {showPicker && (
              <div style={{
                position: 'absolute', bottom: '100%', left: 0, right: 0,
                marginBottom: '4px', background: 'rgba(8,14,24,0.99)',
                border: '1px solid rgba(0,212,255,0.25)', borderRadius: '8px',
                overflow: 'hidden', boxShadow: '0 -6px 24px rgba(0,0,0,0.5)',
                maxHeight: '200px', overflowY: 'auto', zIndex: 10,
              }}>
                {SURVEYS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => changeSurvey(s)}
                    style={{
                      width: '100%', padding: '7px 10px', border: 'none',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      background: activeSurvey.id === s.id ? 'rgba(0,212,255,0.12)' : 'transparent',
                      color: activeSurvey.id === s.id ? '#00d4ff' : '#778899',
                      fontFamily: 'Exo 2, sans-serif', fontSize: '10px',
                      cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    {activeSurvey.id === s.id ? '● ' : '○ '}{s.name}
                    <span style={{ fontSize: '9px', opacity: 0.4, marginLeft: '6px' }}>{s.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <style>{`
        @keyframes aladin-spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}

export { SURVEYS };