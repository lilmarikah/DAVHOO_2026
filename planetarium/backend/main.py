from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, timedelta
from dateutil import parser as date_parser
import math
import os

from skyfield.api import load, Topos, Star
from skyfield import almanac
from skyfield.framelib import ecliptic_frame

app = FastAPI(
    title="🔭 Planetárium API",
    description="""
    Csillagászati számításokat végző REST API a Planetárium webalkalmazáshoz.
    
    ## 🚀 NASA JPL DE432s Ephemeris
    Ez az API a NASA Jet Propulsion Laboratory DE432s ephemeris adatait használja,
    amely sub-arcsecond pontosságú pozíciószámítást biztosít.
    
    ## 🗄️ SQLite Adatbázis
    Csillagok, galaxisok, ködök és csillagképek adatai.
    
    ## Funkciók
    - **Bolygók pozíciója** - Pontos RA/Dec és Alt/Az koordináták
    - **Hold pozíció és fázis** - Részletes holdinformációk
    - **Nap pozíció** - Napkelte, napnyugta időpontok
    - **Csillagkatalógus** - 717 csillag az adatbázisból
    - **Galaxisok és ködök** - Deep sky objektumok
    
    Készítette: Mariotti Lili - Szakdolgozat
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
    moon = eph['moon']
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

class MoonInfo(BaseModel):
    position: CelestialPosition
    phase: float
    phase_name: str
    phase_emoji: str
    illumination: float
    age_days: float
    distance_km: float
    distance_earth_radii: float
    angular_diameter_arcmin: float
    is_waxing: bool

class SunInfo(BaseModel):
    position: CelestialPosition
    sunrise: Optional[str] = None
    sunset: Optional[str] = None
    solar_noon: Optional[str] = None
    day_length: Optional[str] = None

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

def format_time_short(hours: float) -> str:
    hours = hours % 24
    h = int(hours)
    m = int((hours - h) * 60)
    return f"{h:02d}:{m:02d}"

def get_moon_phase_name(phase: float) -> tuple:
    if phase < 0.025 or phase >= 0.975:
        return ("Újhold", "🌑")
    elif phase < 0.225:
        return ("Növekvő sarló", "🌒")
    elif phase < 0.275:
        return ("Első negyed", "🌓")
    elif phase < 0.475:
        return ("Növekvő hold", "🌔")
    elif phase < 0.525:
        return ("Telihold", "🌕")
    elif phase < 0.725:
        return ("Fogyó hold", "🌖")
    elif phase < 0.775:
        return ("Utolsó negyed", "🌗")
    else:
        return ("Fogyó sarló", "🌘")

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

def get_moon_info(t, observer=None) -> MoonInfo:
    if not EPHEMERIS_LOADED:
        raise HTTPException(500, "Ephemeris not loaded")
    
    if observer:
        astrometric = observer.at(t).observe(moon)
        apparent = astrometric.apparent()
        ra, dec, distance = apparent.radec()
        alt, az, _ = apparent.altaz()
        is_visible = alt.degrees > 0
    else:
        astrometric = earth.at(t).observe(moon)
        ra, dec, distance = astrometric.radec()
        alt, az = None, None
        is_visible = None
    
    sun_pos = earth.at(t).observe(sun)
    moon_pos = earth.at(t).observe(moon)
    
    _, sun_lon, _ = sun_pos.apparent().frame_latlon(ecliptic_frame)
    _, moon_lon, _ = moon_pos.apparent().frame_latlon(ecliptic_frame)
    
    phase_angle = (moon_lon.degrees - sun_lon.degrees) % 360
    phase = phase_angle / 360
    illumination = (1 - math.cos(math.radians(phase_angle))) / 2 * 100
    is_waxing = phase < 0.5
    age_days = phase * 29.53059
    
    distance_km = distance.km
    earth_radius = 6371
    distance_earth_radii = distance_km / earth_radius
    
    moon_radius_km = 1737.4
    angular_diameter = 2 * math.degrees(math.atan(moon_radius_km / distance_km)) * 60
    
    phase_name, phase_emoji = get_moon_phase_name(phase)
    
    position = CelestialPosition(
        name="Hold",
        name_en="Moon",
        ra=ra.hours,
        dec=dec.degrees,
        ra_degrees=ra.hours * 15,
        ra_formatted=format_ra(ra.hours),
        dec_formatted=format_dec(dec.degrees),
        alt=alt.degrees if alt else None,
        az=az.degrees if az else None,
        distance_au=distance.au,
        distance_km=distance_km,
        is_visible=is_visible,
    )
    
    return MoonInfo(
        position=position,
        phase=phase,
        phase_name=phase_name,
        phase_emoji=phase_emoji,
        illumination=illumination,
        age_days=age_days,
        distance_km=distance_km,
        distance_earth_radii=distance_earth_radii,
        angular_diameter_arcmin=angular_diameter,
        is_waxing=is_waxing
    )

def get_sun_info(t, observer, latitude: float, longitude: float, elevation: float = 0) -> SunInfo:
    if not EPHEMERIS_LOADED:
        raise HTTPException(500, "Ephemeris not loaded")
    
    astrometric = observer.at(t).observe(sun)
    apparent = astrometric.apparent()
    ra, dec, distance = apparent.radec()
    alt, az, _ = apparent.altaz()
    
    position = CelestialPosition(
        name="Nap",
        name_en="Sun",
        ra=ra.hours,
        dec=dec.degrees,
        ra_degrees=ra.hours * 15,
        ra_formatted=format_ra(ra.hours),
        dec_formatted=format_dec(dec.degrees),
        alt=alt.degrees,
        az=az.degrees,
        distance_au=distance.au,
        distance_km=distance.km,
        is_visible=alt.degrees > 0,
    )
    
    dt = t.utc_datetime()
    t0 = ts.utc(dt.year, dt.month, dt.day, 0, 0, 0)
    t1 = ts.utc(dt.year, dt.month, dt.day, 23, 59, 59)
    
    result = SunInfo(position=position)
    
    try:
        topos = Topos(latitude_degrees=latitude, longitude_degrees=longitude, elevation_m=elevation)
        f = almanac.sunrise_sunset(eph, topos)
        times, events = almanac.find_discrete(t0, t1, f)
        
        for time, event in zip(times, events):
            time_dt = time.utc_datetime()
            hour = time_dt.hour + time_dt.minute/60 + time_dt.second/3600
            time_str = format_time_short(hour)
            
            if event:
                result.sunrise = time_str
            else:
                result.sunset = time_str
        
        if result.sunrise and result.sunset:
            try:
                sr_parts = result.sunrise.split(':')
                ss_parts = result.sunset.split(':')
                sr_hours = int(sr_parts[0]) + int(sr_parts[1])/60
                ss_hours = int(ss_parts[0]) + int(ss_parts[1])/60
                day_hours = ss_hours - sr_hours
                if day_hours > 0:
                    result.day_length = f"{int(day_hours)}h {int((day_hours % 1) * 60)}m"
            except:
                pass
    except Exception as e:
        if alt.degrees > 0:
            result.day_length = "24h 0m (sarki nappal)"
        else:
            result.day_length = "0h 0m (sarki éjszaka)"
    
    return result

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
            "/moon": "Hold pozíció és fázis",
            "/sun": "Nap pozíció és napkelte/nyugta",
            "/sidereal-time": "Csillagidő számítás",
            "/api/db/stars": "Csillagok adatbázisból",
            "/api/db/planets": "Bolygó adatok",
            "/api/db/galaxies": "Galaxisok",
            "/api/db/dso": "Ködök és halmazok",
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

@app.get("/moon", response_model=MoonInfo, tags=["Hold"])
async def get_moon_endpoint(
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
    
    return get_moon_info(t, observer)

@app.get("/sun", response_model=SunInfo, tags=["Nap"])
async def get_sun_endpoint(
    datetime_utc: Optional[str] = Query(None),
    latitude: float = Query(..., ge=-90, le=90),
    longitude: float = Query(..., ge=-180, le=180),
    elevation: float = Query(0)
):

    if not EPHEMERIS_LOADED:
        raise HTTPException(500, "Ephemeris file not loaded")
    
    dt = parse_datetime(datetime_utc)
    t = datetime_to_skyfield(dt)
    
    observer = earth + Topos(latitude_degrees=latitude, longitude_degrees=longitude, elevation_m=elevation)
    
    return get_sun_info(t, observer, latitude, longitude, elevation)

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
        EPICImage, MarsRoverPhoto,
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

    @app.get("/nasa/mars", tags=["NASA API"])
    async def get_mars_photos(
        rover: str = Query("curiosity"),
        sol: Optional[int] = Query(None),
        earth_date: Optional[str] = Query(None),
        camera: Optional[str] = Query(None),
        page: int = Query(1, ge=1)
    ):

        try:
            results = await nasa_client.get_mars_photos(rover, sol, earth_date, camera, page)
            return [r.model_dump() for r in results]
        except Exception as e:
            print(f"⚠️ Mars photos endpoint error: {e}")
            return []  # Üres lista hiba esetén, ne 500

    @app.get("/nasa/mars/manifest/{rover}", tags=["NASA API"])
    async def get_mars_manifest(rover: str = "curiosity"):

        try:
            result = await nasa_client.get_mars_rover_manifest(rover)
            return result
        except Exception as e:
            print(f"⚠️ Mars manifest endpoint error: {e}")
            return {"name": rover, "status": "unknown", "max_sol": 1000, "total_photos": 0}

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
            return []  # Üres lista hiba esetén, ne 500


if __name__ == "__main__":
    import uvicorn
    print(f"🔭 Planetárium API v2.1")
    print(f"📦 Ephemeris: {EPHEMERIS_NAME}")
    print(f"🗄️ Database: {'✅' if DATABASE_AVAILABLE else '❌'}")
    print(f"🚀 NASA API: {'✅' if NASA_API_AVAILABLE else '❌'}")
    print(f"🌐 Starting server on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)