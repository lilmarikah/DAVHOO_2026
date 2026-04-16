"""
🌟 Hipparcos Csillagkatalógus Importáló
========================================
Letölti és importálja a Hipparcos katalógust az SQLite adatbázisba.

Használat:
  1. Töltsd le a katalógust (lásd lent)
  2. Futtasd: python import_hipparcos.py

Forrás: Vizier / CDS Strasbourg
  A Hipparcos katalógus ~118,000 csillagot tartalmaz mag ~12-ig.
  
  LETÖLTÉSI LEHETŐSÉGEK:
  =====================
  
  ★ AJÁNLOTT (legegyszerűbb): Yale Bright Star Catalog + Hipparcos kombi
    https://github.com/astronexus/HYG-Database/blob/master/hyg/v4/hyg_v40.csv
    → Ez a HYG v4 adatbázis, ~120,000 csillag, nevekkel, Bayer/Flamsteed jelölésekkel
    → Mentsd el mint: hyg_v40.csv a backend/database/ mappába
  
  ★ ALTERNATÍVA: Csak a fényes csillagok (BSC5 - Yale Bright Star Catalog)
    https://github.com/astronexus/HYG-Database/blob/master/hyg/v4/hyg_v40.csv
    → Szűrd mag < 6.5-re

  ★ ALTERNATÍVA 2: Eredeti Hipparcos
    https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239
    → Bonyolultabb formátum, az alábbi szkript a HYG CSV-t használja

Készítette: Mariotti Lili
Témavezető: Kovács Ádám
"""

import sqlite3
import csv
import os
import sys

DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'planetarium.db')

IAU_NAMES = {
    "Sirius": 32349, "Canopus": 30438, "Arcturus": 69673, "Vega": 91262,
    "Capella": 24608, "Rigel": 24436, "Procyon": 37279, "Betelgeuse": 27989,
    "Altair": 97649, "Aldebaran": 21421, "Spica": 65474, "Antares": 80763,
    "Pollux": 37826, "Fomalhaut": 113368, "Deneb": 102098, "Regulus": 49669,
    "Castor": 36850, "Bellatrix": 25336, "Alnath": 25428, "Mizar": 65378,
    "Dubhe": 54061, "Alkaid": 67301, "Polaris": 11767, "Alioth": 62956,
    "Mirfak": 15863, "Wezen": 34444, "Sargas": 86228, "Kaus Australis": 90185,
    "Avior": 41037, "Alhena": 31681, "Peacock": 100751, "Alsephina": 33856,
    "Mirzam": 25606, "Alphard": 46390, "Hamal": 9884, "Algieba": 50583,
    "Diphda": 3419, "Nunki": 92855, "Menkent": 68933, "Saiph": 27366,
    "Schedar": 3179, "Eltanin": 87833, "Mintaka": 25930, "Caph": 746,
    "Izar": 72105, "Enif": 107315, "Scheat": 113881, "Markab": 113963,
    "Alderamin": 105199, "Rasalhague": 86032, "Kochab": 72607, "Algol": 14576,
    "Denebola": 57632, "Acrux": 60718, "Gacrux": 61084, "Mimosa": 62434,
}

def spectral_to_color(sp):
    if not sp:
        return '#ffffff'
    sp = sp.strip().upper()
    if sp.startswith('O'):
        return '#9bb0ff'
    elif sp.startswith('B'):
        return '#aabfff'
    elif sp.startswith('A'):
        return '#cad7ff'
    elif sp.startswith('F'):
        return '#f8f7ff'
    elif sp.startswith('G'):
        return '#fff4ea'
    elif sp.startswith('K'):
        return '#ffd2a1'
    elif sp.startswith('M'):
        return '#ffcc6f'
    else:
        return '#ffffff'

