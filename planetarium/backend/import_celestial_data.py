"""
🔭 CelestialData.js → planetarium.db Importáló
================================================
Ez a script a frontend celestialData.js fájl ÖSSZES adatát
importálja egyetlen SQLite adatbázisba.

Használat:
  cd C:\\SZAKDOGA3.0\\planetarium\\backend
  python import_celestial_data.py

Vagy megadott útvonallal:
  python import_celestial_data.py --js ../frontend/src/celestialData.js --db database/planetarium.db

Készítette: Mariotti Lili
"""

import sqlite3
import re
import json
import os
import argparse

def parse_js_array(content, var_name):
    """JavaScript tömb kinyerése export const ... = [...] formátumból"""
    pattern = rf'export\s+const\s+{var_name}\s*=\s*\['
    match = re.search(pattern, content)
    if not match:
        print(f"  ⚠️  {var_name} nem található")
        return []
    
    start = match.end() - 1
    depth = 0
    end = start
    for i in range(start, len(content)):
        if content[i] == '[':
            depth += 1
        elif content[i] == ']':
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    
    array_str = content[start:end]
    array_str = re.sub(r'(\w+):', r'"\1":', array_str)
    array_str = re.sub(r"'", '"', array_str)
    array_str = re.sub(r',\s*([\]}])', r'\1', array_str)
    array_str = array_str.replace('null', 'null')
    
    try:
        return json.loads(array_str)
    except json.JSONDecodeError as e:
        print(f"  ❌ JSON parse hiba {var_name}-nál: {e}")
        return parse_js_array_line_by_line(content, var_name)


def parse_js_object(content, var_name):
    """JavaScript objektum kinyerése export const ... = {...} formátumból"""
    pattern = rf'export\s+const\s+{var_name}\s*=\s*\{{'
    match = re.search(pattern, content)
    if not match:
        print(f"  ⚠️  {var_name} nem található")
        return {}
    
    start = match.end() - 1
    depth = 0
    end = start
    for i in range(start, len(content)):
        if content[i] == '{':
            depth += 1
        elif content[i] == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    
    obj_str = content[start:end]
    obj_str = re.sub(r'(\w+):', r'"\1":', obj_str)
    obj_str = re.sub(r"'", '"', obj_str)
    obj_str = re.sub(r',\s*}', '}', obj_str)
    
    try:
        return json.loads(obj_str)
    except json.JSONDecodeError as e:
        print(f"  ❌ JSON parse hiba {var_name}-nál: {e}")
        return {}

def parse_js_array_line_by_line(content, var_name):
    """Tartalék parser: soronként regex-szel"""
    results = []
    
    if var_name == 'brightStars':
        pattern = r'\{\s*id:\s*(\d+),\s*name:\s*(".*?"|null),\s*bayer:\s*(".*?"|null),\s*ra:\s*([\d.]+),\s*dec:\s*(-?[\d.]+),\s*mag:\s*([\d.-]+),\s*color:\s*"([^"]+)",\s*constellation:\s*(".*?"|null)'
        for m in re.finditer(pattern, content):
            results.append({
                'id': int(m.group(1)),
                'name': m.group(2).strip('"') if m.group(2) != 'null' else None,
                'bayer': m.group(3).strip('"') if m.group(3) != 'null' else None,
                'ra': float(m.group(4)),
                'dec': float(m.group(5)),
                'mag': float(m.group(6)),
                'color': m.group(7),
                'constellation': m.group(8).strip('"') if m.group(8) != 'null' else None,
            })
            rest = content[m.end():m.end()+100]
            hu_match = re.search(r'constellationHu:\s*"([^"]*)"', rest)
            if hu_match:
                results[-1]['constellationHu'] = hu_match.group(1)
    
    print(f"  ℹ️  {var_name}: {len(results)} rekord (line-by-line parser)")
    return results


