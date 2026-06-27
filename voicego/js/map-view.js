/**
 * map-view.js
 * Small, non-interactive Leaflet map that previews the booked route
 * (pickup -> destination) for sighted helpers and demo viewers.
 */
class RouteMap {
    constructor(containerId) {
        this.map = L.map(containerId, {
            zoomControl: false,
            attributionControl: false,
            dragging: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            touchZoom: false,
            tap: false,
        }).setView([10.7769, 106.7009], 13);

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 18,
        }).addTo(this.map);

        this.layer = L.layerGroup().addTo(this.map);
    }

    clear() {
        this.layer.clearLayers();
    }

    /** route: object with a `path` array of node ids (from local-engine). */
    showRoute(route, originNode, destNode) {
        this.clear();
        if (!route || !route.path || !route.path.length) return;

        const coords = route.path
            .map(id => nodes.find(n => n.id === id))
            .filter(Boolean)
            .map(n => [n.lat, n.lng]);

        const line = L.polyline(coords, {
            color: "#00c853", weight: 6, opacity: 0.9, lineCap: "round",
        });
        this.layer.addLayer(line);

        const pin = (emoji, color) => L.divIcon({
            html: `<div style="background:${color};border:2px solid #fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 3px 6px rgba(0,0,0,.4)">${emoji}</div>`,
            className: "", iconSize: [28, 28], iconAnchor: [14, 28],
        });
        this.layer.addLayer(L.marker([originNode.lat, originNode.lng], { icon: pin("🧍", "#42a5f5") }));
        this.layer.addLayer(L.marker([destNode.lat, destNode.lng], { icon: pin("📍", "#00c853") }));

        this.map.fitBounds(line.getBounds(), { padding: [30, 30] });
        // Map lives in a flex container; recompute size after layout settles.
        setTimeout(() => this.map.invalidateSize(), 200);
    }

    /** Show pickup + an arbitrary geocoded destination point (no graph route). */
    showPoint(originNode, destLat, destLng) {
        this.clear();
        const pin = (emoji, color) => L.divIcon({
            html: `<div style="background:${color};border:2px solid #fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 3px 6px rgba(0,0,0,.4)">${emoji}</div>`,
            className: "", iconSize: [28, 28], iconAnchor: [14, 28],
        });
        const o = L.marker([originNode.lat, originNode.lng], { icon: pin("🧍", "#42a5f5") });
        const d = L.marker([destLat, destLng], { icon: pin("📍", "#00c853") });
        const line = L.polyline([[originNode.lat, originNode.lng], [destLat, destLng]],
            { color: "#00c853", weight: 3, opacity: 0.6, dashArray: "6 8" });
        this.layer.addLayer(line);
        this.layer.addLayer(o);
        this.layer.addLayer(d);
        this.map.fitBounds(line.getBounds(), { padding: [40, 40] });
        setTimeout(() => this.map.invalidateSize(), 200);
    }
}
