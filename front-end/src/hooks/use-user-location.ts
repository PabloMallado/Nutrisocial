import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LocationPermissionState, UserLocation } from '../types/location-shopping'

interface UseUserLocationResult {
  permission: LocationPermissionState
  location: UserLocation | null
  locationLabel: string
  errorMessage: string | null
  requestLocation: () => void
}

export function useUserLocation(): UseUserLocationResult {
  const supportsGeolocation = typeof navigator !== 'undefined' && 'geolocation' in navigator
  const [permission, setPermission] = useState<LocationPermissionState>(supportsGeolocation ? 'idle' : 'unsupported')
  const [location, setLocation] = useState<UserLocation | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(
    supportsGeolocation ? null : 'Tu navegador no soporta geolocalizacion.',
  )

  useEffect(() => {
    if (!supportsGeolocation) {
      return
    }

    if (!('permissions' in navigator)) {
      return
    }

    navigator.permissions
      .query({ name: 'geolocation' })
      .then((status) => {
        if (status.state === 'granted') setPermission('granted')
        if (status.state === 'denied') {
          setPermission('denied')
          setErrorMessage('Permiso de ubicacion bloqueado. Habilitalo en ajustes del navegador.')
        }
      })
      .catch(() => {
        // Ignore browsers that reject Permissions API requests.
      })
  }, [supportsGeolocation])

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setPermission('unsupported')
      setErrorMessage('Tu navegador no soporta geolocalizacion.')
      return
    }

    setPermission('loading')
    setErrorMessage(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setPermission('granted')
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp,
        })
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setPermission('denied')
          setErrorMessage('No autorizaste el acceso a ubicacion.')
          return
        }
        setPermission('error')
        setErrorMessage('No se pudo obtener tu ubicacion en este momento.')
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      },
    )
  }, [])

  const locationLabel = useMemo(() => {
    if (!location) return 'Ubicacion no disponible'
    const time = new Date(location.timestamp).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    })
    return `Lat ${location.latitude.toFixed(5)}, Lng ${location.longitude.toFixed(5)} · ${time}`
  }, [location])

  return {
    permission,
    location,
    locationLabel,
    errorMessage,
    requestLocation,
  }
}