def parse_galaxies(content):
    """Galaxisok kinyerése robusztus regex-szel"""
    results = []
    start_match = re.search(r'export\s+const\s+galaxies\s*=\s*\[', content)
    if not start_match:
        print("  ⚠️  galaxies nem található")
        return results
    
    section_start = start_match.end()
    depth = 1
    section_end = section_start
    for i in range(section_start, len(content)):
        if content[i] == '[':
            depth += 1
        elif content[i] == ']':
            depth -= 1
            if depth == 0:
                section_end = i
                break
    
    section = content[section_start:section_end]
    
    obj_pattern = r'(?:"|)id(?:"|):\s*"([^"]+)"'
    matches = list(re.finditer(obj_pattern, section))
    
    for idx, id_match in enumerate(matches):
        pos = id_match.start()
        obj_start = section.rfind('{', 0, pos)
        if obj_start == -1:
            continue
        
        if idx + 1 < len(matches):
            next_start = section.rfind('{', 0, matches[idx + 1].start())
            obj_end = next_start if next_start > obj_start else matches[idx + 1].start()
        else:
            obj_end = len(section)
        
        obj_text = section[obj_start:obj_end]
        
        def get_str(key):
            m = re.search(rf'(?:"|){key}(?:"|):\s*"([^"]*)"', obj_text)
            return m.group(1) if m else None
        
        def get_num(key):
            m = re.search(rf'(?:"|){key}(?:"|):\s*([\d.eE+-]+)', obj_text)
            return float(m.group(1)) if m else None
        
        gal_type = get_str('type')
        if gal_type and gal_type not in ('spiral', 'elliptical', 'irregular', 'lenticular', 'barred_spiral', 'dwarf', 'active'):
            continue
        
        gal = {
            'id': id_match.group(1),
            'name': get_str('name'),
            'nameEn': get_str('nameEn'),
            'type': gal_type,
            'ra': get_num('ra'),
            'dec': get_num('dec'),
            'magnitude': get_num('mag'),
            'distanceMly': None,
            'size_arcmin': get_num('size_arcmin'),
            'description': get_str('description'),
            'constellation': get_str('constellation'),
            'diameterLy': get_num('diameter_ly'),
            'starCount': get_str('starCount'),
        }
        
        dist_ly = get_num('distance_ly')
        if dist_ly:
            gal['distanceMly'] = round(dist_ly / 1e6, 3)
        
        if gal['name']:
            results.append(gal)
    
    print(f"  ℹ️  galaxies: {len(results)} rekord (regex parser)")
    return results

def parse_nebulae(content):
    """Ködök kinyerése — ezek JSON formátumúak"""
    return parse_nebulae_style(content, 'nebulaeData', 'köd')

def parse_nebulae_style(content, var_name, label):
    """JSON-formátumú tömb kinyerése (dupla idézőjeles kulcsok)"""
    results = []
    start_match = re.search(rf'export\s+const\s+{var_name}\s*=\s*\[', content)
    if not start_match:
        print(f"  ⚠️  {var_name} nem található")
        return results
    
    section_start = start_match.end()
    depth = 1
    section_end = section_start
    for i in range(section_start, len(content)):
        if content[i] == '[':
            depth += 1
        elif content[i] == ']':
            depth -= 1
            if depth == 0:
                section_end = i
                break
    
    section = '[' + content[section_start:section_end] + ']'
    
    section = re.sub(r'//.*$', '', section, flags=re.MULTILINE)
    section = re.sub(r',\s*([\]}])', r'\1', section)
    
    try:
        raw = json.loads(section)
        for n in raw:
            entry = {}
            for k, v in n.items():
                entry[k] = v
            results.append(entry)
    except json.JSONDecodeError as e:
        print(f"  ❌ {var_name} JSON hiba: {e}")
        for m in re.finditer(r'"id":\s*"([^"]+)"', section):
            pos = m.start()
            obj_start = section.rfind('{', 0, pos)
            next_obj = re.search(r'"id":', section[pos + 5:])
            obj_end = pos + 5 + next_obj.start() if next_obj else len(section)
            obj_text = section[obj_start:obj_end]
            
            def gs(key):
                mx = re.search(rf'"{key}":\s*"([^"]*)"', obj_text)
                return mx.group(1) if mx else None
            def gn(key):
                mx = re.search(rf'"{key}":\s*([\d.eE+-]+)', obj_text)
                return float(mx.group(1)) if mx else None
            
            results.append({
                'id': m.group(1), 'name': gs('name'), 'nameEn': gs('nameEn'),
                'type': gs('type'), 'ra': gn('ra'), 'dec': gn('dec'),
                'distance_ly': gn('distance_ly'), 'mag': gn('mag'),
                'size_arcmin': gn('size_arcmin'), 'description': gs('description'),
                'constellation': gs('constellation'), 'color': gs('color'),
            })
    
    print(f"  ℹ️  {var_name}: {len(results)} {label}")
    return results

