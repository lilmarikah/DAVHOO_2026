import pytest
import sqlite3
import os
import json

DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'planetarium.db')


@pytest.fixture
def db():

    assert os.path.exists(DATABASE_PATH), f"Adatbázis nem található: {DATABASE_PATH}"
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    yield conn
    conn.close()

class TestTableStructure:


    EXPECTED_TABLES = [
        'stars', 'galaxies', 'nebulae', 'solar_system',
        'exoplanets', 'constellations',
    ]

    def test_all_tables_exist(self, db):
        cursor = db.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row['name'] for row in cursor.fetchall()]
        for table in self.EXPECTED_TABLES:
            assert table in tables, f"Hiányzó tábla: {table}"

    def test_old_tables_removed(self, db):
        cursor = db.cursor()
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row['name'] for row in cursor.fetchall()]
        assert 'earth_moon' not in tables, "earth_moon tábla nem lett törölve"
        assert 'sun' not in tables, "sun tábla nem lett törölve"
        assert 'moons' not in tables, "moons tábla nem lett törölve"

    def test_stars_columns(self, db):
        cursor = db.cursor()
        cursor.execute("PRAGMA table_info(stars)")
        cols = [row['name'] for row in cursor.fetchall()]
        for col in ['id', 'name', 'ra', 'dec', 'mag', 'constellation']:
            assert col in cols, f"Hiányzó oszlop stars-ban: {col}"

    def test_galaxies_columns(self, db):
        cursor = db.cursor()
        cursor.execute("PRAGMA table_info(galaxies)")
        cols = [row['name'] for row in cursor.fetchall()]
        for col in ['id', 'name', 'ra', 'dec', 'magnitude', 'type', 'constellation', 'distance_mly']:
            assert col in cols, f"Hiányzó oszlop galaxies-ban: {col}"

    def test_nebulae_columns(self, db):
        cursor = db.cursor()
        cursor.execute("PRAGMA table_info(nebulae)")
        cols = [row['name'] for row in cursor.fetchall()]
        for col in ['id', 'name', 'ra', 'dec', 'magnitude', 'type', 'constellation']:
            assert col in cols, f"Hiányzó oszlop nebulae-ban: {col}"

    def test_solar_system_columns(self, db):
        cursor = db.cursor()
        cursor.execute("PRAGMA table_info(solar_system)")
        cols = [row['name'] for row in cursor.fetchall()]
        for col in ['id', 'name', 'type', 'diameter_km', 'distance']:
            assert col in cols, f"Hiányzó oszlop solar_system-ben: {col}"

    def test_exoplanets_columns(self, db):
        cursor = db.cursor()
        cursor.execute("PRAGMA table_info(exoplanets)")
        cols = [row['name'] for row in cursor.fetchall()]
        for col in ['id', 'name', 'host_star', 'ra', 'dec', 'discovery_method', 'distance_ly']:
            assert col in cols, f"Hiányzó oszlop exoplanets-ban: {col}"

class TestStars:
    def test_count(self, db):
        count = db.execute("SELECT COUNT(*) FROM stars").fetchone()[0]
        assert count >= 700, f"Kevés csillag: {count}"

    def test_ra_range(self, db):
        row = db.execute("SELECT MIN(ra), MAX(ra) FROM stars").fetchone()
        assert row[0] >= 0, "RA negatív"
        assert row[1] < 24, "RA > 24"

    def test_dec_range(self, db):
        row = db.execute("SELECT MIN(dec), MAX(dec) FROM stars").fetchone()
        assert row[0] >= -90, "Dec < -90"
        assert row[1] <= 90, "Dec > 90"

    def test_unique_ids(self, db):
        total = db.execute("SELECT COUNT(*) FROM stars").fetchone()[0]
        unique = db.execute("SELECT COUNT(DISTINCT id) FROM stars").fetchone()[0]
        assert total == unique, "Duplikált csillag ID-k"

    def test_known_stars(self, db):
        """Ismert fényes csillagok ellenőrzése"""
        for name in ['Sirius', 'Vega', 'Betelgeuse', 'Rigel']:
            row = db.execute("SELECT * FROM stars WHERE name = ?", (name,)).fetchone()
            assert row is not None, f"Hiányzó csillag: {name}"

