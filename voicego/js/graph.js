/**
 * graph.js
 * Handles construction of the road network graph from seed data.
 */

class Graph {
    constructor() {
        this.nodes = new Map();
        this.adjacencyList = new Map();
    }

    build(nodes, edges) {
        // Map nodes by ID for quick lookup
        nodes.forEach(node => {
            this.nodes.set(node.id, node);
            this.adjacencyList.set(node.id, []);
        });

        // Build adjacency list
        edges.forEach(edge => {
            if (!this.adjacencyList.has(edge.from)) {
                console.warn(`Edge ${edge.id} references unknown from node ${edge.from}`);
                return;
            }
            if (!this.adjacencyList.has(edge.to)) {
                console.warn(`Edge ${edge.id} references unknown to node ${edge.to}`);
                return;
            }

            this.adjacencyList.get(edge.from).push(edge);
        });
    }

    getNode(nodeId) {
        return this.nodes.get(nodeId);
    }

    getNeighbors(nodeId) {
        return this.adjacencyList.get(nodeId) || [];
    }

    // Haversine distance formula to calculate direct distance between two coordinates
    // Returns distance in meters
    static haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371e3; // Earth radius in meters
        const p1 = lat1 * Math.PI / 180;
        const p2 = lat2 * Math.PI / 180;
        const dp = (lat2 - lat1) * Math.PI / 180;
        const dl = (lon2 - lon1) * Math.PI / 180;

        const a = Math.sin(dp / 2) * Math.sin(dp / 2) +
                  Math.cos(p1) * Math.cos(p2) *
                  Math.sin(dl / 2) * Math.sin(dl / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    }
}