def create_tables(cursor):
    """Összes tábla létrehozása (DROP + CREATE)"""
    
    cursor.executescript("""
        -- Régi táblák törlése
        DROP TABLE IF EXISTS stars;
        DROP TABLE IF EXISTS constellations;
        DROP TABLE IF EXISTS solar_system;
        DROP TABLE IF EXISTS galaxies;
        DROP TABLE IF EXISTS nebulae;
        DROP TABLE IF EXISTS exoplanets;
        DROP TABLE IF EXISTS deep_sky_objects;
        
        -- Csillagok
        CREATE TABLE stars (
            id INTEGER PRIMARY KEY,
            name TEXT,
            bayer TEXT,
            ra REAL NOT NULL,
            dec REAL NOT NULL,
            mag REAL NOT NULL,
            color TEXT,
            constellation TEXT,
            constellation_hu TEXT
        );
        CREATE INDEX idx_stars_mag ON stars(mag);
        CREATE INDEX idx_stars_constellation ON stars(constellation);
        
        -- Csillagképek
        CREATE TABLE constellations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            name_hu TEXT,
            label_ra REAL,
            label_dec REAL,
            lines TEXT NOT NULL  -- JSON array: [[starId1, starId2], ...]
        );
        
        -- Naprendszer (Nap + bolygók + Hold)
        CREATE TABLE solar_system (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,  -- 'star', 'planet', 'moon'
            color TEXT,
            glow_color TEXT,
            size REAL,
            orbital_period REAL,
            distance REAL,
            eccentricity REAL,
            longitude_of_perihelion REAL,
            mean_longitude REAL,
            description TEXT,
            texture TEXT,
            diameter_km REAL,
            mass_kg REAL,
            rotation_period REAL,
            axial_tilt REAL,
            moons INTEGER
        );
        
        -- Galaxisok
        CREATE TABLE galaxies (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            name_en TEXT,
            type TEXT,
            ra REAL,
            dec REAL,
            distance_mly REAL,
            magnitude REAL,
            size_arcmin REAL,
            description TEXT,
            constellation TEXT,
            diameter_ly INTEGER,
            star_count TEXT,
            color_scheme TEXT,    -- JSON
            special_features TEXT -- JSON array
        );
        CREATE INDEX idx_galaxies_ra_dec ON galaxies(ra, dec);
        
        -- Ködök
        CREATE TABLE nebulae (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            name_en TEXT,
            type TEXT,
            ra REAL,
            dec REAL,
            distance_ly REAL,
            magnitude REAL,
            size_arcmin REAL,
            description TEXT,
            constellation TEXT,
            color TEXT,
            glow_color TEXT,
            star_forming INTEGER DEFAULT 0
        );
        CREATE INDEX idx_nebulae_type ON nebulae(type);
        
        -- Exobolygók
        CREATE TABLE exoplanets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            host_star TEXT,
            ra REAL,
            dec REAL,
            distance_ly REAL,
            mass_earth REAL,
            radius_earth REAL,
            orbital_period_days REAL,
            equilibrium_temp_k REAL,
            discovery_year INTEGER,
            discovery_method TEXT,
            description TEXT,
            constellation TEXT,
            is_habitable_zone INTEGER DEFAULT 0,
            star_type TEXT,
            semi_major_axis REAL
        );
        
        -- Deep-sky objektumok (egyéb)
        CREATE TABLE deep_sky_objects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT,
            ra REAL,
            dec REAL,
            magnitude REAL,
            size_arcmin REAL,
            description TEXT,
            constellation TEXT
        );
    """)
    print("✅ Táblák létrehozva")

