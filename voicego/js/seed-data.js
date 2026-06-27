/**
 * seed-data.js
 * Contains the mock data for the road network graph, flood zones, and charging stations.
 * Scaled for MVP demo purposes (approx 40-60 nodes, 80-120 edges).
 */

// 1. Vehicle Configuration
const vehicleConfig = {
    batteryCapacityKwh: 60.0,
    currentSocPercent: 85,       // Initial State of Charge
    consumptionKwhPerKm: 0.18,   // Average consumption
    minSafeSocPercent: 10,       // Don't go below this
    lowBatteryThreshold: 25,     // Trigger charging suggestion
    maxWadeDepthCm: 15,          // Safe flood depth limit (15cm)
};

// 2. Nodes (Intersections)
// Focused on Dist 1, Binh Thanh, and route to Dist 7
const nodes = [
    // District 1 (Core)
    { id: "n1", lat: 10.7769, lng: 106.7009, name: "Bến Thành" },
    { id: "n2", lat: 10.7867, lng: 106.6960, name: "Nguyễn Huệ" },
    { id: "n3", lat: 10.7828, lng: 106.7041, name: "Tôn Đức Thắng" },
    { id: "n4", lat: 10.7724, lng: 106.6981, name: "Lê Lợi" },
    { id: "n5", lat: 10.7801, lng: 106.6946, name: "Pasteur" },
    { id: "n6", lat: 10.7845, lng: 106.7001, name: "Hai Bà Trưng" },
    
    // Binh Thanh (Flood prone areas)
    { id: "n7", lat: 10.7912, lng: 106.7125, name: "Ngã tư Hàng Xanh" },
    { id: "n8", lat: 10.7950, lng: 106.7180, name: "Nguyễn Hữu Cảnh (Đầu)" },
    { id: "n9", lat: 10.7890, lng: 106.7100, name: "Nguyễn Hữu Cảnh (Giữa)" },
    { id: "n10", lat: 10.7835, lng: 106.7075, name: "Nguyễn Hữu Cảnh (Cuối)" },
    { id: "n11", lat: 10.7985, lng: 106.7110, name: "Điện Biên Phủ" },
    { id: "n12", lat: 10.8020, lng: 106.7150, name: "Cầu Sài Gòn" },

    // District 4 & 7 (Destination route)
    { id: "n13", lat: 10.7650, lng: 106.7050, name: "Cầu Khánh Hội" },
    { id: "n14", lat: 10.7580, lng: 106.7080, name: "Nguyễn Tất Thành" },
    { id: "n15", lat: 10.7500, lng: 106.7150, name: "Cầu Tân Thuận" },
    { id: "n16", lat: 10.7420, lng: 106.7190, name: "Huỳnh Tấn Phát" },
    { id: "n17", lat: 10.7300, lng: 106.7200, name: "Nguyễn Văn Linh" },
    { id: "n18", lat: 10.7250, lng: 106.7180, name: "Crescent Mall (D7)" },
    
    // Alternative routes
    { id: "n19", lat: 10.7620, lng: 106.6950, name: "Trần Hưng Đạo" },
    { id: "n20", lat: 10.7520, lng: 106.6900, name: "Nguyễn Văn Cừ" },
    { id: "n21", lat: 10.7400, lng: 106.6980, name: "Dương Bá Trạc" }
];