class TestGalaxies:
    def test_count(self, db):
        count = db.execute("SELECT COUNT(*) FROM galaxies").fetchone()[0]
        assert count >= 40, f"Kevés galaxis: {count}"

    def test_types(self, db):
        types = [r[0] for r in db.execute("SELECT DISTINCT type FROM galaxies").fetchall()]
        assert 'spiral' in types
        assert 'elliptical' in types
        assert 'irregular' in types

    def test_m31(self, db):
        m31 = db.execute("SELECT * FROM galaxies WHERE id = 'M31'").fetchone()
        assert m31 is not None, "M31 hiányzik"
        assert m31['distance_mly'] > 2, "M31 távolság helytelen (mly-ban)"
        assert m31['type'] == 'spiral'

    def test_coordinates_valid(self, db):
        for row in db.execute("SELECT id, ra, dec FROM galaxies").fetchall():
            assert 0 <= row['ra'] < 24, f"{row['id']}: érvénytelen RA"
            assert -90 <= row['dec'] <= 90, f"{row['id']}: érvénytelen Dec"

class TestNebulae:
    def test_count(self, db):
        count = db.execute("SELECT COUNT(*) FROM nebulae").fetchone()[0]
        assert count >= 25, f"Kevés köd: {count}"

    def test_types(self, db):
        types = [r[0] for r in db.execute("SELECT DISTINCT type FROM nebulae").fetchall()]
        assert 'emission' in types
        assert 'planetary' in types

    def test_m42(self, db):
        m42 = db.execute("SELECT * FROM nebulae WHERE id = 'M42'").fetchone()
        assert m42 is not None, "M42 (Orion-köd) hiányzik"
        assert m42['type'] == 'emission'

    def test_m57(self, db):
        m57 = db.execute("SELECT * FROM nebulae WHERE id = 'M57'").fetchone()
        assert m57 is not None, "M57 (Gyűrű-köd) hiányzik"
        assert m57['type'] == 'planetary'

class TestSolarSystem:
    def test_count(self, db):
        count = db.execute("SELECT COUNT(*) FROM solar_system").fetchone()[0]
        assert count >= 9, f"Kevés naprendszer-objektum: {count}"

    def test_sun(self, db):
        sun = db.execute("SELECT * FROM solar_system WHERE id = 'sun'").fetchone()
        assert sun is not None, "Nap hiányzik"
        assert sun['type'] == 'star'

    def test_moon(self, db):
        moon = db.execute("SELECT * FROM solar_system WHERE id = 'moon'").fetchone()
        assert moon is not None, "Hold hiányzik"
        assert moon['type'] == 'moon'

    def test_all_planets(self, db):
        for name in ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']:
            row = db.execute("SELECT * FROM solar_system WHERE id = ?", (name,)).fetchone()
            assert row is not None, f"Hiányzó bolygó: {name}"

    def test_distance_order(self, db):
        rows = db.execute(
            "SELECT id, distance FROM solar_system WHERE type = 'planet' ORDER BY distance"
        ).fetchall()
        distances = [r['distance'] for r in rows]
        assert distances == sorted(distances), "Bolygók nincsenek távolság szerint rendezve"

class TestExoplanets:
    def test_count(self, db):
        count = db.execute("SELECT COUNT(*) FROM exoplanets").fetchone()[0]
        assert count >= 20, f"Kevés exobolygó: {count}"

    def test_proxima_b(self, db):
        pcb = db.execute("SELECT * FROM exoplanets WHERE id = 'proxima_cen_b'").fetchone()
        assert pcb is not None, "Proxima Centauri b hiányzik"
        assert pcb['is_habitable_zone'] == 1

    def test_habitable_zone_planets(self, db):
        count = db.execute("SELECT COUNT(*) FROM exoplanets WHERE is_habitable_zone = 1").fetchone()[0]
        assert count >= 5, f"Kevés lakható zónás bolygó: {count}"

    def test_discovery_methods(self, db):
        methods = [r[0] for r in db.execute("SELECT DISTINCT discovery_method FROM exoplanets").fetchall()]
        assert 'Transit' in methods
        assert 'Radial Velocity' in methods

    def test_unique_ids(self, db):
        total = db.execute("SELECT COUNT(*) FROM exoplanets").fetchone()[0]
        unique = db.execute("SELECT COUNT(DISTINCT id) FROM exoplanets").fetchone()[0]
        assert total == unique

class TestConstellations:
    def test_count(self, db):
        count = db.execute("SELECT COUNT(*) FROM constellations").fetchone()[0]
        assert count >= 40, f"Kevés csillagkép: {count}"

    def test_orion(self, db):
        orion = db.execute("SELECT * FROM constellations WHERE name = 'Orion'").fetchone()
        assert orion is not None, "Orion hiányzik"
        assert orion['name'] == 'Orion'