def import_stars(cursor, stars):
    """Csillagok importálása"""
    for s in stars:
        cursor.execute("""
            INSERT OR REPLACE INTO stars (id, name, bayer, ra, dec, mag, color, constellation, constellation_hu)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            s.get('id'), s.get('name'), s.get('bayer'),
            s.get('ra'), s.get('dec'), s.get('mag'),
            s.get('color'), s.get('constellation'), s.get('constellationHu')
        ))
    print(f"  ⭐ {len(stars)} csillag importálva")

def import_constellations(cursor, constellations):
    """Csillagképek importálása"""
    for c in constellations:
        lines_json = json.dumps(c.get('lines', []))
        label_pos = c.get('labelPos', {})
        cursor.execute("""
            INSERT OR REPLACE INTO constellations (name, name_hu, label_ra, label_dec, lines)
            VALUES (?, ?, ?, ?, ?)
        """, (
            c.get('name'), c.get('nameHu'),
            label_pos.get('ra'), label_pos.get('dec'),
            lines_json
        ))
    print(f"  ✨ {len(constellations)} csillagkép importálva")

def import_solar_system(cursor, sun, planets_list, moon):
    """Naprendszer importálása"""
    count = 0
    
    if sun:
        cursor.execute("""
            INSERT OR REPLACE INTO solar_system 
            (id, name, type, color, glow_color, size, description)
            VALUES (?, ?, 'star', ?, ?, ?, ?)
        """, (sun.get('id', 'sun'), sun.get('name', 'Nap'), 
              sun.get('color'), sun.get('glowColor'), sun.get('size'),
              sun.get('description')))
        count += 1
    
    for p in planets_list:
        cursor.execute("""
            INSERT OR REPLACE INTO solar_system 
            (id, name, type, color, size, orbital_period, distance, eccentricity,
             longitude_of_perihelion, mean_longitude, description, texture,
             diameter_km, mass_kg, rotation_period, axial_tilt, moons)
            VALUES (?, ?, 'planet', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            p.get('id'), p.get('name'), p.get('color'), p.get('size'),
            p.get('orbitalPeriod'), p.get('distance'), p.get('eccentricity'),
            p.get('longitudeOfPerihelion'), p.get('meanLongitude'),
            p.get('description'), p.get('texture'),
            p.get('diameterKm'), p.get('massKg'),
            p.get('rotationPeriod'), p.get('axialTilt'), p.get('moons')
        ))
        count += 1
    
    if moon:
        cursor.execute("""
            INSERT OR REPLACE INTO solar_system 
            (id, name, type, color, glow_color, size, description, distance, orbital_period)
            VALUES (?, ?, 'moon', ?, ?, ?, ?, ?, ?)
        """, (moon.get('id', 'moon'), moon.get('name', 'Hold'),
              moon.get('color'), moon.get('glowColor'), moon.get('size'),
              moon.get('description'), moon.get('distance'), moon.get('orbitalPeriod')))
        count += 1
    
    print(f"  🪐 {count} naprendszer objektum importálva")

