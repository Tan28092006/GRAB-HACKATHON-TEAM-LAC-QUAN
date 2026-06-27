import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useApp } from '../context/AppContext';
import '../styles/components/MapView.css';

export default function MapView() {
  const { state } = useApp();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layerGroupRef = useRef(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, {
      center: [state.origin.lat, state.origin.lng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);
    layerGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  // Update markers/route when destination or quote changes
  useEffect(() => {
    const lg = layerGroupRef.current;
    const map = mapInstanceRef.current;
    if (!lg || !map) return;
    lg.clearLayers();

    const origin = state.origin;
    const dest = state.destination;
    if (!dest) return;

    // Create pin icons
    const pickupIcon = L.divIcon({
      className: 'map-pin',
      html: '<div style="font-size:24px;transform:rotate(-20deg)">🧍</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
    const destIcon = L.divIcon({
      className: 'map-pin',
      html: '<div style="font-size:24px">📍</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    // Add markers
    L.marker([origin.lat, origin.lng], { icon: pickupIcon })
      .bindPopup(`<b>Điểm đi</b><br>${origin.name}`)
      .addTo(lg);
    L.marker([dest.lat, dest.lng], { icon: destIcon })
      .bindPopup(`<b>Điểm đến</b><br>${dest.name}`)
      .addTo(lg);

    // Draw route
    if (state.quote?.geometry) {
      L.polyline(state.quote.geometry, {
        color: '#00b14f', weight: 5, opacity: 0.8,
      }).addTo(lg);
    } else {
      L.polyline([[origin.lat, origin.lng], [dest.lat, dest.lng]], {
        color: '#00b14f', weight: 3, dashArray: '10 6', opacity: 0.6,
      }).addTo(lg);
    }

    // Fit bounds
    map.fitBounds([[origin.lat, origin.lng], [dest.lat, dest.lng]], { padding: [40, 40] });
  }, [state.origin, state.destination, state.quote]);

  return <div id="route-map" className="route-map" ref={mapRef} aria-hidden="true" />;
}
