import sqlite3
import json
import re
import os
from init_database import (
    DATABASE_PATH, create_database, 
    insert_stars, insert_planets, insert_galaxies,
    insert_deep_sky_objects, insert_constellations,
    insert_sun_data, insert_moon_data
)

def parse_js_array(js_content, array_name):

    pattern = rf'export\s+const\s+{array_name}\s*=\s*\[(.*?)\];'
    match = re.search(pattern, js_content, re.DOTALL)
    
    if not match:
        print(f"⚠️ Nem található: {array_name}")
        return []
    
    array_content = match.group(1)
    array_content = re.sub(r'(\w+):', r'"\1":', array_content)
    array_content = re.sub(r',\s*}', '}', array_content)
    array_content = re.sub(r',\s*]', ']', array_content)
    array_content = re.sub(r'//.*?\n', '\n', array_content)
    array_content = re.sub(r'/\*.*?\*/', '', array_content, flags=re.DOTALL)
    
    try:
        data = json.loads(f'[{array_content}]')
        print(f"✅ {array_name}: {len(data)} elem beolvasva")
        return data
    except json.JSONDecodeError as e:
        print(f"❌ JSON hiba {array_name}-nál: {e}")
        return parse_js_objects_manually(array_content)

def parse_js_objects_manually(content):

    objects = []
    depth = 0
    start = -1
    
    for i, char in enumerate(content):
        if char == '{':
            if depth == 0:
                start = i
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0 and start != -1:
                obj_str = content[start:i+1]
                try:
                    obj_str = re.sub(r'(\w+):', r'"\1":', obj_str)
                    obj_str = re.sub(r',\s*}', '}', obj_str)
                    obj = json.loads(obj_str)
                    objects.append(obj)
                except:
                    pass
                start = -1
    
    return objects

def import_from_celestial_data(js_file_path):

    print(f"\n📖 Beolvasás: {js_file_path}")
    
    with open(js_file_path, 'r', encoding='utf-8') as f:
        js_content = f.read()
    
    create_database()
    
    stars = parse_js_array(js_content, 'brightStars')
    if stars:
        insert_stars(stars)
    
    planets = parse_js_array(js_content, 'planets')
    if planets:
        insert_planets(planets)
    
    constellations = parse_js_array(js_content, 'constellationData')
    if constellations:
        insert_constellations(constellations)
    
    galaxies = parse_js_array(js_content, 'galaxies')
    if galaxies:
        insert_galaxies(galaxies)
    
    dso = parse_js_array(js_content, 'deepSkyObjectsExtended')
    if dso:
        insert_deep_sky_objects(dso)
    
    insert_sun_data()
    insert_moon_data()
    
    print(f"\n✅ Import kész! Adatbázis: {DATABASE_PATH}")
    
    show_statistics()

def show_statistics():

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    print("\n📊 Adatbázis statisztika:")
    print("-" * 40)
    
    tables = ['stars', 'planets', 'constellations', 'galaxies', 'deep_sky_objects', 'sun', 'earth_moon']
    
    for table in tables:
        try:
            cursor.execute(f'SELECT COUNT(*) FROM {table}')
            count = cursor.fetchone()[0]
            print(f"  {table}: {count} rekord")
        except:
            print(f"  {table}: -")
    
    conn.close()

if __name__ == '__main__':
    import sys
    
    js_path = '../src/celestialData.js'
    
    if len(sys.argv) > 1:
        js_path = sys.argv[1]
    
    if os.path.exists(js_path):
        import_from_celestial_data(js_path)
    else:
        print(f"❌ Fájl nem található: {js_path}")
        print("Használat: python import_data.py <celestialData.js útvonal>")