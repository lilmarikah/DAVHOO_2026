import httpx
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from functools import lru_cache
import asyncio

NASA_API_KEY = "NzSejzWcRrqymu0auyvQXgj8lyt2VD3q6TN0P7Gy"

NASA_BASE_URL = "https://api.nasa.gov"
NASA_EPIC_API_BASE = "https://epic.gsfc.nasa.gov/api"
NASA_EPIC_IMAGE_BASE = "https://epic.gsfc.nasa.gov/archive"

CACHE_TIMEOUT = 3600  # 1 óra

class APODResponse(BaseModel):

    date: str = Field(..., description="Kép dátuma (YYYY-MM-DD)")
    title: str = Field(..., description="Kép címe")
    explanation: str = Field(..., description="Leírás/magyarázat")
    url: str = Field(..., description="Kép URL (normál felbontás)")
    hdurl: Optional[str] = Field(None, description="HD kép URL")
    media_type: str = Field(..., description="Média típus (image/video)")
    copyright: Optional[str] = Field(None, description="Szerzői jog")
    thumbnail_url: Optional[str] = Field(None, description="Thumbnail URL (videóknál)")

class NearEarthObject(BaseModel):

    id: str = Field(..., description="NASA JPL ID")
    name: str = Field(..., description="Aszteroida neve")
    nasa_jpl_url: str = Field(..., description="JPL adatlap URL")
    absolute_magnitude_h: float = Field(..., description="Abszolút fényesség (H)")
    estimated_diameter_min_km: float = Field(..., description="Becsült átmérő min (km)")
    estimated_diameter_max_km: float = Field(..., description="Becsült átmérő max (km)")
    estimated_diameter_min_m: float = Field(..., description="Becsült átmérő min (m)")
    estimated_diameter_max_m: float = Field(..., description="Becsült átmérő max (m)")
    is_potentially_hazardous: bool = Field(..., description="Potenciálisan veszélyes?")
    close_approach_date: str = Field(..., description="Közeli elhaladás dátuma")
    close_approach_date_full: Optional[str] = Field(None, description="Teljes dátum/idő")
    relative_velocity_kmh: float = Field(..., description="Relatív sebesség (km/h)")
    relative_velocity_kms: float = Field(..., description="Relatív sebesség (km/s)")
    miss_distance_km: float = Field(..., description="Elhaladási távolság (km)")
    miss_distance_lunar: float = Field(..., description="Elhaladási távolság (Hold-távolság)")
    miss_distance_au: float = Field(..., description="Elhaladási távolság (AU)")
    orbiting_body: str = Field(..., description="Keringési központ")

class NEOFeedResponse(BaseModel):

    element_count: int = Field(..., description="Objektumok száma")
    start_date: str
    end_date: str
    near_earth_objects: Dict[str, List[NearEarthObject]]
    potentially_hazardous_count: int = Field(..., description="Veszélyes objektumok száma")

class EPICImage(BaseModel):

    identifier: str = Field(..., description="Kép azonosító")
    date: str = Field(..., description="Készítés dátuma")
    caption: str = Field(..., description="Képaláírás")
    image_url: str = Field(..., description="Kép URL")
    thumbnail_url: str = Field(..., description="Thumbnail URL")
    centroid_coordinates: Dict[str, float] = Field(..., description="Középpont koordináták")
    sun_position: Dict[str, float] = Field(..., description="Nap pozíció")
    lunar_position: Dict[str, float] = Field(..., description="Hold pozíció")
    attitude_quaternions: Dict[str, float] = Field(..., description="Műhold orientáció")

class MarsRoverPhoto(BaseModel):

    id: int = Field(..., description="Fotó ID")
    sol: int = Field(..., description="Mars nap (sol)")
    earth_date: str = Field(..., description="Földi dátum")
    img_src: str = Field(..., description="Kép URL")
    camera_name: str = Field(..., description="Kamera neve")
    camera_full_name: str = Field(..., description="Kamera teljes neve")
    rover_name: str = Field(..., description="Rover neve")
    rover_status: str = Field(..., description="Rover státusz")

