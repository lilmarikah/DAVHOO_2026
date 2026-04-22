import sqlite3
import json
import os

DATABASE_PATH = os.path.join(os.path.dirname(__file__), 'planetarium.db')

def create_new_tables():

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS nebulae (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            name_en TEXT,
            alt_names TEXT,
            ra REAL NOT NULL,
            dec REAL NOT NULL,
            mag REAL,
            type TEXT,
            constellation TEXT,
            distance_ly REAL,
            size_arcmin REAL,
            diameter_ly REAL,
            description TEXT,
            description_hu TEXT,
            color TEXT,
            discoverer TEXT,
            year_discovered INTEGER,
            messier_number INTEGER,
            caldwell_number INTEGER,
            ngc_number TEXT
        )
    ''')

    try:
        cursor.execute("ALTER TABLE galaxies ADD COLUMN messier_number INTEGER")
    except: pass
    try:
        cursor.execute("ALTER TABLE galaxies ADD COLUMN caldwell_number INTEGER")
    except: pass
    try:
        cursor.execute("ALTER TABLE galaxies ADD COLUMN ngc_number TEXT")
    except: pass
    try:
        cursor.execute("ALTER TABLE galaxies ADD COLUMN description_hu TEXT")
    except: pass
    try:
        cursor.execute("ALTER TABLE galaxies ADD COLUMN discoverer TEXT")
    except: pass
    try:
        cursor.execute("ALTER TABLE galaxies ADD COLUMN year_discovered INTEGER")
    except: pass
    try:
        cursor.execute("ALTER TABLE galaxies ADD COLUMN redshift REAL")
    except: pass

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS solar_system (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            name_hu TEXT,
            name_en TEXT,
            body_type TEXT NOT NULL,
            parent_body TEXT,
            color TEXT,
            diameter_km REAL,
            mass_kg REAL,
            mass_earth REAL,
            distance_au REAL,
            distance_km REAL,
            orbital_period_days REAL,
            rotation_period_hours REAL,
            axial_tilt_deg REAL,
            moons_count INTEGER,
            has_rings INTEGER DEFAULT 0,
            has_atmosphere INTEGER DEFAULT 0,
            mean_temp_celsius REAL,
            surface_gravity REAL,
            escape_velocity_kms REAL,
            spectral_type TEXT,
            age_billion_years REAL,
            description TEXT,
            description_hu TEXT,
            texture_url TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS exoplanets (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            host_star TEXT,
            ra REAL,
            dec REAL,
            constellation TEXT,
            discovery_method TEXT,
            discovery_year INTEGER,
            discovery_facility TEXT,
            orbital_period_days REAL,
            semi_major_axis_au REAL,
            mass_jupiter REAL,
            mass_earth REAL,
            radius_jupiter REAL,
            radius_earth REAL,
            equilibrium_temp_k REAL,
            distance_ly REAL,
            stellar_magnitude REAL,
            stellar_type TEXT,
            description TEXT,
            description_hu TEXT,
            is_habitable_zone INTEGER DEFAULT 0
        )
    ''')

    cursor.execute('CREATE INDEX IF NOT EXISTS idx_nebulae_type ON nebulae(type)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_nebulae_constellation ON nebulae(constellation)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_exoplanets_method ON exoplanets(discovery_method)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_exoplanets_year ON exoplanets(discovery_year)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_solar_system_type ON solar_system(body_type)')

    conn.commit()
    conn.close()
    print("✅ Új táblák létrehozva")


