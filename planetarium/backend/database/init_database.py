import sqlite3
import json
import os

DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'planetarium.db')

def create_database():

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS stars (
            id INTEGER PRIMARY KEY,
            name TEXT,
            bayer TEXT,
            ra REAL NOT NULL,
            dec REAL NOT NULL,
            mag REAL NOT NULL,
            color TEXT,
            constellation TEXT,
            spectral_type TEXT,
            distance_ly REAL,
            absolute_mag REAL,
            description TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS constellations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            name_hu TEXT,
            name_latin TEXT,
            abbreviation TEXT,
            description TEXT,
            mythology TEXT,
            best_season TEXT,
            lines_json TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS planets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            name_hu TEXT,
            type TEXT,
            color TEXT,
            size REAL,
            orbital_period_days REAL,
            rotation_period_hours REAL,
            distance_au REAL,
            diameter_km REAL,
            mass_earth REAL,
            moons_count INTEGER,
            has_rings INTEGER,
            mean_temp_celsius REAL,
            description TEXT,
            texture_url TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS moons (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            name_hu TEXT,
            parent_planet TEXT,
            orbital_period_days REAL,
            diameter_km REAL,
            distance_km REAL,
            description TEXT,
            FOREIGN KEY (parent_planet) REFERENCES planets(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS galaxies (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            name_en TEXT,
            alt_names TEXT,
            ra REAL NOT NULL,
            dec REAL NOT NULL,
            mag REAL,
            type TEXT,
            classification TEXT,
            constellation TEXT,
            distance_ly REAL,
            diameter_ly REAL,
            size_arcmin REAL,
            description TEXT,
            color TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS deep_sky_objects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            name_en TEXT,
            alt_names TEXT,
            ra REAL NOT NULL,
            dec REAL NOT NULL,
            mag REAL,
            type TEXT,
            object_type TEXT,
            constellation TEXT,
            distance_ly REAL,
            size_arcmin REAL,
            description TEXT,
            color TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sun (
            id TEXT PRIMARY KEY DEFAULT 'sun',
            name TEXT DEFAULT 'Nap',
            name_en TEXT DEFAULT 'Sun',
            spectral_type TEXT DEFAULT 'G2V',
            diameter_km REAL,
            mass_earth REAL,
            surface_temp_celsius REAL,
            core_temp_celsius REAL,
            age_billion_years REAL,
            description TEXT
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS earth_moon (
            id TEXT PRIMARY KEY DEFAULT 'moon',
            name TEXT DEFAULT 'Hold',
            name_en TEXT DEFAULT 'Moon',
            diameter_km REAL,
            distance_km REAL,
            orbital_period_days REAL,
            rotation_period_days REAL,
            mass_earth REAL,
            surface_gravity REAL,
            description TEXT
        )
    ''')
    
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_stars_constellation ON stars(constellation)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_stars_mag ON stars(mag)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_stars_name ON stars(name)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_galaxies_constellation ON galaxies(constellation)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_dso_type ON deep_sky_objects(type)')
    
    conn.commit()
    conn.close()
    print(f"✅ Adatbázis létrehozva: {DATABASE_PATH}")

def insert_stars(stars_data):

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    cursor.executemany('''
        INSERT OR REPLACE INTO stars 
        (id, name, bayer, ra, dec, mag, color, constellation)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', [(s['id'], s.get('name'), s.get('bayer'), s['ra'], s['dec'], 
           s['mag'], s.get('color'), s.get('constellation')) for s in stars_data])
    
    conn.commit()
    conn.close()
    print(f"✅ {len(stars_data)} csillag beszúrva")

def insert_planets(planets_data):

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    for p in planets_data:
        cursor.execute('''
            INSERT OR REPLACE INTO planets 
            (id, name, name_hu, type, color, size, orbital_period_days, 
             diameter_km, mass_earth, moons_count, has_rings, mean_temp_celsius, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (p['id'], p['name'], p.get('nameHu'), p.get('type'), p.get('color'),
              p.get('size'), p.get('orbitalPeriod'), p.get('diameter_km'),
              p.get('mass_earth'), p.get('moons_count'), p.get('has_rings', 0),
              p.get('mean_temp'), p.get('description')))
    
    conn.commit()
    conn.close()
    print(f"✅ {len(planets_data)} bolygó beszúrva")

def insert_galaxies(galaxies_data):

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    for g in galaxies_data:
        cursor.execute('''
            INSERT OR REPLACE INTO galaxies 
            (id, name, name_en, alt_names, ra, dec, mag, type, classification,
             constellation, distance_ly, diameter_ly, size_arcmin, description, color)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (g['id'], g['name'], g.get('nameEn'), 
              json.dumps(g.get('altNames', [])), g['ra'], g['dec'],
              g.get('mag'), g.get('type'), g.get('classification'),
              g.get('constellation'), g.get('distance_ly'), g.get('diameter_ly'),
              g.get('size_arcmin'), g.get('description'), g.get('color')))
    
    conn.commit()
    conn.close()
    print(f"✅ {len(galaxies_data)} galaxis beszúrva")

def insert_deep_sky_objects(dso_data):

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    for d in dso_data:
        cursor.execute('''
            INSERT OR REPLACE INTO deep_sky_objects 
            (id, name, name_en, alt_names, ra, dec, mag, type, object_type,
             constellation, distance_ly, size_arcmin, description, color)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (d['id'], d['name'], d.get('nameEn'),
              json.dumps(d.get('altNames', [])), d['ra'], d['dec'],
              d.get('mag'), d.get('type'), d.get('objectType'),
              d.get('constellation'), d.get('distance_ly'),
              d.get('size_arcmin'), d.get('description'), d.get('color')))
    
    conn.commit()
    conn.close()
    print(f"✅ {len(dso_data)} deep sky objektum beszúrva")

def insert_constellations(const_data):

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    for i, c in enumerate(const_data):
        const_id = c.get('id') or c.get('name', f'const_{i}').lower().replace(' ', '_')
        
        cursor.execute('''
            INSERT OR REPLACE INTO constellations 
            (id, name, name_hu, abbreviation, description, lines_json)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (const_id, c.get('name', ''), c.get('nameHu'), c.get('abbreviation'),
              c.get('description'), json.dumps(c.get('lines', []))))
    
    conn.commit()
    conn.close()
    print(f"✅ {len(const_data)} csillagkép beszúrva")

def insert_sun_data():

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT OR REPLACE INTO sun 
        (id, name, name_en, spectral_type, diameter_km, mass_earth, 
         surface_temp_celsius, core_temp_celsius, age_billion_years, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', ('sun', 'Nap', 'Sun', 'G2V', 1392700, 333000,
          5500, 15000000, 4.6,
          'A Naprendszer központi csillaga. Sárga törpe, amely hidrogént alakít héliummá fúzióval.'))
    
    conn.commit()
    conn.close()
    print("✅ Nap adatok beszúrva")

def insert_moon_data():

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT OR REPLACE INTO earth_moon 
        (id, name, name_en, diameter_km, distance_km, orbital_period_days,
         rotation_period_days, mass_earth, surface_gravity, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', ('moon', 'Hold', 'Moon', 3474, 384400, 27.3,
          27.3, 0.0123, 1.62,
          'A Föld egyetlen természetes holdja. Kötött rotációja van, mindig ugyanazt az oldalát mutatja felénk.'))
    
    conn.commit()
    conn.close()
    print("✅ Hold adatok beszúrva")

if __name__ == '__main__':
    create_database()
    insert_sun_data()
    insert_moon_data()
    print("\n🌟 Adatbázis inicializálva!")
    print(f"📁 Fájl: {DATABASE_PATH}")