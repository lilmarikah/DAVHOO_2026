"""
🌟 Planetárium Database API
============================
FastAPI endpoints az SQLite adatbázishoz.
Minden csillagászati adat egyetlen adatbázisból.

Használat main.py-ban:
  from database.database_api import router as db_router
  app.include_router(db_router)
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional
import sqlite3
import json
import os

router = APIRouter(prefix="/api/db", tags=["database"])

DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'planetarium.db')

def get_db():
    """Adatbázis kapcsolat"""
    if not os.path.exists(DATABASE_PATH):
        raise HTTPException(status_code=500, detail=f"Adatbázis nem található: {DATABASE_PATH}")
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def rows_to_list(rows):
    """SQLite Rows → list of dicts"""
    return [dict(row) for row in rows]

@router.get("/all")
async def get_all_data():
    """
    Minden csillagászati adat egyetlen hívással.
    A frontend indulásakor ezt hívja meg.
    """
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT * FROM stars ORDER BY mag ASC")

        stars = rows_to_list(cursor.fetchall())

        for s in stars:
            if 'constellation_hu' in s:
                s['constellationHu'] = s.pop('constellation_hu')
            if 'spectral_type' in s:
                s['spectralType'] = s.pop('spectral_type')
            if 'distance_ly' in s:
                s['distanceLy'] = s.pop('distance_ly')
            if 'proper_name' in s:
                if not s.get('name') and s['proper_name']:
                    s['name'] = s['proper_name']
                del s['proper_name']
            if not s.get('color'):
                s['color'] = '#ffffff'
        
        cursor.execute("SELECT * FROM constellations")
        raw_constellations = rows_to_list(cursor.fetchall())
        constellations = []
        for c in raw_constellations:
            constellations.append({
                'name': c['name'],
                'nameHu': c['name_hu'],
                'labelPos': {'ra': c['label_ra'], 'dec': c['label_dec']} if c['label_ra'] else None,
                'lines': json.loads(c['lines']) if c['lines'] else []
            })
        
        cursor.execute("SELECT * FROM solar_system")
        raw_solar = rows_to_list(cursor.fetchall())
        
        sun_data = None
        moon_data = None
        planets_list = []
        for obj in raw_solar:
            if obj['type'] == 'star':
                sun_data = {
                    'id': obj['id'], 'name': obj['name'],
                    'color': obj['color'], 'glowColor': obj['glow_color'],
                    'size': obj['size'], 'description': obj['description']
                }
            elif obj['type'] == 'moon':
                moon_data = {
                    'id': obj['id'], 'name': obj['name'],
                    'color': obj['color'], 'glowColor': obj['glow_color'],
                    'size': obj['size'], 'description': obj['description'],
                    'distance': obj['distance'], 'orbitalPeriod': obj['orbital_period']
                }
            elif obj['type'] == 'planet':
                planets_list.append({
                    'id': obj['id'], 'name': obj['name'],
                    'color': obj['color'], 'size': obj['size'],
                    'orbitalPeriod': obj['orbital_period'],
                    'distance': obj['distance'],
                    'eccentricity': obj['eccentricity'],
                    'longitudeOfPerihelion': obj['longitude_of_perihelion'],
                    'meanLongitude': obj['mean_longitude'],
                    'description': obj['description'],
                    'texture': obj['texture'],
                    'diameterKm': obj['diameter_km'],
                    'massKg': obj['mass_kg'],
                    'rotationPeriod': obj['rotation_period'],
                    'axialTilt': obj['axial_tilt'],
                    'moons': obj['moons']
                })
        
        cursor.execute("SELECT * FROM galaxies")
        raw_galaxies = rows_to_list(cursor.fetchall())
        galaxies = []
        for g in raw_galaxies:
            galaxies.append({
                'id': g['id'], 'name': g['name'], 'nameEn': g['name_en'],
                'type': g['type'], 'ra': g['ra'], 'dec': g['dec'],
                'distanceMly': g['distance_mly'], 'magnitude': g['magnitude'],
                'size_arcmin': g['size_arcmin'], 'description': g['description'],
                'constellation': g['constellation'], 'diameterLy': g['diameter_ly'],
                'starCount': g['star_count'],
                'colorScheme': json.loads(g['color_scheme']) if g['color_scheme'] else None,
                'specialFeatures': json.loads(g['special_features']) if g['special_features'] else None,
            })
        
        cursor.execute("SELECT * FROM nebulae")
        raw_nebulae = rows_to_list(cursor.fetchall())
        nebulae = []
        for n in raw_nebulae:
            nebulae.append({
                'id': n['id'], 'name': n['name'], 'nameEn': n['name_en'],
                'type': n['type'], 'ra': n['ra'], 'dec': n['dec'],
                'distanceLy': n['distance_ly'], 'magnitude': n['magnitude'],
                'size_arcmin': n['size_arcmin'], 'description': n['description'],
                'constellation': n['constellation'],
                'color': n['color'], 'glowColor': n['glow_color'],
                'starForming': bool(n['star_forming'])
            })
        
        cursor.execute("SELECT * FROM exoplanets")
        raw_exo = rows_to_list(cursor.fetchall())
        exoplanets = []
        for e in raw_exo:
            exoplanets.append({
                'id': e['id'], 'name': e['name'], 'hostStar': e['host_star'],
                'ra': e['ra'], 'dec': e['dec'],
                'distanceLy': e['distance_ly'],
                'massEarth': e['mass_earth'], 'radiusEarth': e['radius_earth'],
                'orbitalPeriodDays': e['orbital_period_days'],
                'equilibriumTempK': e['equilibrium_temp_k'],
                'discoveryYear': e['discovery_year'],
                'discoveryMethod': e['discovery_method'],
                'description': e['description'], 'constellation': e['constellation'],
                'isHabitableZone': bool(e['is_habitable_zone']),
                'starType': e['star_type'], 'semiMajorAxis': e['semi_major_axis']
            })
        
        return {
            'brightStars': stars,
            'constellationData': constellations,
            'sunData': sun_data,
            'planets': planets_list,
            'moonData': moon_data,
            'galaxies': galaxies,
            'nebulaeData': nebulae,
            'exoplanetsData': exoplanets
        }
    finally:
        conn.close()

@router.get("/stars")
async def get_stars(
    constellation: Optional[str] = None,
    max_mag: Optional[float] = Query(None, description="Maximum fényesség"),
    limit: int = Query(2000, le=20000),
    offset: int = 0
):
    """Csillagok lekérdezése szűrőkkel"""
    conn = get_db()
    cursor = conn.cursor()
    
    query = "SELECT * FROM stars WHERE 1=1"
    params = []
    
    if constellation:
        query += " AND constellation = ?"
        params.append(constellation)
    if max_mag is not None:
        query += " AND mag <= ?"
        params.append(max_mag)
    
    query += " ORDER BY mag ASC LIMIT ? OFFSET ?"
    params.extend([limit, offset])
    
    cursor.execute(query, params)
    stars = rows_to_list(cursor.fetchall())
    conn.close()
    return stars

@router.get("/constellations")
async def get_constellations():
    """Összes csillagkép vonalakkal"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM constellations ORDER BY name")
    rows = rows_to_list(cursor.fetchall())
    conn.close()
    
    return [{
        'name': c['name'],
        'nameHu': c['name_hu'],
        'labelPos': {'ra': c['label_ra'], 'dec': c['label_dec']} if c['label_ra'] else None,
        'lines': json.loads(c['lines']) if c['lines'] else []
    } for c in rows]