// 3. Edges (Road segments)
// Base time in seconds. Distance approx derived or mocked.
const edges = [
    // D1 network
    { id: "e1", from: "n1", to: "n4", distance: 800, baseTime: 120, roadName: "Lê Lợi", elevation: 2.5 },
    { id: "e2", from: "n4", to: "n1", distance: 800, baseTime: 120, roadName: "Lê Lợi", elevation: 2.5 },
    { id: "e3", from: "n1", to: "n5", distance: 1000, baseTime: 180, roadName: "Pasteur", elevation: 2.8 },
    { id: "e4", from: "n5", to: "n6", distance: 700, baseTime: 100, roadName: "Hai Bà Trưng", elevation: 2.2 },
    { id: "e5", from: "n6", to: "n2", distance: 900, baseTime: 150, roadName: "Nguyễn Huệ", elevation: 2.0 },
    { id: "e6", from: "n2", to: "n3", distance: 1200, baseTime: 180, roadName: "Tôn Đức Thắng", elevation: 1.8 },
    
    // Connect D1 to Binh Thanh (NHC Route - Flood Prone)
    { id: "e7", from: "n3", to: "n10", distance: 800, baseTime: 100, roadName: "Nguyễn Hữu Cảnh", elevation: 1.2 },
    { id: "e8", from: "n10", to: "n9", distance: 1500, baseTime: 200, roadName: "Nguyễn Hữu Cảnh", elevation: 0.8 },
    { id: "e9", from: "n9", to: "n8", distance: 1800, baseTime: 250, roadName: "Nguyễn Hữu Cảnh", elevation: 0.5 },
    { id: "e10", from: "n8", to: "n12", distance: 1200, baseTime: 150, roadName: "Nguyễn Hữu Cảnh", elevation: 1.5 },
    
    // D1 to Binh Thanh (DBP Route - Safer)
    { id: "e11", from: "n6", to: "n11", distance: 2500, baseTime: 300, roadName: "Điện Biên Phủ", elevation: 3.5 },
    { id: "e12", from: "n11", to: "n7", distance: 1000, baseTime: 120, roadName: "Điện Biên Phủ", elevation: 3.2 },
    { id: "e13", from: "n7", to: "n12", distance: 1500, baseTime: 180, roadName: "Điện Biên Phủ", elevation: 3.0 },
    { id: "e14", from: "n7", to: "n9", distance: 800, baseTime: 150, roadName: "Xô Viết Nghệ Tĩnh", elevation: 1.8 }, // Cross connect
    
    // D1 to D4 to D7 (Direct route, somewhat flood prone)
    { id: "e15", from: "n3", to: "n13", distance: 1000, baseTime: 150, roadName: "Tôn Đức Thắng / Cầu KH", elevation: 4.0 },
    { id: "e16", from: "n13", to: "n14", distance: 1500, baseTime: 200, roadName: "Nguyễn Tất Thành", elevation: 1.5 },
    { id: "e17", from: "n14", to: "n15", distance: 2000, baseTime: 250, roadName: "Nguyễn Tất Thành", elevation: 1.2 },
    { id: "e18", from: "n15", to: "n16", distance: 1500, baseTime: 180, roadName: "Huỳnh Tấn Phát", elevation: 0.9 },
    { id: "e19", from: "n16", to: "n17", distance: 2500, baseTime: 300, roadName: "Huỳnh Tấn Phát", elevation: 1.1 },
    { id: "e20", from: "n17", to: "n18", distance: 1000, baseTime: 120, roadName: "Nguyễn Văn Linh", elevation: 2.5 },
    
    // D1 to D7 (Alternative safer route via D5/D8)
    { id: "e21", from: "n1", to: "n19", distance: 1500, baseTime: 200, roadName: "Trần Hưng Đạo", elevation: 3.0 },
    { id: "e22", from: "n19", to: "n20", distance: 2000, baseTime: 250, roadName: "Trần Hưng Đạo / NVC", elevation: 2.8 },
    { id: "e23", from: "n20", to: "n21", distance: 2500, baseTime: 300, roadName: "Dương Bá Trạc", elevation: 3.2 },
    { id: "e24", from: "n21", to: "n17", distance: 4000, baseTime: 400, roadName: "Nguyễn Văn Linh", elevation: 3.5 },

    // Ensure bidirectional for basic MVP
    { id: "e7b", from: "n10", to: "n3", distance: 800, baseTime: 100, roadName: "Nguyễn Hữu Cảnh", elevation: 1.2 },
    { id: "e8b", from: "n9", to: "n10", distance: 1500, baseTime: 200, roadName: "Nguyễn Hữu Cảnh", elevation: 0.8 },
    { id: "e9b", from: "n8", to: "n9", distance: 1800, baseTime: 250, roadName: "Nguyễn Hữu Cảnh", elevation: 0.5 },
    { id: "e10b", from: "n12", to: "n8", distance: 1200, baseTime: 150, roadName: "Nguyễn Hữu Cảnh", elevation: 1.5 },
    
    { id: "e11b", from: "n11", to: "n6", distance: 2500, baseTime: 300, roadName: "Điện Biên Phủ", elevation: 3.5 },
    { id: "e12b", from: "n7", to: "n11", distance: 1000, baseTime: 120, roadName: "Điện Biên Phủ", elevation: 3.2 },
    { id: "e13b", from: "n12", to: "n7", distance: 1500, baseTime: 180, roadName: "Điện Biên Phủ", elevation: 3.0 },
    
    { id: "e16b", from: "n14", to: "n13", distance: 1500, baseTime: 200, roadName: "Nguyễn Tất Thành", elevation: 1.5 },
    { id: "e17b", from: "n15", to: "n14", distance: 2000, baseTime: 250, roadName: "Nguyễn Tất Thành", elevation: 1.2 },
    { id: "e18b", from: "n16", to: "n15", distance: 1500, baseTime: 180, roadName: "Huỳnh Tấn Phát", elevation: 0.9 },
    { id: "e19b", from: "n17", to: "n16", distance: 2500, baseTime: 300, roadName: "Huỳnh Tấn Phát", elevation: 1.1 },
    { id: "e20b", from: "n18", to: "n17", distance: 1000, baseTime: 120, roadName: "Nguyễn Văn Linh", elevation: 2.5 },
    
    { id: "e21b", from: "n19", to: "n1", distance: 1500, baseTime: 200, roadName: "Trần Hưng Đạo", elevation: 3.0 },
    { id: "e22b", from: "n20", to: "n19", distance: 2000, baseTime: 250, roadName: "Trần Hưng Đạo / NVC", elevation: 2.8 },
    { id: "e23b", from: "n21", to: "n20", distance: 2500, baseTime: 300, roadName: "Dương Bá Trạc", elevation: 3.2 },
    { id: "e24b", from: "n17", to: "n21", distance: 4000, baseTime: 400, roadName: "Nguyễn Văn Linh", elevation: 3.5 }
];