def import_hyg_catalog(csv_path, mag_limit=7.0):
    """
    HYG v4 CSV importálása
    
    CSV oszlopok (HYG v4):
      id, hip, hd, hr, gl, bf, proper, ra, dec, dist, pmra, pmdec,
      rv, mag, absmag, spect, ci, x, y, z, vx, vy, vz,
      rarad, decrad, pmrarad, pmdecrad, bayer, flam, con, comp, comp_primary,
      base, lum, var, var_min, var_max
    """
    if not os.path.exists(csv_path):
        print(f"❌ Fájl nem található: {csv_path}")
        print()
        print("📥 LETÖLTÉSI ÚTMUTATÓ:")
        print("=" * 50)
        print()
        print("1. Nyisd meg ezt a linket a böngészőben:")
        print("   https://github.com/astronexus/HYG-Database")
        print()
        print("2. Kattints a 'hyg/v4/hyg_v40.csv' fájlra")
        print()
        print("3. Kattints a 'Download raw file' gombra")
        print()
        print("4. Mentsd el ebbe a mappába:")
        print(f"   {os.path.dirname(os.path.abspath(csv_path))}")
        print(f"   Fájlnév: {os.path.basename(csv_path)}")
        print()
        print("5. Futtasd újra ezt a szkriptet!")
        return
    
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, name, description FROM stars")
    existing = {row[0]: {'name': row[1], 'desc': row[2]} for row in cursor.fetchall()}
    print(f"📊 Meglévő csillagok: {len(existing)}")
    
    cursor.execute("DROP TABLE IF EXISTS stars_backup")
    cursor.execute("ALTER TABLE stars RENAME TO stars_backup")
    
    cursor.execute('''
        CREATE TABLE stars (
            id INTEGER PRIMARY KEY,
            hip INTEGER,
            hd INTEGER,
            name TEXT,
            proper_name TEXT,
            bayer TEXT,
            flamsteed TEXT,
            ra REAL NOT NULL,
            dec REAL NOT NULL,
            mag REAL NOT NULL,
            absolute_mag REAL,
            color TEXT,
            constellation TEXT,
            spectral_type TEXT,
            distance_ly REAL,
            luminosity REAL,
            color_index REAL,
            description TEXT
        )
    ''')
    
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_stars_mag ON stars(mag)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_stars_constellation ON stars(constellation)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_stars_name ON stars(name)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_stars_hip ON stars(hip)')
    
    hip_to_iau = {}
    for name, hip in IAU_NAMES.items():
        hip_to_iau[hip] = name
    
    imported = 0
    skipped = 0
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        batch = []
        
        for row in reader:
            try:
                mag = float(row.get('mag', 99))
                if mag > mag_limit:
                    skipped += 1
                    continue
                
                ra = float(row.get('ra', 0))
                dec = float(row.get('dec', 0))
                
                if ra == 0 and dec == 0:
                    continue
                
                if ra > 24:
                    ra = ra / 15.0
                
                star_id = int(row.get('id', 0)) or imported + 100000
                hip = int(row.get('hip', 0)) if row.get('hip') else None
                hd = int(row.get('hd', 0)) if row.get('hd') else None
                
                proper = row.get('proper', '').strip()
                bayer = row.get('bf', '').strip() or row.get('bayer', '').strip()
                flamsteed = row.get('flam', '').strip()
                
                if hip and hip in hip_to_iau:
                    proper = hip_to_iau[hip]
                
                if star_id in existing and existing[star_id]['name']:
                    proper = existing[star_id]['name']
                
                name = proper or None
                
                con = row.get('con', '').strip() or None
                spect = row.get('spect', '').strip() or None
                color = spectral_to_color(spect)
                
                dist_pc = float(row.get('dist', 0)) if row.get('dist') else None
                dist_ly = dist_pc * 3.26156 if dist_pc and dist_pc > 0 else None
                
                absmag = float(row.get('absmag', 0)) if row.get('absmag') else None
                lum = float(row.get('lum', 0)) if row.get('lum') else None
                ci = float(row.get('ci', 0)) if row.get('ci') else None
                
                desc = existing.get(star_id, {}).get('desc')
                
                batch.append((
                    star_id, hip, hd, name, proper, bayer, flamsteed,
                    ra, dec, mag, absmag, color, con, spect,
                    dist_ly, lum, ci, desc
                ))
                imported += 1
                
                if len(batch) >= 5000:
                    cursor.executemany('''
                        INSERT OR REPLACE INTO stars 
                        (id, hip, hd, name, proper_name, bayer, flamsteed,
                         ra, dec, mag, absolute_mag, color, constellation,
                         spectral_type, distance_ly, luminosity, color_index, description)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', batch)
                    batch = []
                    print(f"  ... {imported} csillag importálva")
                    
            except (ValueError, TypeError) as e:
                skipped += 1
                continue
        
        if batch:
            cursor.executemany('''
                INSERT OR REPLACE INTO stars 
                (id, hip, hd, name, proper_name, bayer, flamsteed,
                 ra, dec, mag, absolute_mag, color, constellation,
                 spectral_type, distance_ly, luminosity, color_index, description)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', batch)
    
    cursor.execute("DROP TABLE IF EXISTS stars_backup")
    
    conn.commit()
    
    cursor.execute("SELECT COUNT(*) FROM stars")
    total = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM stars WHERE name IS NOT NULL AND name != ''")
    named = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM stars WHERE spectral_type IS NOT NULL")
    with_spect = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM stars WHERE distance_ly IS NOT NULL")
    with_dist = cursor.fetchone()[0]
    cursor.execute("SELECT MIN(mag), MAX(mag) FROM stars")
    mag_range = cursor.fetchone()
    
    conn.close()
    
    print()
    print("=" * 50)
    print(f"✅ Hipparcos import kész!")
    print(f"   Összes csillag: {total}")
    print(f"   Névvel rendelkező: {named}")
    print(f"   Spektráltípussal: {with_spect}")
    print(f"   Távolsággal: {with_dist}")
    print(f"   Magnitúdó tartomány: {mag_range[0]:.2f} - {mag_range[1]:.2f}")
    print(f"   Kihagyott (túl halvány): {skipped}")
    print(f"   Adatbázis: {DATABASE_PATH}")

if __name__ == '__main__':
    csv_path = os.path.join(os.path.dirname(__file__), 'hyg_v40.csv')
    
    if len(sys.argv) > 1:
        csv_path = sys.argv[1]
    
    mag_limit = 7.0
    if len(sys.argv) > 2:
        mag_limit = float(sys.argv[2])
    
    print(f"🔭 Hipparcos/HYG csillagkatalógus importálás")
    print(f"   CSV: {csv_path}")
    print(f"   Magnitúdó limit: {mag_limit}")
    print()
    
    import_hyg_catalog(csv_path, mag_limit)