@router.get("/solar-system")
async def get_solar_system():
    """Naprendszer objektumok"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM solar_system")
    rows = rows_to_list(cursor.fetchall())
    conn.close()
    return rows

@router.get("/galaxies")
async def get_galaxies():
    """Összes galaxis"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM galaxies ORDER BY magnitude ASC")
    rows = rows_to_list(cursor.fetchall())
    conn.close()
    
    for g in rows:
        if g.get('color_scheme'):
            g['color_scheme'] = json.loads(g['color_scheme'])
        if g.get('special_features'):
            g['special_features'] = json.loads(g['special_features'])
    return rows

@router.get("/nebulae")
async def get_nebulae():
    """Összes köd"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM nebulae ORDER BY magnitude ASC")
    rows = rows_to_list(cursor.fetchall())
    conn.close()
    return rows

@router.get("/exoplanets")
async def get_exoplanets():
    """Összes exobolygó"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM exoplanets ORDER BY distance_ly ASC")
    rows = rows_to_list(cursor.fetchall())
    conn.close()
    return rows

@router.get("/search")
async def search(q: str = Query(..., min_length=1)):
    """Keresés az összes táblában"""
    conn = get_db()
    cursor = conn.cursor()
    results = []
    query = f"%{q}%"
    
    cursor.execute("SELECT id, name, bayer, constellation, mag, 'star' as type FROM stars WHERE name LIKE ? OR bayer LIKE ? OR constellation LIKE ? ORDER BY mag LIMIT 10",
                    (query, query, query))
    results.extend(rows_to_list(cursor.fetchall()))
    
    cursor.execute("SELECT name, name_hu, 'constellation' as type FROM constellations WHERE name LIKE ? OR name_hu LIKE ?",
                    (query, query))
    results.extend(rows_to_list(cursor.fetchall()))
    
    cursor.execute("SELECT id, name, name_en, 'galaxy' as type FROM galaxies WHERE name LIKE ? OR name_en LIKE ? OR id LIKE ?",
                    (query, query, query))
    results.extend(rows_to_list(cursor.fetchall()))
    
    cursor.execute("SELECT id, name, name_en, type, 'nebula' as obj_type FROM nebulae WHERE name LIKE ? OR name_en LIKE ? OR id LIKE ?",
                    (query, query, query))
    results.extend(rows_to_list(cursor.fetchall()))
    
    cursor.execute("SELECT id, name, host_star, 'exoplanet' as type FROM exoplanets WHERE name LIKE ? OR host_star LIKE ?",
                    (query, query))
    results.extend(rows_to_list(cursor.fetchall()))
    
    conn.close()
    return results

@router.get("/stats")
async def get_stats():
    """Adatbázis statisztika"""
    conn = get_db()
    cursor = conn.cursor()
    
    stats = {}
    for table in ['stars', 'constellations', 'solar_system', 'galaxies', 'nebulae', 'exoplanets']:
        try:
            cursor.execute(f'SELECT COUNT(*) FROM {table}')
            stats[table] = cursor.fetchone()[0]
        except:
            stats[table] = 0
    
    conn.close()
    return stats