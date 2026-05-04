import math


def haversine_distance_km(point_a: dict, point_b: dict) -> float | None:
    try:
        lat1 = float(point_a["lat"])
        lon1 = float(point_a["lng"])
        lat2 = float(point_b["lat"])
        lon2 = float(point_b["lng"])
    except (KeyError, TypeError, ValueError):
        return None

    earth_radius_km = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)

    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return earth_radius_km * c