def import_galaxies(cursor, galaxies):
    """Galaxisok importálása"""
    for g in galaxies:
        color_scheme = json.dumps(g.get('colorScheme')) if g.get('colorScheme') else None
        special = json.dumps(g.get('specialFeatures') or g.get('special_features')) if (g.get('specialFeatures') or g.get('special_features')) else None
        
        dist_mly = g.get('distanceMly')
        if not dist_mly and g.get('distance_ly'):
            dist_mly = round(g['distance_ly'] / 1e6, 3)
        
        magnitude = g.get('magnitude') or g.get('mag')
        size = g.get('size_arcmin') or g.get('sizeArcmin')
        diameter = g.get('diameterLy') or g.get('diameter_ly')
        star_count = g.get('starCount') or g.get('star_count')
        name_en = g.get('nameEn') or g.get('name_en')
        
        cursor.execute("""
            INSERT OR REPLACE INTO galaxies 
            (id, name, name_en, type, ra, dec, distance_mly, magnitude, size_arcmin,
             description, constellation, diameter_ly, star_count, color_scheme, special_features)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            g.get('id'), g.get('name'), name_en, g.get('type'),
            g.get('ra'), g.get('dec'), dist_mly, magnitude, size,
            g.get('description'), g.get('constellation'),
            diameter, star_count, color_scheme, special
        ))
    print(f"  🌌 {len(galaxies)} galaxis importálva")

def import_nebulae(cursor, nebulae):
    """Ködök importálása"""
    for n in nebulae:
        cursor.execute("""
            INSERT OR REPLACE INTO nebulae 
            (id, name, name_en, type, ra, dec, distance_ly, magnitude, size_arcmin,
             description, constellation, color, glow_color, star_forming)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            n.get('id'), n.get('name'), n.get('nameEn') or n.get('name_en'),
            n.get('type'), n.get('ra'), n.get('dec'),
            n.get('distanceLy') or n.get('distance_ly'),
            n.get('magnitude') or n.get('mag'),
            n.get('size_arcmin') or n.get('sizeArcmin'),
            n.get('description'), n.get('constellation'),
            n.get('color'), n.get('glowColor') or n.get('glow_color'),
            1 if n.get('starForming') or n.get('star_forming') else 0
        ))
    print(f"  🌫️ {len(nebulae)} köd importálva")

def import_exoplanets(cursor, exoplanets):
    """Exobolygók importálása"""
    for e in exoplanets:
        cursor.execute("""
            INSERT OR REPLACE INTO exoplanets 
            (id, name, host_star, ra, dec, distance_ly, mass_earth, radius_earth,
             orbital_period_days, equilibrium_temp_k, discovery_year, discovery_method,
             description, constellation, is_habitable_zone, star_type, semi_major_axis)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            e.get('id'), e.get('name'), e.get('hostStar'),
            e.get('ra'), e.get('dec'), e.get('distanceLy'),
            e.get('massEarth'), e.get('radiusEarth'),
            e.get('orbitalPeriodDays'), e.get('equilibriumTempK'),
            e.get('discoveryYear'), e.get('discoveryMethod'),
            e.get('description'), e.get('constellation'),
            1 if e.get('isHabitableZone') else 0,
            e.get('starType'), e.get('semiMajorAxis')
        ))
    print(f"  🌍 {len(exoplanets)} exobolygó importálva")

def import_deep_sky(cursor, objects):
    """Deep-sky objektumok importálása"""
    for o in objects:
        cursor.execute("""
            INSERT OR REPLACE INTO deep_sky_objects 
            (id, name, type, ra, dec, magnitude, size_arcmin, description, constellation)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            o.get('id'), o.get('name'), o.get('type'),
            o.get('ra'), o.get('dec'), o.get('magnitude'),
            o.get('size_arcmin'), o.get('description'), o.get('constellation')
        ))
    print(f"  🔭 {len(objects)} deep-sky objektum importálva")