class NASAClient:
    
    def __init__(self, api_key: str = NASA_API_KEY):
        self.api_key = api_key
        self.base_url = NASA_BASE_URL
        self._cache: Dict[str, tuple] = {}  # Simple in-memory cache
    
    def _get_cache(self, key: str) -> Optional[Any]:

        if key in self._cache:
            data, timestamp = self._cache[key]
            if datetime.now().timestamp() - timestamp < CACHE_TIMEOUT:
                return data
            del self._cache[key]
        return None
    
    def _set_cache(self, key: str, data: Any):

        self._cache[key] = (data, datetime.now().timestamp())
    
    async def _request(self, endpoint: str, params: dict = None) -> dict:

        if params is None:
            params = {}
        params["api_key"] = self.api_key
        
        url = f"{self.base_url}{endpoint}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, params=params)
            response.raise_for_status()
            return response.json()
    
    async def get_apod(self, date: str = None, count: int = None, 
                       start_date: str = None, end_date: str = None,
                       thumbs: bool = True) -> List[APODResponse]:

        cache_key = f"apod_{date}_{count}_{start_date}_{end_date}"
        cached = self._get_cache(cache_key)
        if cached:
            return cached
        
        params = {"thumbs": str(thumbs).lower()}
        if date:
            params["date"] = date
        if count:
            params["count"] = count
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        
        data = await self._request("/planetary/apod", params)
        
        if isinstance(data, dict):
            data = [data]
        
        results = []
        for item in data:
            results.append(APODResponse(
                date=item.get("date", ""),
                title=item.get("title", ""),
                explanation=item.get("explanation", ""),
                url=item.get("url", ""),
                hdurl=item.get("hdurl"),
                media_type=item.get("media_type", "image"),
                copyright=item.get("copyright"),
                thumbnail_url=item.get("thumbnail_url")
            ))
        
        self._set_cache(cache_key, results)
        return results
    
    async def get_neo_feed(self, start_date: str = None, 
                           end_date: str = None) -> NEOFeedResponse:
 
        if not start_date:
            start_date = datetime.now().strftime("%Y-%m-%d")
        if not end_date:
            end_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        
        cache_key = f"neo_{start_date}_{end_date}"
        cached = self._get_cache(cache_key)
        if cached:
            return cached
        
        params = {
            "start_date": start_date,
            "end_date": end_date
        }
        
        data = await self._request("/neo/rest/v1/feed", params)
        
        neo_dict = {}
        hazardous_count = 0
        
        for date_str, objects in data.get("near_earth_objects", {}).items():
            neo_list = []
            for obj in objects:
                close_approach = obj.get("close_approach_data", [{}])[0]
                diameter = obj.get("estimated_diameter", {}).get("kilometers", {})
                diameter_m = obj.get("estimated_diameter", {}).get("meters", {})
                rel_velocity = close_approach.get("relative_velocity", {})
                miss_dist = close_approach.get("miss_distance", {})
                
                is_hazardous = obj.get("is_potentially_hazardous_asteroid", False)
                if is_hazardous:
                    hazardous_count += 1
                
                neo = NearEarthObject(
                    id=obj.get("id", ""),
                    name=obj.get("name", ""),
                    nasa_jpl_url=obj.get("nasa_jpl_url", ""),
                    absolute_magnitude_h=obj.get("absolute_magnitude_h", 0),
                    estimated_diameter_min_km=diameter.get("estimated_diameter_min", 0),
                    estimated_diameter_max_km=diameter.get("estimated_diameter_max", 0),
                    estimated_diameter_min_m=diameter_m.get("estimated_diameter_min", 0),
                    estimated_diameter_max_m=diameter_m.get("estimated_diameter_max", 0),
                    is_potentially_hazardous=is_hazardous,
                    close_approach_date=close_approach.get("close_approach_date", ""),
                    close_approach_date_full=close_approach.get("close_approach_date_full"),
                    relative_velocity_kmh=float(rel_velocity.get("kilometers_per_hour", 0)),
                    relative_velocity_kms=float(rel_velocity.get("kilometers_per_second", 0)),
                    miss_distance_km=float(miss_dist.get("kilometers", 0)),
                    miss_distance_lunar=float(miss_dist.get("lunar", 0)),
                    miss_distance_au=float(miss_dist.get("astronomical", 0)),
                    orbiting_body=close_approach.get("orbiting_body", "Earth")
                )
                neo_list.append(neo)
            
            neo_dict[date_str] = neo_list
        
        result = NEOFeedResponse(
            element_count=data.get("element_count", 0),
            start_date=start_date,
            end_date=end_date,
            near_earth_objects=neo_dict,
            potentially_hazardous_count=hazardous_count
        )
        
        self._set_cache(cache_key, result)
        return result
    
    async def get_neo_lookup(self, asteroid_id: str) -> NearEarthObject:

        cache_key = f"neo_lookup_{asteroid_id}"
        cached = self._get_cache(cache_key)
        if cached:
            return cached
        
        data = await self._request(f"/neo/rest/v1/neo/{asteroid_id}")
        
        close_approaches = data.get("close_approach_data", [])

        now = datetime.now()
        future_approaches = [
            ca for ca in close_approaches 
            if datetime.strptime(ca["close_approach_date"], "%Y-%m-%d") >= now
        ]
        close_approach = future_approaches[0] if future_approaches else (close_approaches[-1] if close_approaches else {})
        
        diameter = data.get("estimated_diameter", {}).get("kilometers", {})
        diameter_m = data.get("estimated_diameter", {}).get("meters", {})
        rel_velocity = close_approach.get("relative_velocity", {})
        miss_dist = close_approach.get("miss_distance", {})
        
        result = NearEarthObject(
            id=data.get("id", ""),
            name=data.get("name", ""),
            nasa_jpl_url=data.get("nasa_jpl_url", ""),
            absolute_magnitude_h=data.get("absolute_magnitude_h", 0),
            estimated_diameter_min_km=diameter.get("estimated_diameter_min", 0),
            estimated_diameter_max_km=diameter.get("estimated_diameter_max", 0),
            estimated_diameter_min_m=diameter_m.get("estimated_diameter_min", 0),
            estimated_diameter_max_m=diameter_m.get("estimated_diameter_max", 0),
            is_potentially_hazardous=data.get("is_potentially_hazardous_asteroid", False),
            close_approach_date=close_approach.get("close_approach_date", ""),
            close_approach_date_full=close_approach.get("close_approach_date_full"),
            relative_velocity_kmh=float(rel_velocity.get("kilometers_per_hour", 0)),
            relative_velocity_kms=float(rel_velocity.get("kilometers_per_second", 0)),
            miss_distance_km=float(miss_dist.get("kilometers", 0)),
            miss_distance_lunar=float(miss_dist.get("lunar", 0)),
            miss_distance_au=float(miss_dist.get("astronomical", 0)),
            orbiting_body=close_approach.get("orbiting_body", "Earth")
        )
        
        self._set_cache(cache_key, result)
        return result
    
    async def _epic_request(self, endpoint: str) -> list:

        url = f"{NASA_EPIC_API_BASE}{endpoint}"
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            return response.json()
    
    async def get_epic_images(self, collection: str = "natural", 
                              date: str = None) -> List[EPICImage]:

        cache_key = f"epic_{collection}_{date}"
        cached = self._get_cache(cache_key)
        if cached:
            return cached
        
        data = None
        
        if date:
            try:
                data = await self._epic_request(f"/{collection}/date/{date}")
            except Exception as e:
                print(f"⚠️ EPIC date query error ({date}): {e}")
        else:
            try:
                data = await self._epic_request(f"/{collection}")
            except Exception as e:
                print(f"⚠️ EPIC latest query error: {e}")
            
            if not data or len(data) == 0:
                try:
                    available = await self._epic_request(f"/{collection}/all")
                    if available and len(available) > 0:
                        latest_date = available[-1].get("date", "").split(" ")[0]
                        if latest_date:
                            data = await self._epic_request(f"/{collection}/date/{latest_date}")
                except Exception as e:
                    print(f"⚠️ EPIC available dates fallback error: {e}")
        
        if not data:
            data = []
        
        results = []
        for item in data:
            img_date = item.get("date", "").split(" ")[0]
            date_parts = img_date.split("-")
            if len(date_parts) == 3:
                year, month, day = date_parts
                image_name = item.get("image", "")
                image_url = f"{NASA_EPIC_IMAGE_BASE}/{collection}/{year}/{month}/{day}/png/{image_name}.png"
                thumb_url = f"{NASA_EPIC_IMAGE_BASE}/{collection}/{year}/{month}/{day}/thumbs/{image_name}.jpg"
            else:
                image_url = ""
                thumb_url = ""
            
            results.append(EPICImage(
                identifier=item.get("identifier", ""),
                date=item.get("date", ""),
                caption=item.get("caption", ""),
                image_url=image_url,
                thumbnail_url=thumb_url,
                centroid_coordinates=item.get("centroid_coordinates", {}),
                sun_position=item.get("sun_j2000_position", {}),
                lunar_position=item.get("lunar_j2000_position", {}),
                attitude_quaternions=item.get("attitude_quaternions", {})
            ))
        
        if results:
            self._set_cache(cache_key, results)
        return results
    
    async def get_mars_photos(self, rover: str = "curiosity", 
                              sol: int = None, earth_date: str = None,
                              camera: str = None, page: int = 1) -> List[MarsRoverPhoto]:

        cache_key = f"mars_{rover}_{sol}_{earth_date}_{camera}_{page}"
        cached = self._get_cache(cache_key)
        if cached:
            return cached
        
        results = []
        
        if sol is None and not earth_date:
            try:
                results = await self._get_mars_latest(rover, camera)
            except Exception as e:
                print(f"⚠️ Mars latest_photos error: {e}")
        
        if not results and (sol is not None or earth_date):
            try:
                params = {"page": page}
                if sol is not None:
                    params["sol"] = sol
                if earth_date:
                    params["earth_date"] = earth_date
                if camera:
                    params["camera"] = camera
                
                data = await self._request(f"/mars-photos/api/v1/rovers/{rover}/photos", params)
                results = self._parse_mars_photos(data)
            except Exception as e:
                print(f"⚠️ Mars photos error (sol={sol}): {e}")
        
        if not results and sol is not None:
            try:
                results = await self._get_mars_latest(rover, camera)
            except Exception as e:
                print(f"⚠️ Mars latest fallback error: {e}")
        
        if results:
            self._set_cache(cache_key, results)
        return results
    
    async def _get_mars_latest(self, rover: str, camera: str = None) -> List[MarsRoverPhoto]:
        params = {}
        if camera:
            params["camera"] = camera
        
        data = await self._request(f"/mars-photos/api/v1/rovers/{rover}/latest_photos", params)
        return self._parse_mars_photos(data, key="latest_photos")
    
    def _parse_mars_photos(self, data: dict, key: str = "photos") -> List[MarsRoverPhoto]:
        results = []
        for photo in data.get(key, []):
            camera_data = photo.get("camera", {})
            rover_data = photo.get("rover", {})
            
            results.append(MarsRoverPhoto(
                id=photo.get("id", 0),
                sol=photo.get("sol", 0),
                earth_date=photo.get("earth_date", ""),
                img_src=photo.get("img_src", ""),
                camera_name=camera_data.get("name", ""),
                camera_full_name=camera_data.get("full_name", ""),
                rover_name=rover_data.get("name", ""),
                rover_status=rover_data.get("status", "")
            ))
        return results
    
    async def get_mars_rover_manifest(self, rover: str = "curiosity") -> dict:
        cache_key = f"mars_manifest_{rover}"
        cached = self._get_cache(cache_key)
        if cached:
            return cached
        
        FALLBACK_MANIFESTS = {
            "curiosity": {
                "name": "Curiosity", "landing_date": "2012-08-06",
                "launch_date": "2011-11-26", "status": "active",
                "max_sol": 4400, "max_date": "2025-03-01", "total_photos": 700000
            },
            "perseverance": {
                "name": "Perseverance", "landing_date": "2021-02-18",
                "launch_date": "2020-07-30", "status": "active",
                "max_sol": 1500, "max_date": "2025-03-01", "total_photos": 300000
            },
            "opportunity": {
                "name": "Opportunity", "landing_date": "2004-01-25",
                "launch_date": "2003-07-07", "status": "complete",
                "max_sol": 5111, "max_date": "2018-06-11", "total_photos": 198439
            },
            "spirit": {
                "name": "Spirit", "landing_date": "2004-01-04",
                "launch_date": "2003-06-10", "status": "complete",
                "max_sol": 2208, "max_date": "2010-03-21", "total_photos": 124550
            }
        }
        
        try:
            data = await self._request(f"/mars-photos/api/v1/manifests/{rover}")
            
            manifest = data.get("photo_manifest", {})
            result = {
                "name": manifest.get("name", ""),
                "landing_date": manifest.get("landing_date", ""),
                "launch_date": manifest.get("launch_date", ""),
                "status": manifest.get("status", ""),
                "max_sol": manifest.get("max_sol", 0),
                "max_date": manifest.get("max_date", ""),
                "total_photos": manifest.get("total_photos", 0)
            }
            
            self._set_cache(cache_key, result)
            return result
        except Exception as e:
            print(f"⚠️ Mars manifest error for {rover}: {e}")
            result = FALLBACK_MANIFESTS.get(rover, FALLBACK_MANIFESTS["curiosity"])
            self._set_cache(cache_key, result)
            return result

