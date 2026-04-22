from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
from dateutil import parser as date_parser
import os

from skyfield.api import load, Topos, Star

app = FastAPI(
    title="Planetárium 3D API",
    description="""
## Áttekintés

REST API a Planetárium 3D webalkalmazás csillagászati számításaihoz és adatszolgáltatásához.
Az API két fő adatforrásra épül: a NASA JPL DE432s ephemeris fájlra a pontos égitestpozíciókhoz,
valamint egy SQLite adatbázisra a csillagkatalógus és mélységi objektumok adataihoz.

## Csillagászati számítások

A bolygók pozícióit a **Skyfield** Python könyvtár számítja
a **NASA JPL DE432s** ephemeris adatbázis alapján, amely sub-arcszekundum pontosságot biztosít.

- `GET /planets` – Mind a 7 bolygó aktuális RA/dec és alt/az koordinátái
- `GET /planet/{name}` – Egy adott bolygó részletes pozíciója és láthatósága
- `GET /sidereal-time` – Helyi sziderikus idő (LST), GMST, julián-dátum

## Csillagászati adatbázis

Az SQLite adatbázis a következő adatokat tartalmazza:

- **15 598 csillag** – HYG/Hipparcos katalógus alapján, spektráltípussal és fényességgel
- **88 IAU-csillagkép** – összekötővonalakkal JSON formátumban
- **53 galaxis** – morfológiai típus, távolság, szögméret
- **28 köd** – emissziós, planetáris, reflexiós és egyéb típusok
- **21 exobolygó** – NASA Exoplanet Archive alapján
- **9 Naprendszer-objektum** – Nap, Hold és a 7 bolygó textúra- és pályaadatokkal

Elérési prefix: `/api/db`

## NASA API proxy

A következő NASA Open API végpontokat proxyzza a backend:

- `GET /nasa/apod` – Napi csillagászati kép (Astronomy Picture of the Day)
- `GET /nasa/neo` – Közel Föld aszteroidák (NeoWs)
- `GET /nasa/epic` – DSCOVR/EPIC Föld-fotók

## Dokumentáció

- Swagger UI: `/docs`
- ReDoc: `/redoc`
- Állapot: `/health`
    """,
    version="2.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_AVAILABLE = False
try:
    from database.database_api import router as db_router
    app.include_router(db_router)
    DATABASE_AVAILABLE = True
    print("✅ Adatbázis router betöltve")
except ImportError as e:
    print(f"⚠️ Adatbázis router nem elérhető: {e}")
except Exception as e:
    print(f"⚠️ Adatbázis hiba: {e}")

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
EPHEMERIS_FILE = os.path.join(SCRIPT_DIR, 'de432s.bsp')

ts = load.timescale()

if os.path.exists(EPHEMERIS_FILE):
    eph = load(EPHEMERIS_FILE)
    EPHEMERIS_LOADED = True
    EPHEMERIS_NAME = "DE432s (NASA JPL)"
else:
    eph = None
    EPHEMERIS_LOADED = False
    EPHEMERIS_NAME = "Not loaded"

if EPHEMERIS_LOADED:
    earth = eph['earth']
    sun = eph['sun']
    mercury = eph['mercury']
    venus = eph['venus']
    mars = eph['mars barycenter']
    jupiter = eph['jupiter barycenter']
    saturn = eph['saturn barycenter']
    uranus = eph['uranus barycenter']
    neptune = eph['neptune barycenter']

    PLANETS = {
        'mercury': {'body': mercury, 'name': 'Merkúr', 'name_en': 'Mercury', 'color': '#8C7853', 
                    'description': 'A Naprendszer legkisebb bolygója és a Naphoz legközelebbi.'},
        'venus': {'body': venus, 'name': 'Vénusz', 'name_en': 'Venus', 'color': '#FFC649',
                  'description': 'A Föld "ikerbolygója" mérete miatt. Az Esthajnalcsillag.'},
        'mars': {'body': mars, 'name': 'Mars', 'name_en': 'Mars', 'color': '#DC5539',
                 'description': 'A Vörös Bolygó, vasoxid borítja a felszínét.'},
        'jupiter': {'body': jupiter, 'name': 'Jupiter', 'name_en': 'Jupiter', 'color': '#C88B3A',
                    'description': 'A Naprendszer legnagyobb bolygója, gázóriás.'},
        'saturn': {'body': saturn, 'name': 'Szaturnusz', 'name_en': 'Saturn', 'color': '#FAD5A5',
                   'description': 'Gyűrűrendszeréről híres gázóriás.'},
        'uranus': {'body': uranus, 'name': 'Uránusz', 'name_en': 'Uranus', 'color': '#4FD0E7',
                   'description': 'Jégóriás, tengelyferdesége miatt "oldalán" forog.'},
        'neptune': {'body': neptune, 'name': 'Neptunusz', 'name_en': 'Neptune', 'color': '#4B70DD',
                    'description': 'A legtávolabbi bolygó, jégóriás.'},
    }

class Location(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    elevation: float = Field(default=0)

class CelestialPosition(BaseModel):
    name: str
    name_en: Optional[str] = None
    ra: float
    dec: float
    ra_degrees: float
    ra_formatted: Optional[str] = None
    dec_formatted: Optional[str] = None
    alt: Optional[float] = None
    az: Optional[float] = None
    distance_au: Optional[float] = None
    distance_km: Optional[float] = None
    magnitude: Optional[float] = None
    constellation: Optional[str] = None
    is_visible: Optional[bool] = None
    elongation: Optional[float] = None
    description: Optional[str] = None

class SiderealTime(BaseModel):
    gmst: float
    gast: float
    lst: float
    gmst_formatted: str
    lst_formatted: str
    julian_date: float
    mjd: float

def format_ra(hours: float) -> str:
    h = int(hours)
    m = int((hours - h) * 60)
    s = ((hours - h) * 60 - m) * 60
    return f"{h:02d}h {m:02d}m {s:05.2f}s"

def format_dec(degrees: float) -> str:
    sign = '+' if degrees >= 0 else '-'
    d = abs(degrees)
    deg = int(d)
    m = int((d - deg) * 60)
    s = ((d - deg) * 60 - m) * 60
    return f"{sign}{deg:02d}° {m:02d}' {s:05.2f}\""

def format_hours(hours: float) -> str:
    hours = hours % 24
    h = int(hours)
    m = int((hours - h) * 60)
    s = int(((hours - h) * 60 - m) * 60)
    return f"{h:02d}:{m:02d}:{s:02d}"

def get_constellation(ra_hours: float, dec_deg: float) -> str:
    constellations = [
        (0, 2, -30, 0, "Cetus"),
        (0, 2, 0, 30, "Pisces"),
        (2, 4, 20, 50, "Andromeda"),
        (2, 4, 0, 20, "Aries"),
        (4, 6, 10, 30, "Taurus"),
        (5, 6, -10, 10, "Orion"),
        (6, 8, 20, 35, "Gemini"),
        (7, 9, 5, 20, "Cancer"),
        (10, 12, 0, 25, "Leo"),
        (12, 14, -20, 10, "Virgo"),
        (14, 16, 10, 40, "Boötes"),
        (15, 17, -30, -10, "Scorpius"),
        (17, 19, -30, 0, "Sagittarius"),
        (18, 20, 25, 45, "Lyra"),
        (19, 21, 25, 50, "Cygnus"),
        (21, 23, -30, 0, "Capricornus"),
        (22, 24, -20, 0, "Aquarius"),
    ]
    
    for ra_min, ra_max, dec_min, dec_max, name in constellations:
        if ra_min <= ra_hours < ra_max and dec_min <= dec_deg < dec_max:
            return name
    return "—"

def parse_datetime(dt_str: Optional[str]) -> datetime:
    if dt_str:
        try:
            return date_parser.parse(dt_str)
        except:
            pass
    return datetime.utcnow()

def datetime_to_skyfield(dt: datetime):
    return ts.utc(dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second + dt.microsecond/1e6)

def get_planet_position(planet_id: str, t, observer=None):
    if not EPHEMERIS_LOADED:
        raise HTTPException(500, "Ephemeris not loaded")
    
    planet_data = PLANETS[planet_id]
    body = planet_data['body']
    
    if observer:
        astrometric = observer.at(t).observe(body)
        apparent = astrometric.apparent()
        ra, dec, distance = apparent.radec()
        alt, az, _ = apparent.altaz()
        
        sun_astrometric = observer.at(t).observe(sun)
        elongation = astrometric.separation_from(sun_astrometric).degrees
        
        return CelestialPosition(
            name=planet_data['name'],
            name_en=planet_data['name_en'],
            ra=ra.hours,
            dec=dec.degrees,
            ra_degrees=ra.hours * 15,
            ra_formatted=format_ra(ra.hours),
            dec_formatted=format_dec(dec.degrees),
            alt=alt.degrees,
            az=az.degrees,
            distance_au=distance.au,
            distance_km=distance.km,
            constellation=get_constellation(ra.hours, dec.degrees),
            is_visible=alt.degrees > 0,
            elongation=elongation,
            description=planet_data['description']
        )
    else:
        astrometric = earth.at(t).observe(body)
        ra, dec, distance = astrometric.radec()
        sun_astrometric = earth.at(t).observe(sun)
        elongation = astrometric.separation_from(sun_astrometric).degrees
        
        return CelestialPosition(
            name=planet_data['name'],
            name_en=planet_data['name_en'],
            ra=ra.hours,
            dec=dec.degrees,
            ra_degrees=ra.hours * 15,
            ra_formatted=format_ra(ra.hours),
            dec_formatted=format_dec(dec.degrees),
            distance_au=distance.au,
            distance_km=distance.km,
            constellation=get_constellation(ra.hours, dec.degrees),
            elongation=elongation,
            description=planet_data['description']
        )

@app.get("/", tags=["Info"])
async def root():

    return {
        "name": "🔭 Planetárium API",
        "version": "2.1.0",
        "author": "Mariotti Lili",
        "ephemeris": {
            "loaded": EPHEMERIS_LOADED,
            "name": EPHEMERIS_NAME,
        },
        "database": {
            "loaded": DATABASE_AVAILABLE,
            "endpoints": "/api/db/*" if DATABASE_AVAILABLE else None
        },
        "endpoints": {
            "/planets": "Összes bolygó pozíciója",
            "/planet/{name}": "Egy bolygó részletes adatai",
            "/sidereal-time": "Csillagidő számítás",
            "/api/db/stars": "Csillagok adatbázisból",
            "/api/db/galaxies": "Galaxisok",
            "/api/db/nebulae": "Ködök és halmazok",
            "/api/db/search": "Keresés",
            "/api/db/stats": "Adatbázis statisztika"
        }
    }

@app.get("/planets", response_model=List[CelestialPosition], tags=["Bolygók"])
async def get_all_planets(
    datetime_utc: Optional[str] = Query(None),
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
    elevation: float = Query(0)
):

    if not EPHEMERIS_LOADED:
        raise HTTPException(500, "Ephemeris file not loaded")
    
    dt = parse_datetime(datetime_utc)
    t = datetime_to_skyfield(dt)
    
    observer = None
    if latitude is not None and longitude is not None:
        observer = earth + Topos(latitude_degrees=latitude, longitude_degrees=longitude, elevation_m=elevation)
    
    results = []
    for planet_id in PLANETS:
        pos = get_planet_position(planet_id, t, observer)
        results.append(pos)
    
    return results

@app.get("/planet/{planet_name}", response_model=CelestialPosition, tags=["Bolygók"])
async def get_planet(
    planet_name: str,
    datetime_utc: Optional[str] = Query(None),
    latitude: Optional[float] = Query(None, ge=-90, le=90),
    longitude: Optional[float] = Query(None, ge=-180, le=180),
    elevation: float = Query(0)
):

    if not EPHEMERIS_LOADED:
        raise HTTPException(500, "Ephemeris file not loaded")
    
    planet_name = planet_name.lower()
    if planet_name not in PLANETS:
        available = ", ".join(PLANETS.keys())
        raise HTTPException(404, f"Ismeretlen bolygó: {planet_name}. Elérhető: {available}")
    
    dt = parse_datetime(datetime_utc)
    t = datetime_to_skyfield(dt)
    
    observer = None
    if latitude is not None and longitude is not None:
        observer = earth + Topos(latitude_degrees=latitude, longitude_degrees=longitude, elevation_m=elevation)
    
    return get_planet_position(planet_name, t, observer)

@app.get("/sidereal-time", response_model=SiderealTime, tags=["Csillagidő"])
async def get_sidereal_time(
    datetime_utc: Optional[str] = Query(None),
    longitude: float = Query(..., ge=-180, le=180)
):

    dt = parse_datetime(datetime_utc)
    t = datetime_to_skyfield(dt)
    
    gmst = t.gmst
    gast = t.gast
    lst = (gmst + longitude / 15) % 24
    jd = t.tt
    mjd = jd - 2400000.5
    
    return SiderealTime(
        gmst=gmst,
        gast=gast,
        lst=lst,
        gmst_formatted=format_hours(gmst),
        lst_formatted=format_hours(lst),
        julian_date=jd,
        mjd=mjd
    )

@app.get("/health", tags=["Rendszer"])
async def health_check():

    return {
        "status": "healthy" if EPHEMERIS_LOADED else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "version": "2.1.0",
        "ephemeris_loaded": EPHEMERIS_LOADED,
        "database_loaded": DATABASE_AVAILABLE,
    }

try:
    from nasa_api import (
        nasa_client, APODResponse, NEOFeedResponse, NearEarthObject,
        EPICImage,
        format_distance_readable, format_velocity_readable, get_hazard_level
    )
    NASA_API_AVAILABLE = True
except ImportError:
    NASA_API_AVAILABLE = False

if NASA_API_AVAILABLE:
    @app.get("/nasa/apod", tags=["NASA API"])
    async def get_apod(
        date: Optional[str] = Query(None),
        count: Optional[int] = Query(None, ge=1, le=100),
        start_date: Optional[str] = Query(None),
        end_date: Optional[str] = Query(None)
    ):

        try:
            results = await nasa_client.get_apod(date, count, start_date, end_date)
            return [r.model_dump() for r in results]
        except Exception as e:
            raise HTTPException(500, f"NASA API hiba: {str(e)}")

    @app.get("/nasa/neo", tags=["NASA API"])
    async def get_neo_feed(
        start_date: Optional[str] = Query(None),
        end_date: Optional[str] = Query(None)
    ):

        try:
            result = await nasa_client.get_neo_feed(start_date, end_date)
            response = result.model_dump()
            for date_str, objects in response["near_earth_objects"].items():
                for obj in objects:
                    obj["miss_distance_readable"] = format_distance_readable(obj["miss_distance_km"])
                    obj["velocity_readable"] = format_velocity_readable(obj["relative_velocity_kmh"])
                    obj["hazard_info"] = get_hazard_level(obj["is_potentially_hazardous"], obj["miss_distance_lunar"])
            return response
        except Exception as e:
            raise HTTPException(500, f"NASA API hiba: {str(e)}")

    @app.get("/nasa/epic", tags=["NASA API"])
    async def get_epic_images(
        collection: str = Query("natural"),
        date: Optional[str] = Query(None)
    ):
        try:
            results = await nasa_client.get_epic_images(collection, date)
            return [r.model_dump() for r in results]
        except Exception as e:
            print(f"⚠️ EPIC endpoint error: {e}")
            return []

if __name__ == "__main__":
    import uvicorn
    print(f"🔭 Planetárium API v2.1")
    print(f"📦 Ephemeris: {EPHEMERIS_NAME}")
    print(f"🗄️ Database: {'✅' if DATABASE_AVAILABLE else '❌'}")
    print(f"🚀 NASA API: {'✅' if NASA_API_AVAILABLE else '❌'}")
    print(f"🌐 Starting server on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)