def main():
    parser = argparse.ArgumentParser(description='CelestialData.js → planetarium.db importáló')
    parser.add_argument('--js', default='../frontend/src/celestialData.js', help='celestialData.js útvonal')
    parser.add_argument('--db', default='database/planetarium.db', help='planetarium.db útvonal')
    args = parser.parse_args()
    
    js_path = args.js
    db_path = args.db
    
    print("=" * 55)
    print("🔭 CELESTIALDATA.JS → PLANETARIUM.DB IMPORTÁLÁS")
    print("=" * 55)
    
    if not os.path.exists(js_path):
        print(f"❌ Fájl nem található: {js_path}")
        print(f"   Használat: python import_celestial_data.py --js <útvonal>")
        return
    
    db_dir = os.path.dirname(db_path)
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir)
        print(f"📁 Mappa létrehozva: {db_dir}")
    
    print(f"\n📄 Forrásfájl: {js_path}")
    with open(js_path, 'r', encoding='utf-8') as f:
        content = f.read()
    print(f"   Méret: {len(content) / 1024:.1f} KB")
    
    print("\n📊 Adatok kinyerése...")
    
    stars = parse_js_array_line_by_line(content, 'brightStars')
    
    constellations = []
    const_pattern = r'\{\s*name:\s*"([^"]+)",\s*nameHu:\s*"([^"]+)",\s*labelPos:\s*\{\s*ra:\s*([\d.-]+),\s*dec:\s*([\d.-]+)\s*\},\s*lines:\s*(\[.*?\])\s*\}'
    for m in re.finditer(const_pattern, content, re.DOTALL):
        lines_str = m.group(5)
        lines = json.loads(lines_str)
        constellations.append({
            'name': m.group(1),
            'nameHu': m.group(2),
            'labelPos': {'ra': float(m.group(3)), 'dec': float(m.group(4))},
            'lines': lines
        })
    print(f"  ℹ️  constellationData: {len(constellations)} rekord")
    
    sun_data = parse_js_object(content, 'sunData')
    planets_data = parse_js_array(content, 'planets')
    moon_data = parse_js_object(content, 'moonData')
    deep_sky = parse_js_array(content, 'deepSkyObjects')
    galaxies = parse_galaxies(content)
    all_galaxies = parse_nebulae_style(content, 'allGalaxies', 'galaxis')

    gal_by_id = {g['id']: g for g in galaxies}
    for g in all_galaxies:
        if g['id'] not in gal_by_id:
            gal_by_id[g['id']] = g
    galaxies = list(gal_by_id.values())
    print(f"  ℹ️  galaxies összesen (merge): {len(galaxies)}")
    
    nebulae = parse_nebulae(content)
    exoplanets = parse_js_array(content, 'exoplanetsData')
    
    print(f"\n💾 Adatbázis: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("PRAGMA journal_mode=WAL")
    
    print("\n🔨 Táblák létrehozása...")
    create_tables(cursor)
    
    print("\n📥 Adatok importálása...")
    if stars:
        import_stars(cursor, stars)
    if constellations:
        import_constellations(cursor, constellations)
    import_solar_system(cursor, sun_data, planets_data or [], moon_data)
    if galaxies:
        import_galaxies(cursor, galaxies)
    if nebulae:
        import_nebulae(cursor, nebulae)
    if exoplanets:
        import_exoplanets(cursor, exoplanets)
    if deep_sky:
        import_deep_sky(cursor, deep_sky)
    
    conn.commit()
    
    print("\n" + "=" * 55)
    print("📊 ADATBÁZIS STATISZTIKA")
    print("=" * 55)
    
    tables = ['stars', 'constellations', 'solar_system', 'galaxies', 'nebulae', 'exoplanets', 'deep_sky_objects']
    icons = {'stars': '⭐', 'constellations': '✨', 'solar_system': '🪐', 
             'galaxies': '🌌', 'nebulae': '🌫️', 'exoplanets': '🌍', 'deep_sky_objects': '🔭'}
    
    total = 0
    for table in tables:
        cursor.execute(f'SELECT COUNT(*) FROM {table}')
        count = cursor.fetchone()[0]
        total += count
        print(f"  {icons.get(table, '📋')} {table:.<25} {count:>5} rekord")
    
    print(f"  {'─' * 38}")
    print(f"  {'ÖSSZESEN':.<25} {total:>5} rekord")
    
    db_size = os.path.getsize(db_path)
    print(f"\n  💾 Adatbázis méret: {db_size / 1024:.1f} KB")
    
    conn.close()
    print("\n✅ Importálás kész!")
    print(f"   Minden adat egy helyen: {db_path}")

if __name__ == '__main__':
    main()