nasa_client = NASAClient()

def format_distance_readable(km: float) -> str:
    if km >= 1_000_000:
        return f"{km / 1_000_000:.2f} millió km"
    elif km >= 1000:
        return f"{km / 1000:.1f} ezer km"
    else:
        return f"{km:.0f} km"

def format_velocity_readable(kmh: float) -> str:
    if kmh >= 100_000:
        return f"{kmh / 1000:.0f} km/s"
    else:
        return f"{kmh:.0f} km/h"

def get_hazard_level(is_hazardous: bool, miss_distance_lunar: float) -> dict:
    if is_hazardous and miss_distance_lunar < 10:
        return {
            "level": "high",
            "color": "#ff4444",
            "label": "Magas kockázat",
            "description": "Potenciálisan veszélyes, közel halad el"
        }
    elif is_hazardous:
        return {
            "level": "medium", 
            "color": "#ffaa00",
            "label": "Közepes kockázat",
            "description": "Potenciálisan veszélyes objektum"
        }
    elif miss_distance_lunar < 5:
        return {
            "level": "low",
            "color": "#44ff44",
            "label": "Figyelemre méltó",
            "description": "Közel halad el, de nem veszélyes"
        }
    else:
        return {
            "level": "none",
            "color": "#888888",
            "label": "Nincs kockázat",
            "description": "Biztonságos távolságban halad el"
        }