def seed_galaxies():

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    cursor.execute("DELETE FROM galaxies")

    galaxies = [
        ("M31", "Androméda-galaxis", "Andromeda Galaxy", 0.7123, 41.2689, 3.44, "spiral", "SA(s)b", "Andromeda", 2537000, 220000, 178.0, "#E8D5B0", "Az Androméda-galaxis a Tejútrendszer legközelebbi nagy spirálgalaxisa. Szabad szemmel is látható.", "Persian astronomers", -964, 31, None, "NGC224", 'Al-Sufi', -0.001),
        ("M32", "Messier 32", "Messier 32", 0.7111, 40.8653, 8.08, "elliptical", "cE2", "Andromeda", 2490000, 6500, 8.7, "#D4C5A0", "Az Androméda-galaxis kis elliptikus kísérőgalaxisa.", "Le Gentil", 1749, 32, None, "NGC221", None, -0.0007),
        ("M33", "Triangulum-galaxis", "Triangulum Galaxy", 1.5642, 30.6603, 5.72, "spiral", "SA(s)cd", "Triangulum", 2730000, 60000, 73.0, "#C8D8E8", "A Lokális Csoport harmadik legnagyobb galaxisa, spirálkarjai jól láthatók.", "Hodierna", 1654, 33, None, "NGC598", None, -0.0006),
        ("M49", "Messier 49", "Messier 49", 12.4942, 8.0003, 8.4, "elliptical", "E2", "Virgo", 55900000, 157000, 9.3, "#E0D0B0", "A Virgo-halmaz legfényesebb galaxisa.", "Messier", 1771, 49, None, "NGC4472", None, 0.0033),
        ("M51", "Örvény-galaxis", "Whirlpool Galaxy", 13.4997, 47.1952, 8.4, "spiral", "SA(s)bc", "Canes Venatici", 23160000, 76000, 11.2, "#B8C8E0", "Az Örvény-galaxis és kísérője (NGC 5195) kölcsönhatásban állnak egymással.", "Messier", 1773, 51, None, "NGC5194", None, 0.0015),
        ("M58", "Messier 58", "Messier 58", 12.6292, 11.8178, 9.66, "spiral", "SAB(rs)b", "Virgo", 62000000, 105000, 5.9, "#D0C0A0", "Küllős spirálgalaxis a Virgo-halmazban.", "Messier", 1779, 58, None, "NGC4579", None, 0.005),
        ("M59", "Messier 59", "Messier 59", 12.7003, 11.6472, 9.59, "elliptical", "E5", "Virgo", 60000000, 90000, 5.4, "#D8C8A8", "Elliptikus galaxis a Virgo-halmazban.", "Koehler", 1779, 59, None, "NGC4621", None, 0.0014),
        ("M60", "Messier 60", "Messier 60", 12.7264, 11.5528, 8.8, "elliptical", "E2", "Virgo", 54000000, 120000, 7.6, "#DCC8A0", "Nagy elliptikus galaxis, kísérőgalaxissal.", "Koehler", 1779, 60, None, "NGC4649", None, 0.0037),
        ("M61", "Messier 61", "Messier 61", 12.3664, 4.4742, 9.65, "spiral", "SAB(rs)bc", "Virgo", 52500000, 100000, 6.5, "#C0D0E0", "Csillagontó spirálgalaxis sok szupernóvával.", "Oriani", 1779, 61, None, "NGC4303", None, 0.0052),
        ("M63", "Napraforgó-galaxis", "Sunflower Galaxy", 13.2653, 42.0294, 8.59, "spiral", "SA(rs)bc", "Canes Venatici", 29300000, 98000, 12.6, "#D0C8B0", "A spirálkarok napraforgóra emlékeztetnek.", "Méchain", 1779, 63, None, "NGC5055", None, 0.0016),
        ("M64", "Sötét Szem-galaxis", "Black Eye Galaxy", 12.9464, 21.6828, 8.52, "spiral", "SA(rs)ab", "Coma Berenices", 24000000, 54000, 10.0, "#C8B898", "Jellegzetes sötét porsáv a mag előtt.", "Bode", 1779, 64, None, "NGC4826", None, 0.0014),
        ("M65", "Messier 65", "Messier 65", 11.3181, 13.0925, 9.3, "spiral", "SAB(rs)a", "Leo", 35000000, 90000, 9.8, "#D8D0C0", "A Leo-triplett tagja.", "Méchain", 1780, 65, None, "NGC3623", None, 0.0027),
        ("M66", "Messier 66", "Messier 66", 11.3372, 12.9917, 8.9, "spiral", "SAB(s)b", "Leo", 36000000, 95000, 9.1, "#D0C8B8", "A Leo-triplett legnagyobb tagja.", "Méchain", 1780, 66, None, "NGC3627", None, 0.0024),
        ("M74", "Fantom-galaxis", "Phantom Galaxy", 1.6117, 15.7836, 9.39, "spiral", "SA(s)c", "Pisces", 35000000, 95000, 10.5, "#B0C0D8", "Tökéletes spirálgalaxis, nehezen megfigyelhető.", "Méchain", 1780, 74, None, "NGC628", None, 0.0022),
        ("M77", "Messier 77", "Messier 77", 2.7119, -0.0133, 8.87, "spiral", "SAB(rs)b", "Cetus", 47000000, 170000, 7.1, "#D0D8E0", "Aktív Seyfert-galaxis erős rádiósugárzással.", "Méchain", 1780, 77, None, "NGC1068", None, 0.0038),
        ("M81", "Bode-galaxis", "Bode's Galaxy", 9.9264, 69.0653, 6.94, "spiral", "SA(s)ab", "Ursa Major", 11800000, 90000, 26.9, "#E0D8C8", "Közeli nagy spirálgalaxis, jól tanulmányozható.", "Bode", 1774, 81, None, "NGC3031", None, -0.0001),
        ("M82", "Szivar-galaxis", "Cigar Galaxy", 9.9319, 69.6797, 8.41, "irregular", "I0", "Ursa Major", 11400000, 37000, 11.2, "#F0D0A0", "Csillagkeletkezési robbanás jellemzi, az M81 kölcsönhatása miatt.", "Bode", 1774, 82, None, "NGC3034", None, 0.0007),
        ("M83", "Déli Szélkerék", "Southern Pinwheel", 13.6167, -29.8658, 7.54, "spiral", "SAB(s)c", "Hydra", 14700000, 55000, 12.9, "#C8D8F0", "Fényes küllős spirálgalaxis a déli égen.", "Lacaille", 1752, 83, None, "NGC5236", None, 0.0017),
        ("M84", "Messier 84", "Messier 84", 12.4183, 12.8869, 9.1, "elliptical", "E1", "Virgo", 60000000, 163000, 6.5, "#D8D0C0", "Lentikuláris galaxis a Virgo-halmaz magjában.", "Messier", 1781, 84, None, "NGC4374", None, 0.0035),
        ("M86", "Messier 86", "Messier 86", 12.4375, 12.9469, 8.9, "elliptical", "E3", "Virgo", 52000000, 135000, 8.9, "#D4CCC0", "A Virgo-halmaz egyik legfényesebb elliptikus galaxisa.", "Messier", 1781, 86, None, "NGC4406", None, -0.0008),
        ("M87", "Szűz A", "Virgo A", 12.5136, 12.3911, 8.6, "elliptical", "E0-1", "Virgo", 53490000, 240000, 8.3, "#E0D8C8", "Szupermasszív galaxis hatalmas jettel, első fekete lyuk kép helyszíne.", "Messier", 1781, 87, None, "NGC4486", None, 0.0044),
        ("M88", "Messier 88", "Messier 88", 12.5319, 14.4203, 9.6, "spiral", "SA(rs)b", "Coma Berenices", 47000000, 130000, 6.9, "#C8C0B0", "Elegáns spirálgalaxis a Virgo-halmazban.", "Messier", 1781, 88, None, "NGC4501", None, 0.0076),
        ("M89", "Messier 89", "Messier 89", 12.5936, 12.5564, 9.8, "elliptical", "E0", "Virgo", 50000000, 80000, 5.1, "#D0C8B8", "Szinte tökéletesen gömb alakú galaxis.", "Messier", 1781, 89, None, "NGC4552", None, 0.0011),
        ("M90", "Messier 90", "Messier 90", 12.6125, 13.1631, 9.5, "spiral", "SAB(rs)ab", "Virgo", 58700000, 165000, 9.5, "#C0C8D0", "A Virgo-halmaz egyik legnagyobb spirálgalaxisa.", "Messier", 1781, 90, None, "NGC4569", None, -0.0008),
        ("M91", "Messier 91", "Messier 91", 12.5908, 14.4961, 10.2, "spiral", "SBb(rs)", "Coma Berenices", 63000000, 100000, 5.4, "#B8C0D0", "Küllős spirálgalaxis.", "Messier", 1781, 91, None, "NGC4548", None, 0.0016),
        ("M94", "Macskaszem-galaxis", "Cat's Eye Galaxy", 12.8511, 41.1200, 8.24, "spiral", "SAB(r)ab", "Canes Venatici", 16000000, 30000, 11.2, "#D8D0C8", "Csillagkeletkezési gyűrű veszi körül.", "Méchain", 1781, 94, None, "NGC4736", None, 0.001),
        ("M95", "Messier 95", "Messier 95", 10.7331, 11.7036, 9.73, "spiral", "SB(r)b", "Leo", 32600000, 46000, 7.4, "#C8C0B0", "Küllős spirálgalaxis a Leo I csoportban.", "Méchain", 1781, 95, None, "NGC3351", None, 0.0026),
        ("M96", "Messier 96", "Messier 96", 10.7833, 11.8197, 9.24, "spiral", "SAB(rs)ab", "Leo", 31000000, 66000, 7.6, "#D0C8B8", "A Leo I galaxiscsoport legfényesebb tagja.", "Méchain", 1781, 96, None, "NGC3368", None, 0.003),
        ("M98", "Messier 98", "Messier 98", 12.2272, 14.9003, 10.1, "spiral", "SAB(s)ab", "Coma Berenices", 44400000, 160000, 9.8, "#B8C0C8", "Majdnem élből látható spirálgalaxis.", "Méchain", 1781, 98, None, "NGC4192", None, -0.0005),
        ("M99", "Messier 99", "Messier 99", 12.3128, 14.4167, 9.87, "spiral", "SA(s)c", "Coma Berenices", 44700000, 80000, 5.4, "#C0D0E8", "Aszimmetrikus spirálkarjai vannak.", "Méchain", 1781, 99, None, "NGC4254", None, 0.008),
        ("M100", "Messier 100", "Messier 100", 12.3822, 15.8219, 9.35, "spiral", "SAB(s)bc", "Coma Berenices", 55000000, 107000, 7.4, "#C8D0E0", "Nagy, fényes spirálgalaxis a Virgo-halmazban.", "Méchain", 1781, 100, None, "NGC4321", None, 0.0052),
        ("M101", "Szélkerék-galaxis", "Pinwheel Galaxy", 14.0531, 54.3492, 7.86, "spiral", "SAB(rs)cd", "Ursa Major", 20870000, 170000, 28.8, "#B8D0E8", "Hatalmas, szemből látható spirálgalaxis.", "Méchain", 1781, 101, None, "NGC5457", None, 0.0008),
        ("M104", "Sombrero-galaxis", "Sombrero Galaxy", 12.6664, -11.6231, 8.0, "spiral", "SA(s)a", "Virgo", 29350000, 50000, 8.7, "#E8D8B8", "Jellegzetes kalapforma a porsáv miatt.", "Méchain", 1781, 104, None, "NGC4594", None, 0.0034),
        ("M105", "Messier 105", "Messier 105", 10.7964, 12.5817, 9.3, "elliptical", "E1", "Leo", 36600000, 55000, 5.4, "#D8D0C0", "Elliptikus galaxis a Leo I csoportban.", "Méchain", 1781, 105, None, "NGC3379", None, 0.003),
        ("M106", "Messier 106", "Messier 106", 12.3153, 47.3044, 8.41, "spiral", "SAB(s)bc", "Canes Venatici", 23700000, 135000, 18.6, "#C8D0E0", "Aktív Seyfert-galaxis víz-mázer sugárzással.", "Méchain", 1781, 106, None, "NGC4258", None, 0.0015),
        ("M108", "Messier 108", "Messier 108", 11.1892, 55.6747, 10.0, "spiral", "SB(s)cd", "Ursa Major", 45000000, 110000, 8.7, "#B8C0C8", "Élről látható spirálgalaxis.", "Méchain", 1781, 108, None, "NGC3556", None, 0.0023),
        ("M109", "Messier 109", "Messier 109", 11.9594, 53.3744, 9.8, "spiral", "SB(rs)bc", "Ursa Major", 67200000, 180000, 7.6, "#C0C8D0", "Küllős spirálgalaxis.", "Méchain", 1781, 109, None, "NGC3992", None, 0.0035),
        ("M110", "Messier 110", "Messier 110", 0.6731, 41.6853, 8.07, "elliptical", "dE5", "Andromeda", 2690000, 17000, 21.9, "#D0C8B8", "Az Androméda-galaxis elliptikus kísérője.", "Messier", 1773, 110, None, "NGC205", None, -0.0008),

        ("NGC253", "Szobrász-galaxis", "Sculptor Galaxy", 0.7925, -25.2881, 7.1, "spiral", "SAB(s)c", "Sculptor", 11400000, 90000, 27.5, "#D8D0C0", "Közeli csillagkeletkezési galaxis, fényes a déli égen.", "C. Herschel", 1783, None, 65, "NGC253", None, 0.0008),
        ("NGC5128", "Centaurus A", "Centaurus A", 13.4244, -43.0192, 6.84, "lenticular", "S0/E", "Centaurus", 12400000, 97000, 25.7, "#E0D0B0", "A legközelebbi rádiógalaxis, jellegzetes porsávval.", "Dunlop", 1826, None, 77, "NGC5128", None, 0.0018),
        ("LMC", "Nagy Magellán-felhő", "Large Magellanic Cloud", 5.3933, -69.7561, 0.9, "irregular", "SB(s)m", "Dorado", 158200, 14000, 645.0, "#B8C0D0", "A Tejútrendszer legnagyobb kísérőgalaxisa, szabad szemmel látható.", "Ancient", None, None, None, None, None, 0.0009),
        ("SMC", "Kis Magellán-felhő", "Small Magellanic Cloud", 0.8767, -72.8003, 2.7, "irregular", "SB(s)m", "Tucana", 199000, 7000, 320.0, "#A8B0C0", "Szabálytalan törpegalaxis, szabad szemmel látható.", "Ancient", None, None, None, None, None, 0.0005),
        ("NGC4565", "Tű-galaxis", "Needle Galaxy", 12.6042, 25.9875, 9.56, "spiral", "SA(s)b", "Coma Berenices", 42700000, 100000, 15.8, "#C8C0B0", "Tökéletesen élről látható spirálgalaxis.", "W. Herschel", 1785, None, 38, "NGC4565", None, 0.0042),
        ("NGC4631", "Bálna-galaxis", "Whale Galaxy", 12.7031, 32.5414, 9.2, "spiral", "SB(s)d", "Canes Venatici", 25000000, 140000, 15.5, "#C0C8D0", "Kölcsönható galaxis, bálna formájú.", "W. Herschel", 1787, None, 32, "NGC4631", None, 0.002),
        ("NGC891", "Messier 891", "NGC 891", 2.3775, 42.3492, 10.0, "spiral", "SA(s)b", "Andromeda", 27300000, 100000, 13.5, "#C8C0B0", "A Tejútrendszerhez nagyon hasonló, élről látható galaxis.", "C. Herschel", 1783, None, 23, "NGC891", None, 0.0018),
        ("NGC2403", "Caldwell 7", "NGC 2403", 7.6153, 65.6025, 8.93, "spiral", "SAB(s)cd", "Camelopardalis", 10000000, 50000, 21.9, "#B8C8E0", "Közeli spirálgalaxis az M81 csoportban.", "W. Herschel", 1788, None, 7, "NGC2403", None, 0.0004),
        ("NGC7331", "Caldwell 30", "NGC 7331", 22.6178, 34.4158, 9.5, "spiral", "SA(s)b", "Pegasus", 40000000, 100000, 10.5, "#D0C8B8", "A Tejútrendszerhez hasonló spirálgalaxis.", "W. Herschel", 1784, None, 30, "NGC7331", None, 0.0027),
        ("IC342", "Caldwell 5", "IC 342", 3.7828, 68.0961, 9.1, "spiral", "SAB(rs)cd", "Camelopardalis", 10700000, 50000, 21.4, "#B0C0D0", "Rejtett galaxis a Tejútrendszer porrégiója mögött.", "Barnard", 1895, None, 5, "IC342", None, 0.0001),
        ("NGC55", "Caldwell 72", "NGC 55", 0.2489, -39.1978, 8.42, "irregular", "SB(s)m", "Sculptor", 6500000, 70000, 32.4, "#B8C0C8", "Közeli szabálytalan galaxis a Szobrász-csoportban.", "Dunlop", 1826, None, 72, "NGC55", None, 0.0004),
        ("NGC300", "Caldwell 70", "NGC 300", 0.9147, -37.6839, 8.95, "spiral", "SA(s)d", "Sculptor", 6070000, 45000, 21.9, "#A8B8C8", "Szép spirálgalaxis a Szobrász-csoportban.", "Dunlop", 1826, None, 70, "NGC300", None, 0.0005),
        ("NGC6822", "Barnard-galaxis", "Barnard's Galaxy", 19.7489, -14.8031, 8.8, "irregular", "IB(s)m", "Sagittarius", 1630000, 7000, 15.5, "#A0B0C0", "Közeli szabálytalan törpegalaxis a Lokális Csoportban.", "Barnard", 1884, None, 57, "NGC6822", None, -0.0002),
        ("NGC147", "Caldwell 17", "NGC 147", 0.5525, 48.5072, 9.5, "elliptical", "dE5", "Cassiopeia", 2530000, 10000, 13.2, "#C0B8B0", "Az Androméda-galaxis törpe elliptikus kísérője.", "J. Herschel", 1829, None, 17, "NGC147", None, -0.0006),
        ("NGC185", "Caldwell 18", "NGC 185", 0.6492, 48.3372, 9.2, "elliptical", "dE3", "Cassiopeia", 2050000, 8000, 11.5, "#C8C0B8", "Az Androméda-galaxis kísérőgalaxisa.", "W. Herschel", 1787, None, 18, "NGC185", None, -0.0007),
    ]

    for g in galaxies:
        cursor.execute('''
            INSERT OR REPLACE INTO galaxies 
            (id, name, name_en, ra, dec, mag, type, classification, constellation,
             distance_ly, diameter_ly, size_arcmin, color, description_hu, 
             discoverer, year_discovered, messier_number, caldwell_number, ngc_number, alt_names, redshift)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', g)

    conn.commit()
    count = cursor.execute("SELECT COUNT(*) FROM galaxies").fetchone()[0]
    conn.close()
    print(f"✅ {count} galaxis beszúrva")


def seed_nebulae():

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    nebulae = [
        ("M42", "Orion-köd", "Orion Nebula", None, 5.5881, -5.3911, 4.0, "emission", "Orion", 1344, 24.0, 24.0, "Az éjszakai égbolt legfényesebb köde, aktív csillagkeletkezési terület.", "#E8A0C0", "Peiresc", 1610, 42, None, "NGC1976"),
        ("M43", "De Mairan-köd", "De Mairan's Nebula", None, 5.5936, -5.2686, 9.0, "emission", "Orion", 1344, 20.0, 4.0, "Az Orion-köd északi része.", "#D8A0B8", "de Mairan", 1731, 43, None, "NGC1982"),
        ("M8", "Lagúna-köd", "Lagoon Nebula", None, 18.0633, -24.3833, 6.0, "emission", "Sagittarius", 5200, 90.0, 55.0, "Hatalmas csillagkeletkezési régió a Nyilas csillagképben.", "#E0B0C8", "Flamsteed", 1680, 8, None, "NGC6523"),
        ("M17", "Omega-köd", "Omega Nebula", None, 18.3464, -16.1833, 6.0, "emission", "Sagittarius", 5000, 40.0, 11.0, "Swan/Omega/Horseshoe/Lobster köd - sok neve van a formája miatt.", "#D8A8C0", "de Chéseaux", 1745, 17, None, "NGC6618"),
        ("M20", "Trifid-köd", "Trifid Nebula", None, 18.0436, -23.0300, 6.3, "emission", "Sagittarius", 5200, 20.0, 28.0, "Háromosztatú köd: emissziós, reflexiós és sötét köd egyben.", "#D080A0", "Messier", 1764, 20, None, "NGC6514"),
        ("M16", "Sas-köd", "Eagle Nebula", None, 18.3133, -13.7833, 6.0, "emission", "Serpens", 7000, 70.0, 7.0, "A Teremtés Oszlopai itt találhatók (Hubble ikon).", "#C8A0B8", "de Chéseaux", 1745, 16, None, "NGC6611"),
        ("NGC3372", "Carina-köd", "Carina Nebula", None, 10.7500, -59.8667, 1.0, "emission", "Carina", 8500, 300.0, 120.0, "Az ég egyik legnagyobb és legfényesebb köde, Eta Carinae otthona.", "#F0C0D0", "Lacaille", 1752, None, 92, "NGC3372"),
        ("NGC2070", "Tarantula-köd", "Tarantula Nebula", None, 5.6456, -69.1006, 5.0, "emission", "Dorado", 160000, 600.0, 40.0, "A Lokális Csoport legnagyobb csillagkeletkezési régiója az LMC-ben.", "#E0A0B8", "Bode", 1751, None, 103, "NGC2070"),
        ("IC1396", "Elefántormány-köd", "Elephant Trunk Nebula", None, 21.6528, 57.5000, 3.5, "emission", "Cepheus", 2400, 50.0, 170.0, "Hatalmas emissziós régió sötét globulákkal.", "#D0A0B0", "Barnard", 1893, None, None, "IC1396"),
        ("NGC7000", "Észak-Amerika-köd", "North America Nebula", None, 20.9833, 44.3333, 4.0, "emission", "Cygnus", 2590, 50.0, 120.0, "Jellegzetes kontinens-formájáról kapta nevét.", "#E0B0C0", "W. Herschel", 1786, None, 20, "NGC7000"),
        ("NGC6888", "Félhold-köd", "Crescent Nebula", None, 20.2014, 38.3525, 7.4, "emission", "Cygnus", 4700, 25.0, 18.0, "Wolf-Rayet csillag által keltett buborék-köd.", "#D090A8", "W. Herschel", 1792, None, 27, "NGC6888"),

        ("M57", "Gyűrű-köd", "Ring Nebula", None, 18.8933, 33.0286, 8.8, "planetary", "Lyra", 2283, 1.0, 1.4, "Klasszikus planetáris köd, egy haldokló csillag maradványa.", "#80C0E0", "Darquier", 1779, 57, None, "NGC6720"),
        ("M27", "Súlyzó-köd", "Dumbbell Nebula", None, 19.9933, 22.7211, 7.5, "planetary", "Vulpecula", 1360, 2.5, 8.0, "Az első felfedezett planetáris köd.", "#90D0F0", "Messier", 1764, 27, None, "NGC6853"),
        ("NGC7293", "Hélix-köd", "Helix Nebula", None, 22.4933, -20.8372, 7.6, "planetary", "Aquarius", 650, 5.7, 13.0, "A legközelebbi planetáris köd, 'Isten Szeme' néven is ismert.", "#70B0D0", "Harding", 1824, None, 63, "NGC7293"),
        ("M97", "Bagoly-köd", "Owl Nebula", None, 11.2489, 55.0189, 9.9, "planetary", "Ursa Major", 2030, 1.6, 3.4, "Két sötét 'szem' a ködben bagolyra emlékeztet.", "#80B8D0", "Méchain", 1781, 97, None, "NGC3587"),
        ("NGC6543", "Macskaszem-köd", "Cat's Eye Nebula", None, 17.9764, 66.6319, 8.1, "planetary", "Draco", 3300, 0.4, 0.3, "Komplex belső szerkezet, a Hubble egyik legismertebb célpontja.", "#60A0C8", "W. Herschel", 1786, None, 6, "NGC6543"),
        ("NGC2392", "Eszkimó-köd", "Eskimo Nebula", None, 7.4861, 20.9119, 9.2, "planetary", "Gemini", 6500, 0.7, 0.8, "Kettős burokkal rendelkező planetáris köd.", "#78B0D8", "W. Herschel", 1787, None, 39, "NGC2392"),
        ("NGC3132", "Déli Gyűrű-köd", "Southern Ring Nebula", None, 10.1206, -40.4367, 9.87, "planetary", "Vela", 2000, 0.5, 0.8, "A JWST első képeinek egyike erről a ködről készült.", "#70A8C8", "J. Herschel", 1835, None, None, "NGC3132"),
        ("NGC7027", "Caldwell 18b", "NGC 7027", None, 21.1178, 42.2325, 8.5, "planetary", "Cygnus", 3000, 0.2, 0.3, "Fiatal, sűrű planetáris köd gazdag kémiai összetétellel.", "#68A0C0", "W. Herschel", 1784, None, None, "NGC7027"),

        ("IC434", "Lófej-köd", "Horsehead Nebula", None, 5.6822, -2.4581, 6.8, "dark", "Orion", 1500, 3.5, 8.0, "Az egyik legismertebb sötét köd, jellegzetes lófej-forma.", "#402020", "Fleming", 1888, None, None, "IC434"),
        ("B33", "Barnard 33", "Barnard 33", None, 5.6817, -2.4575, 99.0, "dark", "Orion", 1500, 3.0, 6.0, "A Lófej-köd sötét része.", "#301818", "Barnard", 1913, None, None, None),
        ("NGC1999", "Kulcslyuk-köd", "Keyhole Nebula", None, 5.5931, -6.7119, 10.5, "dark", "Orion", 1500, 0.3, 2.0, "Reflexiós köd sötét kulcslyuk-formával.", "#382838", "W. Herschel", 1785, None, None, "NGC1999"),

        ("M78", "Messier 78", "Messier 78", None, 5.7797, 0.0811, 8.3, "reflection", "Orion", 1600, 4.0, 8.0, "Az ég legfényesebb reflexiós köde.", "#6890B0", "Méchain", 1780, 78, None, "NGC2068"),
        ("NGC7023", "Írisz-köd", "Iris Nebula", None, 21.0128, 68.1700, 6.8, "reflection", "Cepheus", 1300, 6.0, 18.0, "Gyönyörű kék reflexiós köd.", "#5878A0", "W. Herschel", 1794, None, 4, "NGC7023"),
        ("IC2118", "Boszorkányfej-köd", "Witch Head Nebula", None, 5.0833, -7.2333, 13.0, "reflection", "Eridanus", 900, 50.0, 180.0, "Rigel által megvilágított halvány reflexiós köd.", "#405880", None, None, None, None, "IC2118"),

        ("M1", "Rák-köd", "Crab Nebula", None, 5.5753, 22.0147, 8.4, "supernova_remnant", "Taurus", 6500, 11.0, 7.0, "Az 1054-es szupernóva maradványa, pulzárt tartalmaz.", "#A0C0D0", "Bevis", 1731, 1, None, "NGC1952"),
        ("NGC6992", "Fátyol-köd", "Veil Nebula", None, 20.9400, 31.7167, 7.0, "supernova_remnant", "Cygnus", 2400, 50.0, 180.0, "Kb. 10000 éves szupernóva-maradvány gyönyörű filamentekkel.", "#7098B0", "W. Herschel", 1784, None, 33, "NGC6992"),
        ("Cas_A", "Cassiopeia A", "Cassiopeia A", None, 23.3917, 58.8167, 99.0, "supernova_remnant", "Cassiopeia", 11000, 15.0, 5.0, "A legerősebb rádióforrás az égen, kb. 340 éves szupernóva.", "#8888A0", None, 1680, None, None, None),
    ]

    for n in nebulae:
        cursor.execute('''
            INSERT OR REPLACE INTO nebulae 
            (id, name, name_en, alt_names, ra, dec, mag, type, constellation,
             distance_ly, diameter_ly, size_arcmin, description_hu, color,
             discoverer, year_discovered, messier_number, caldwell_number, ngc_number)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', n)

    conn.commit()
    count = cursor.execute("SELECT COUNT(*) FROM nebulae").fetchone()[0]
    conn.close()
    print(f"✅ {count} köd beszúrva")

def seed_solar_system():

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    bodies = [
        ("sun", "Nap", "Nap", "Sun", "star", None, "#FDB813", 1392700, 1.989e30, 333000, 0, 0, 0, 609.12, 7.25, 0, 0, 1, 5500, 274.0, 617.7, "G2V", 4.6, "The central star of our solar system.", "A Naprendszer központi csillaga. Sárga törpe, hidrogént alakít héliummá fúzióval.", None),
        ("mercury", "Merkúr", "Merkúr", "Mercury", "terrestrial", "sun", "#B5B5B5", 4879, 3.301e23, 0.055, 0.387, 57910000, 87.97, 1407.6, 0.034, 0, 0, 0, 167, 3.7, 4.25, None, 4.6, "Smallest planet and closest to the Sun.", "A Naprendszer legkisebb és a Naphoz legközelebbi bolygója. Nincs légköre.", None),
        ("venus", "Vénusz", "Vénusz", "Venus", "terrestrial", "sun", "#E6C87A", 12104, 4.867e24, 0.815, 0.723, 108200000, 224.7, -5832.5, 177.4, 0, 0, 1, 464, 8.87, 10.36, None, 4.6, "Hottest planet with thick atmosphere.", "A Föld 'ikerbolygója'. Sűrű CO2 légköre miatt a legforróbb bolygó.", None),
        ("earth", "Föld", "Föld", "Earth", "terrestrial", "sun", "#2E86C1", 12756, 5.972e24, 1.0, 1.0, 149598023, 365.26, 23.93, 23.44, 1, 0, 1, 15, 9.807, 11.186, None, 4.54, "Our home planet, the only known world with life.", "Az egyetlen ismert élet-hordozó bolygó. Felszínének 71%-át víz borítja.", None),
        ("moon", "Hold", "Hold", "Moon", "moon", "earth", "#C0C0C0", 3474, 7.342e22, 0.0123, 0.00257, 384400, 27.32, 655.73, 6.68, 0, 0, 0, -20, 1.62, 2.38, None, 4.53, "Earth's only natural satellite.", "A Föld egyetlen természetes holdja. Kötött rotációja van, mindig ugyanazt az oldalát mutatja.", None),
        ("mars", "Mars", "Mars", "Mars", "terrestrial", "sun", "#DC5539", 6792, 6.39e23, 0.107, 1.524, 227940000, 687.0, 24.62, 25.19, 2, 0, 1, -65, 3.72, 5.03, None, 4.6, "The Red Planet, target of exploration.", "A Vörös Bolygó. Vasoxid borítja felszínét, a jövő emberi kolóniáinak célpontja.", None),
        ("jupiter", "Jupiter", "Jupiter", "Jupiter", "gas_giant", "sun", "#C88B3A", 142984, 1.898e27, 317.8, 5.203, 778570000, 4331.0, 9.93, 3.13, 95, 1, 1, -110, 24.79, 59.5, None, 4.6, "Largest planet in the Solar System.", "A Naprendszer legnagyobb bolygója. Gázóriás, a Nagy Vörös Folt vihar 350 éve tombol rajta.", None),
        ("saturn", "Szaturnusz", "Szaturnusz", "Saturn", "gas_giant", "sun", "#FAD5A5", 120536, 5.683e26, 95.16, 9.537, 1433500000, 10747.0, 10.66, 26.73, 146, 1, 1, -140, 10.44, 35.5, None, 4.6, "Famous for its spectacular ring system.", "Gyűrűrendszeréről híres gázóriás. Sűrűsége kisebb a vízénél.", None),
        ("uranus", "Uránusz", "Uránusz", "Uranus", "ice_giant", "sun", "#4FD0E7", 51118, 8.681e25, 14.54, 19.19, 2872500000, 30589.0, -17.24, 97.77, 28, 1, 1, -195, 8.87, 21.3, None, 4.6, "An ice giant that rotates on its side.", "Jégóriás, tengelyferdesége miatt 'oldalán' forog. Metán légköre kékes színt ad.", None),
        ("neptune", "Neptunusz", "Neptunusz", "Neptune", "ice_giant", "sun", "#4B70DD", 49528, 1.024e26, 17.15, 30.07, 4495100000, 59800.0, 16.11, 28.32, 16, 1, 1, -200, 11.15, 23.5, None, 4.6, "The farthest planet, with supersonic winds.", "A legtávolabbi bolygó. Szuperszonikus szelek fújnak rajta (2100 km/h).", None),
        ("pluto", "Pluto", "Pluto", "Pluto", "dwarf_planet", "sun", "#C8A882", 2376, 1.303e22, 0.00218, 39.48, 5906400000, 90560.0, -153.29, 122.53, 5, 0, 1, -230, 0.62, 1.21, None, 4.6, "Dwarf planet in the Kuiper Belt.", "Törpebolygó a Kuiper-övben. 2006-ig a 9. bolygónak számított.", None),
        ("ceres", "Ceres", "Ceres", "Ceres", "dwarf_planet", "sun", "#969696", 940, 9.393e20, 0.000157, 2.77, 414010000, 1682.0, 9.07, 4.0, 0, 0, 0, -105, 0.28, 0.51, None, 4.6, "Largest object in the asteroid belt.", "A kisbolygóöv legnagyobb égitestje, törpebolygó.", None),
    ]

    for b in bodies:
        cursor.execute('''
            INSERT OR REPLACE INTO solar_system 
            (id, name, name_hu, name_en, body_type, parent_body, color, diameter_km,
             mass_kg, mass_earth, distance_au, distance_km, orbital_period_days,
             rotation_period_hours, axial_tilt_deg, moons_count, has_rings,
             has_atmosphere, mean_temp_celsius, surface_gravity, escape_velocity_kms,
             spectral_type, age_billion_years, description, description_hu, texture_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', b)

    conn.commit()
    count = cursor.execute("SELECT COUNT(*) FROM solar_system").fetchone()[0]
    conn.close()
    print(f"✅ {count} naprendszer-objektum beszúrva")


def seed_exoplanets():

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    exoplanets = [
        ("proxima_cen_b", "Proxima Centauri b", "Proxima Centauri", 217.429, -62.679, "Centaurus", "Radial Velocity", 2016, "ESO/La Silla", 11.186, 0.0485, 0.004, 1.27, None, 1.08, 234, 4.24, 11.13, "M5.5V", "Closest known exoplanet, potentially in habitable zone.", "A legközelebbi ismert exobolygó, a lakható zónában keringhet.", 1),
        ("proxima_cen_d", "Proxima Centauri d", "Proxima Centauri", 217.429, -62.679, "Centaurus", "Radial Velocity", 2022, "ESO/VLT", 5.122, 0.0291, 0.0008, 0.26, None, None, None, 4.24, 11.13, "M5.5V", "Very small planet close to Proxima Centauri.", "Nagyon kicsi bolygó a Proxima Centauri közelében.", 0),
        ("trappist_1b", "TRAPPIST-1b", "TRAPPIST-1", 346.622, -5.042, "Aquarius", "Transit", 2016, "TRAPPIST", 1.511, 0.0115, 0.003, 1.017, 0.099, 1.121, 400, 40.66, 18.80, "M8V", "Innermost planet of the TRAPPIST-1 system.", "A TRAPPIST-1 rendszer legbelső bolygója.", 0),
        ("trappist_1d", "TRAPPIST-1d", "TRAPPIST-1", 346.622, -5.042, "Aquarius", "Transit", 2017, "Spitzer", 4.050, 0.0223, 0.001, 0.388, 0.072, 0.784, 288, 40.66, 18.80, "M8V", "Potentially habitable TRAPPIST-1 planet.", "Potenciálisan lakható TRAPPIST-1 bolygó.", 1),
        ("trappist_1e", "TRAPPIST-1e", "TRAPPIST-1", 346.622, -5.042, "Aquarius", "Transit", 2017, "Spitzer", 6.100, 0.0293, 0.002, 0.692, 0.082, 0.920, 251, 40.66, 18.80, "M8V", "Most Earth-like planet in TRAPPIST-1 system.", "A TRAPPIST-1 rendszer leginkább Föld-szerű bolygója.", 1),
        ("trappist_1f", "TRAPPIST-1f", "TRAPPIST-1", 346.622, -5.042, "Aquarius", "Transit", 2017, "Spitzer", 9.208, 0.0385, 0.002, 0.68, 0.093, 1.045, 219, 40.66, 18.80, "M8V", "Cool rocky planet in TRAPPIST-1 habitable zone.", "Hideg sziklás bolygó a TRAPPIST-1 lakható zónájában.", 1),
        ("trappist_1g", "TRAPPIST-1g", "TRAPPIST-1", 346.622, -5.042, "Aquarius", "Transit", 2017, "Spitzer", 12.354, 0.0469, 0.004, 1.148, 0.104, 1.148, 199, 40.66, 18.80, "M8V", "Outer habitable zone planet.", "A lakható zóna külső szélén lévő bolygó.", 1),
        ("51_peg_b", "51 Pegasi b", "51 Pegasi", 344.367, 20.769, "Pegasus", "Radial Velocity", 1995, "OHP", 4.231, 0.052, 0.472, 150.0, 1.27, 14.2, 1284, 50.45, 5.49, "G4V", "First exoplanet discovered around a Sun-like star (Nobel Prize 2019).", "Az első felfedezett exobolygó Nap-típusú csillag körül (Nobel-díj 2019).", 0),
        ("kepler_22b", "Kepler-22b", "Kepler-22", 286.208, 47.884, "Cygnus", "Transit", 2011, "Kepler", 289.862, 0.849, None, None, 0.212, 2.38, 262, 635, 11.66, "G5V", "First confirmed planet in habitable zone by Kepler.", "A Kepler első megerősített lakható zónás bolygója.", 1),
        ("kepler_442b", "Kepler-442b", "Kepler-442", 291.416, 39.268, "Lyra", "Transit", 2015, "Kepler", 112.305, 0.409, None, 2.36, None, 1.34, 233, 1206, 14.97, "K0V", "One of the most Earth-like exoplanets known.", "Az egyik leginkább Föld-szerű ismert exobolygó.", 1),
        ("kepler_452b", "Kepler-452b", "Kepler-452", 286.808, 44.277, "Cygnus", "Transit", 2015, "Kepler", 384.843, 1.046, None, 5.0, None, 1.63, 265, 1402, 13.426, "G2V", "Earth's bigger, older cousin orbiting a Sun-like star.", "A Föld nagyobb, idősebb unokatestvére Nap-típusú csillag körül.", 1),
        ("kepler_186f", "Kepler-186f", "Kepler-186", 297.516, 43.958, "Cygnus", "Transit", 2014, "Kepler", 129.944, 0.432, None, None, None, 1.17, 188, 582, 14.63, "M1V", "First Earth-sized planet in habitable zone.", "Az első Föld-méretű bolygó a lakható zónában.", 1),
        ("gj667c_c", "Gliese 667 Cc", "Gliese 667 C", 259.754, -34.998, "Scorpius", "Radial Velocity", 2011, "ESO/HARPS", 28.143, 0.125, 0.012, 3.81, None, None, 277, 23.62, 10.22, "M1.5V", "Super-Earth in the habitable zone of a triple star system.", "Szuper-Föld egy hármas csillagrendszer lakható zónájában.", 1),
        ("hd209458b", "HD 209458 b (Osiris)", "HD 209458", 330.795, 18.884, "Pegasus", "Transit", 1999, "Multiple", 3.525, 0.047, 0.73, 232.0, 1.38, 15.5, 1449, 157, 7.65, "G0V", "First exoplanet detected by transit method, nicknamed Osiris.", "Az első tranzit módszerrel észlelt exobolygó, beceneve Osiris.", 0),
        ("55_cnc_e", "55 Cancri e", "55 Cancri", 133.149, 28.330, "Cancer", "Transit", 2004, "McDonald Obs.", 0.737, 0.015, 0.025, 7.99, 0.166, 1.875, 2573, 40.25, 5.95, "G8V", "Ultra-hot super-Earth, possibly a lava world.", "Ultraforró szuper-Föld, valószínűleg láva-világ.", 0),
        ("wasp_12b", "WASP-12b", "WASP-12", 97.636, 29.672, "Auriga", "Transit", 2008, "SuperWASP", 1.091, 0.023, 1.47, 467.0, 1.90, 21.3, 2580, 1410, 11.69, "G0V", "Extremely hot Jupiter being consumed by its star.", "Extrém forró Jupiter, amelyet csillaga fokozatosan elnyel.", 0),
        ("gj1214b", "GJ 1214 b", "GJ 1214", 258.833, 4.960, "Ophiuchus", "Transit", 2009, "MEarth", 1.580, 0.014, 0.020, 6.55, 0.244, 2.74, 596, 48.0, 14.67, "M4.5V", "Water world or mini-Neptune with thick atmosphere.", "Víz-világ vagy mini-Neptunusz sűrű légkörrel.", 0),
        ("hr8799b", "HR 8799 b", "HR 8799", 346.870, 21.134, "Pegasus", "Direct Imaging", 2008, "Keck/Gemini", 164250, 68.0, 5.8, 1843.0, 1.2, 13.4, 870, 129, 5.96, "F0V", "First directly imaged exoplanet system.", "Az első közvetlenül lefényképezett exobolygó-rendszer.", 0),
        ("toi700d", "TOI-700 d", "TOI-700", 97.203, -65.578, "Dorado", "Transit", 2020, "TESS", 37.426, 0.163, None, 1.72, None, 1.19, 269, 101.4, 13.15, "M2V", "Earth-sized planet in habitable zone discovered by TESS.", "Föld-méretű bolygó a lakható zónában, a TESS fedezte fel.", 1),
        ("lhs1140b", "LHS 1140 b", "LHS 1140", 44.044, -15.264, "Cetus", "Transit", 2017, "MEarth", 24.737, 0.0946, 0.021, 6.48, 0.146, 1.635, 226, 40.7, 14.15, "M4.5V", "Rocky super-Earth, one of the best targets for atmospheric study.", "Sziklás szuper-Föld, az egyik legjobb célpont légkör-tanulmányozáshoz.", 1),
        ("k2_18b", "K2-18b", "K2-18", 172.560, 7.588, "Leo", "Transit", 2015, "K2/Kepler", 32.940, 0.1429, 0.027, 8.63, 0.211, 2.37, 255, 124, 13.50, "M2.5V", "First exoplanet with water vapor detected in habitable zone.", "Az első exobolygó, amelynek légkörében vízgőzt detektáltak a lakható zónában.", 1),
    ]

    for e in exoplanets:
        cursor.execute('''
            INSERT OR REPLACE INTO exoplanets 
            (id, name, host_star, ra, dec, constellation, discovery_method, discovery_year,
             discovery_facility, orbital_period_days, semi_major_axis_au, mass_jupiter,
             mass_earth, radius_jupiter, radius_earth, equilibrium_temp_k, distance_ly,
             stellar_magnitude, stellar_type, description, description_hu, is_habitable_zone)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', e)

    conn.commit()
    count = cursor.execute("SELECT COUNT(*) FROM exoplanets").fetchone()[0]
    conn.close()
    print(f"✅ {count} exobolygó beszúrva")


def cleanup_old_tables():

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    cursor.execute("DROP TABLE IF EXISTS earth_moon")
    print("✅ earth_moon tábla törölve (solar_system-be migrálva)")

    cursor.execute("DROP TABLE IF EXISTS sun")
    print("✅ sun tábla törölve (solar_system-be migrálva)")

    cursor.execute("DROP TABLE IF EXISTS moons")
    print("✅ moons tábla törölve")

    conn.commit()
    conn.close()

def show_statistics():

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    print("\n" + "=" * 50)
    print("📊 ADATBÁZIS STATISZTIKA")
    print("=" * 50)

    tables = {
        'stars': '⭐ Csillagok',
        'galaxies': '🌌 Galaxisok',
        'nebulae': '🌫️ Ködök',
        'solar_system': '🪐 Naprendszer',
        'exoplanets': '🌍 Exobolygók',
        'constellations': '⛺ Csillagképek',
        'deep_sky_objects': '🔭 Deep Sky (régi)',
        'planets': '🪐 Bolygók (régi)',
    }

    for table, label in tables.items():
        try:
            cursor.execute(f'SELECT COUNT(*) FROM {table}')
            count = cursor.fetchone()[0]
            print(f"  {label}: {count} rekord")
        except:
            print(f"  {label}: - (törölve)")

    conn.close()
    print("=" * 50)

if __name__ == '__main__':
    print("🌟 Planetárium Adatbázis - Teljes Seed")
    print("=" * 50)

    create_new_tables()
    seed_galaxies()
    seed_nebulae()
    seed_solar_system()
    seed_exoplanets()
    cleanup_old_tables()
    show_statistics()

    print(f"\n✅ Kész! Adatbázis: {DATABASE_PATH}")