// 4. Flood Zones
const floodZones = [
    {
        id: "fz1",
        name: "Nguyễn Hữu Cảnh (Bình Thạnh)",
        // Rough polygon around NHC
        polygon: [
            [10.7960, 106.7160], [10.7960, 106.7200], [10.7810, 106.7090], [10.7810, 106.7050]
        ],
        severity: "high",
        depthCm: 45, // Unsafe for EVs (>15cm)
        triggerRainMm: 50,
        affectedEdges: ["e7", "e8", "e9", "e10", "e7b", "e8b", "e9b", "e10b"],
        isActive: false
    },
    {
        id: "fz2",
        name: "Huỳnh Tấn Phát (Quận 7)",
        polygon: [
            [10.7450, 106.7170], [10.7450, 106.7210], [10.7280, 106.7220], [10.7280, 106.7180]
        ],
        severity: "medium",
        depthCm: 25, // Unsafe for EVs
        triggerRainMm: 40,
        affectedEdges: ["e18", "e19", "e18b", "e19b"],
        isActive: false
    },
    {
        id: "fz3",
        name: "Nguyễn Tất Thành (Quận 4)",
        polygon: [
            [10.7600, 106.7060], [10.7600, 106.7100], [10.7480, 106.7170], [10.7480, 106.7130]
        ],
        severity: "low",
        depthCm: 12, // Passable but slow
        triggerRainMm: 60,
        affectedEdges: ["e16", "e17", "e16b", "e17b"],
        isActive: false
    }
];

// 5. Charging Stations
const chargingStations = [
    {
        id: "cs1",
        name: "Tasco Auto Quận 1 (Trần Hưng Đạo)",
        lat: 10.7625, lng: 106.6945,
        provider: "tasco",
        pricePerKwh: 4550, // Discounted
        marketPrice: 7000,
        chargerType: "DC_fast",
        powerKw: 60,
        available: true,
        waitTimeMin: 0,
        nearestNode: "n19"
    },
    {
        id: "cs2",
        name: "Esky Station (Điện Biên Phủ)",
        lat: 10.7980, lng: 106.7100,
        provider: "esky",
        pricePerKwh: 4550,
        marketPrice: 7000,
        chargerType: "DC_fast",
        powerKw: 120,
        available: true,
        waitTimeMin: 5,
        nearestNode: "n11"
    },
    {
        id: "cs3",
        name: "Trạm sạc Quận 7 (Crescent Mall)",
        lat: 10.7255, lng: 106.7185,
        provider: "other",
        pricePerKwh: 7500, // No discount
        marketPrice: 7500,
        chargerType: "AC_level2",
        powerKw: 22,
        available: true,
        waitTimeMin: 0,
        nearestNode: "n18"
    }
];
