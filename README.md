# 🔭 Interaktív Webes 3D Planetárium

Egy modern, böngészőalapú 3D planetárium alkalmazás, amely React Three Fiber segítségével jeleníti meg az égboltot valós idejű csillagászati számításokkal, NASA API-integrációkkal és részletes mélyég-objektumokkal.

> **Szakdolgozat** – Eszterházy Károly Katolikus Egyetem, 2026  
> Programtervező Informatikus BSc

---

## 📋 Tartalomjegyzék

- [Funkciók](#-funkciók)
- [Ismert korlátozások](#-ismert-korlátozások)
- [Technológiai stack](#-technológiai-stack)
- [Mappastruktúra](#-mappastruktúra)
- [Telepítés és futtatás](#-telepítés-és-futtatás)
- [Backend – FastAPI](#-backend--fastapi)
- [Frontend – React](#-frontend--react)
- [Adatbázis](#-adatbázis)
- [NASA API integráció](#-nasa-api-integráció)
- [Tesztelés](#-tesztelés)
- [Főbb komponensek](#-főbb-komponensek)

---

## ✨ Funkciók

- **3D égbolt szimuláció** – ~15 598 csillag a Hipparcos-katalógusból, valós fényességgel és spektrálszínekkel
- **88 IAU csillagkép** – vonalrajzokkal és magyar/latin nevekkel
- **Bolygók (VSOP87)** – az `astronomy-engine` csomag segítségével Stellarium-szintű pontossággal kiszámított bolygóállások
- **Hold** – fázis és megvilágítás valós idejű számítása (ELP-alapú modell); a fázis és a megvilágítottság mértéke a Hold infó paneljén jelenik meg
- **Galaxisok és ködök** – GLSL shader-alapú 3D megjelenítés (M31, M42, M57 stb.)
- **Exobolygók** – 21 felfedezett exobolygó interaktív nézettel
- **NASA Dashboard** – APOD, Közel Föld aszteroidák (NeoWs), NASA Képgaléria és EPIC Föld-fotók élő lekérése
- **Aladin Lite v3** – mélyég-objektumok valódi survey képei (DSS, 2MASS, AllWISE stb.)
- **Időszimuláció** – visszatekerhető/gyorsítható idő (1×–2000×), Julian Date-alapú rendszerrel
- **Logaritmikus FOV-vezérlés** – 0,005°–120° között

---

## ⚠️ Ismert korlátozások

- **Hold-fázis megjelenítés**: A Hold fázisának shader-alapú, vizuális megjelenítése jelenleg nem került megvalósításra. A fázisra és a megvilágítottság mértékére vonatkozó adatok a Hold infó paneljén érhetők el numerikusan. A shader-alapú vizuális megjelenítés a jövőbeli fejlesztések között szerepel.

---

## 🛠️ Technológiai stack

### Frontend
| Csomag | Szerep |
|---|---|
| React 18 | UI keretrendszer |
| React Three Fiber + Drei | Three.js deklaratív React wrapper |
| Three.js | 3D renderelés, GLSL shaderek |
| astronomy-engine | VSOP87/ELP csillagászati számítások |
| Aladin Lite v3 | Beágyazott égbolt-survey nézet |
| Tailwind CSS | Stílusozás |
| Vite | Build eszköz |
| Vitest | Frontend unit tesztek |

### Backend
| Csomag | Szerep |
|---|---|
| FastAPI | REST API keretrendszer |
| SQLite | Helyi adatbázis |
| Skyfield + de432s.bsp | Pontosabb efemerida (opcionális) |
| httpx | NASA API lekérések |
| uvicorn | ASGI szerver |

---

## 📁 Mappastruktúra

```
planetarium/
├── backend/                        # A szerver oldali rész – ez fut a háttérben, a böngésző nem látja
│   ├── main.py                     # Az egész backend elindítása innen történik
│   ├── nasa_api.py                 # NASA-tól kéri le az űrfotókat (APOD, Mars, Föld)
│   ├── database/
│   │   ├── database_api.py         # Kiszolgálja a frontend adatkéréseit (csillagok, bolygók stb.)
│   │   ├── init_database.py        # Létrehozza az üres adatbázist, ha még nincs
│   │   ├── seed_data.py            # Feltölti az adatbázist az alapadatokkal
│   │   ├── import_data.py          # Régi JS-fájlból húzza be az adatokat az adatbázisba
│   │   ├── import_hipparcos.py     # A csillagkatalógust (CSV) tölti be (~15 598 csillag)
│   │   ├── import_celestial_data.py# Segédfájl az adatimporthoz
│   │   ├── planetarium.db          # Maga az adatbázisfájl – itt van tárolva minden adat
│   │   ├── hygdata_v41.csv         # A csillagkatalógus nyers adatfájlja (letölthető)
│   │   ├── de432s.bsp              # NASA bolygókoordináta-fájl (Skyfield könyvtárhoz)
│   │   └── test_database.py        # Ellenőrzi, hogy az adatbázisban minden rendben van-e
│   └── requirements.txt            # A backendhez szükséges Python csomagok listája
│
└── frontend/                       # A felhasználó által látott webes felület
    ├── index.html                  # A weboldal HTML váza (egyetlen oldal)
    ├── package.json                # A frontendhez szükséges JS csomagok listája
    ├── vite.config.js              # A fejlesztői szerver beállításai
    ├── tailwind.config.js          # A kinézet (CSS) beállításai
    ├── postcss.config.js           # CSS feldolgozó beállításai
    ├── vitest.config.js            # A tesztek futtatójának beállításai
    ├── src/
    │   ├── App.jsx                 # A teljes alkalmazás magja: a 3D jelenet és minden gomb, panel
    │   ├── main.jsx                # Az alkalmazás elindítása – ez az első fájl, ami lefut
    │   ├── index.css               # Az oldal általános megjelenése (háttérszín, betűtípus stb.)
    │   ├── celestialData.js        # Tartalék adatfájl, ha a backend nem elérhető
    │   ├── astronomyEngine.js      # Kiszámolja, hol van most egy bolygó, a Hold vagy a Nap
    │   ├── AladinViewer.jsx        # Megmutatja egy-egy objektum valódi csillagászati fotóját
    │   ├── NebulaComponents.jsx    # A ködök és galaxisok látványos megjelenítése a 3D-ben
    │   ├── NASADashboard.jsx       # A NASA-képeket megjelenítő panel (APOD, Mars, Föld)
    │   ├── NASADashboard.css       # A NASA-panel saját stílusai
    │   ├── hooks/
    │   │   └── usePlanetariumDB.js # Lekéri az adatbázisból az összes csillagászati adatot
    │   └── utils/
    │       ├── astronomy.js        # Időszámítás és égi koordináták kiszámítása
    │       ├── angularSize.js      # Meghatározza, mekkora legyen egy objektum a képernyőn
    │       ├── coordinates.js      # Égi koordinátákat (RA/Dec) alakít át 3D-s pozícióvá
    │       └── constants.js        # Állandó értékek egy helyen (pl. gömb sugara, FOV határok)
    ├── textures/                   # Képfájlok a bolygók felszínéhez és az égbolt hátteréhez
    │   ├── Nap.jpg, Hold.jpg, Mars.jpg, Jupiter.jpg ...
    │   └── Hatter.jpg
    └── tests/                      # Automatikus ellenőrzések, hogy a számítások helyesek-e
        ├── setup.js                # Előkészíti a tesztkörnyezetet
        ├── angularSize.test.js     # Teszteli az objektumméretek kiszámítását
        ├── astronomy.test.js       # Teszteli az időszámítást és az égitestek pozícióját
        ├── celestialData.test.js   # Teszteli a statikus adatfájl tartalmát
        ├── coordinates.test.js     # Teszteli a koordináta-átalakítást
        └── planetarium.test.js     # Átfogó tesztek az egész rendszerre
```

---

## 🚀 Telepítés és futtatás

### Előfeltételek

- **Node.js** ≥ 18
- **Python** ≥ 3.11
- **pip**

### 1. Repository klónozása

```bash
git clone https://github.com/lilmarikah/DAVHOO_2026.git
cd DAVHOO_2026/planetarium
```

### 2. Backend indítása

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Az API elérhető: `http://localhost:8000`  
Swagger dokumentáció: `http://localhost:8000/docs`

### 3. Frontend indítása

```bash
cd frontend
npm install
npm run dev
```

Az alkalmazás elérhető: `http://localhost:5173`

---

## 🔧 Backend – FastAPI

### Végpontok

#### Csillagászati számítások (Skyfield / DE432s)

| Végpont | Leírás |
|---|---|
| `GET /planets` | Mind a 7 bolygó aktuális pozíciója (RA/Dec, magasság, távolság) |
| `GET /planet/{name}` | Egy bolygó részletes adatai (pl. `/planet/mars`) |
| `GET /sidereal-time` | Helyi és greenwichi csillagidő, Julian-dátum |
| `GET /health` | Szerver állapot (ephemeris és adatbázis betöltve-e) |

#### Adatbázis (`/api/db/`)

| Végpont | Leírás |
|---|---|
| `GET /api/db/all` | Minden adat egyszerre (csillagok, bolygók, galaxisok, ködök, exobolygók, csillagképek) |
| `GET /api/db/stars` | Csillagok szűréssel (`constellation`, `max_mag`, `limit`) |
| `GET /api/db/constellations` | 88 IAU csillagkép vonalrajzokkal |
| `GET /api/db/galaxies` | Galaxisok |
| `GET /api/db/nebulae` | Ködök |
| `GET /api/db/exoplanets` | Exobolygók |
| `GET /api/db/solar-system` | Naprendszer (Nap, Hold, bolygók) |
| `GET /api/db/search?q=` | Keresés (min. 2 karakter) |
| `GET /api/db/stats` | Táblánkénti rekordszámok |

#### NASA API (`/nasa/`)

| Végpont | Leírás |
|---|---|
| `GET /nasa/apod` | Napi csillagászati kép (Astronomy Picture of the Day) |
| `GET /nasa/neo` | Közel Föld aszteroidák (NeoWs) |
| `GET /nasa/epic` | EPIC Föld-fotók (DSCOVR műhold) |

### `main.py`

Az alkalmazás belépési pontja. Beállítja a CORS middleware-t, betölti a DE432s ephemeris fájlt (Skyfield), és regisztrálja a `database_api` és `nasa_api` routereket.

---

## 💻 Frontend – React

### Adatfolyam

```
usePlanetariumDB.js (hook)
    └── GET /api/db/all
         ├── brightStars      → Stars, ConstellationLines komponensek
         ├── planets          → Planet komponensek
         ├── constellationData→ ConstellationLines
         ├── galaxies         → Galaxy3D komponensek
         ├── nebulaeData      → Nebula3D (NebulaComponents.jsx)
         ├── exoplanetsData   → Exoplanet komponensek
         ├── sunData          → Sun komponens
         └── moonData         → Moon komponens
```

### Koordináta-rendszer

Az égbolt belsejéből nézett, right-handed koordináta-rendszer:

```
RA=0h, Dec=0°  →  +X tengely
Dec=+90°       →  +Y tengely
RA=6h, Dec=0°  →  -Z tengely
```

Konverziós képlet (`coordinates.js`):
```js
x =  R · cos(Dec) · cos(RA·15°)
y =  R · sin(Dec)
z = -R · cos(Dec) · sin(RA·15°)
```

### Időrendszer

- Az alkalmazás **Julian Date**-alapon számol időt
- Az aktuális JD-ből `astronomy-engine` számítja a bolygó/Hold/Nap pozíciókat
- A helyi sziderikus idő (LST) meghatározza az égbolt forgatási szögét
- A szimulációs sebesség 1×-tól 2000×-ig állítható

### `astronomyEngine.js`

Az `astronomy-engine` npm csomag wrapperje. Főbb exportok:

| Függvény | Leírás |
|---|---|
| `calculatePlanetPositionPrecise(planet, date)` | Bolygó RA/Dec (VSOP87, AU, elongáció) |
| `calculateSunPositionPrecise(date)` | Nap RA/Dec + ekliptikai hosszúság |
| `calculateMoonPositionPrecise(date)` | Hold RA/Dec, fázis, megvilágítás, távolság |
| `calculateLSTPrecise(date, longitude)` | Helyi sziderikus idő (IAU 2000 ERA) |
| `raDecToAltAz(ra, dec, date, lat, lon)` | Horizontális koordináták |
| `getRiseSet(planetId, date, lat, lon)` | Felkelés/lenyugvás időpontjai |

### `NebulaComponents.jsx`

Volumetrikus GLSL fragment shaderrel rajzolt ködök. Támogatott típusok:

- `emission` – emissziós köd (pl. M42 Orion-köd)
- `planetary` – planetáris köd (pl. M57 Gyűrű-köd)
- `dark` – sötét köd
- `reflection` – reflexiós köd
- `supernova_remnant` – szupernóva-maradvány (pl. M1 Rák-köd)

### `AladinViewer.jsx`

Az Aladin Lite v3-at beágyazó komponens, amely a kijelölt mélyég-objektum körül valódi survey-képet jelenít meg. Elérhető survey-ek: DSS Color, DSS2 Red, 2MASS, AllWISE, Fermi, SDSS, Mellinger.

---

## 🗄️ Adatbázis

A `planetarium.db` SQLite adatbázis az alábbi táblákat tartalmazza:

| Tábla | Tartalom |
|---|---|
| `stars` | ~15 598 csillag (Hipparcos/HYG katalógus, mag ≤ 7.0) |
| `constellations` | 88 IAU csillagkép vonalrajzokkal (JSON), magyar nevekkel |
| `solar_system` | Nap, Hold, 7 bolygó (egységes tábla) |
| `galaxies` | 53 galaxis (M31, M87, M104 stb.) |
| `nebulae` | 28 köd (M42, M57, M1 stb.) |
| `exoplanets` | 21 exobolygó felfedezési adatokkal |

### Adatbázis újraépítése

```bash
cd backend/database
python init_database.py          # séma létrehozása
python seed_data.py              # alap adatok feltöltése
python import_hipparcos.py       # Hipparcos CSV importálása (hygdata_v41.csv szükséges)
```

---

## 🌐 NASA API integráció

A `nasa_api.py` modul a következő NASA végpontokat használja:

- **APOD** – `https://api.nasa.gov/planetary/apod`
- **NeoWs (aszteroidák)** – `https://api.nasa.gov/neo/rest/v1/feed`
- **EPIC** – `https://epic.gsfc.nasa.gov/api/natural`
- **NASA Képgaléria** – `https://images-api.nasa.gov/search` *(a dashboard közvetlenül hívja, nem backend proxyn keresztül)*

> Az API kulcsot a `.env` fájlban kell megadni `NASA_API_KEY` névvel (vagy `DEMO_KEY` is működik korlátozott számban).

---

## 🧪 Tesztelés

### Frontend (Vitest)

```bash
cd frontend
npm run test
```

98 unit teszt az alábbi területeken:
- `astronomy.test.js` (9 teszt) – Julian Date, GMST, LST, Nap/Hold pozíció
- `coordinates.test.js` (8 teszt) – RA/Dec → 3D vektor konverzió
- `angularSize.test.js` (10 teszt) – FOV-konverziók, csillagpontméret
- `celestialData.test.js` (16 teszt) – statikus adatok validálása
- `planetarium.test.js` (55 teszt) – integrált számítási tesztek, holdfázis-nevek, Aladin FOV-küszöbök

### Backend (pytest)

```bash
cd backend/database
pytest test_database.py -v
```

32 teszt az adatbázis integritásának ellenőrzésére:
- Táblák és oszlopok megléte
- Csillagok RA/Dec tartományai
- Ismert csillagok (Sirius, Vega, Betelgeuse, Rigel)
- M31, M42, M57 objektumok
- Bolygók távolság szerinti sorrendje
- Exobolygók lakható zónái és felfedezési módszerei

---

## 🎨 Főbb komponensek áttekintése

| Komponens | Fájl | Leírás |
|---|---|---|
| `App` | `App.jsx` | Főkomponens: Canvas, UI panelek, FOV, keresés, kijelölés |
| `Stars` | `App.jsx` | Hipparcos csillagok pont-geometriaként |
| `ConstellationLines` | `App.jsx` | Csillagkép-vonalak HIP ID alapján |
| `Planet` | `App.jsx` | Textúrázott bolygógömbök, VSOP87 pozícióval |
| `Moon` | `App.jsx` | Hold textúrával, valós pozícióval; fázis és megvilágítás az infó panelen |
| `Sun` | `App.jsx` | Nap glow-effekttel |
| `Galaxy3D` | `App.jsx` | GLSL shader-alapú galaxis-megjelenítés |
| `Nebula3D` | `NebulaComponents.jsx` | Volumetrikus köd shader (5 típus) |
| `AladinInlineViewer` | `AladinViewer.jsx` | Beágyazott Aladin Lite survey panel |
| `NASADashboard` | `NASADashboard.jsx` | NASA API kártyák (APOD, Aszteroidák, NASA Képgaléria, EPIC) |

---

## 📄 Licenc

Szakdolgozat – Eszterházy Károly Katolikus Egyetem, 2026. Minden jog fenntartva.
