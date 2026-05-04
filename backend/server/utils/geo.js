export function toRadians(value) {
  return (Number(value) * Math.PI) / 180
}

export function haversineDistanceKm(pointA, pointB) {
  const lat1 = Number(pointA?.lat)
  const lon1 = Number(pointA?.lng)
  const lat2 = Number(pointB?.lat)
  const lon2 = Number(pointB?.lng)

  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) {
    return null
  }

  const earthRadiusKm = 6371
  const dLat = toRadians(lat2 - lat1)
  const dLon = toRadians(lon2 - lon1)

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return earthRadiusKm * c
}

