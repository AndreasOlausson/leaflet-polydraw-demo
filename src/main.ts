import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Polydraw from 'leaflet-polydraw';
import 'leaflet-polydraw/dist/leaflet-polydraw.css';

// coords for a octagon shaped polygon
const octagon: L.LatLng[][][] = [
  [
    [
      L.latLng(58.404493, 15.6),
      L.latLng(58.402928, 15.602928),
      L.latLng(58.4, 15.604493),
      L.latLng(58.397072, 15.602928),
      L.latLng(58.395507, 15.6),
      L.latLng(58.397072, 15.597072),
      L.latLng(58.4, 15.595507),
      L.latLng(58.402928, 15.597072),
      L.latLng(58.404493, 15.6), // Close the polygon
    ],
  ],
];

const squareWithHole: L.LatLng[][][] = [
  [
    // Yttre fyrkanten (moturs)
    [
      L.latLng(58.407, 15.597),
      L.latLng(58.407, 15.603),
      L.latLng(58.397, 15.603),
      L.latLng(58.397, 15.597),
      L.latLng(58.407, 15.597),
    ],
    // Inre fyrkanten (medurs, som hål)
    [
      L.latLng(58.403, 15.599),
      L.latLng(58.403, 15.601),
      L.latLng(58.401, 15.601),
      L.latLng(58.401, 15.599),
      L.latLng(58.403, 15.599),
    ],
  ],
];

const overlappingSquares: L.LatLng[][][] = [
  [
    [
      L.latLng(58.405, 15.595),
      L.latLng(58.405, 15.6),
      L.latLng(58.4, 15.6),
      L.latLng(58.4, 15.595),
      L.latLng(58.405, 15.595),
    ],
  ],
  [
    [
      L.latLng(58.403, 15.598),
      L.latLng(58.403, 15.603),
      L.latLng(58.398, 15.603),
      L.latLng(58.398, 15.598),
      L.latLng(58.403, 15.598),
    ],
  ],
];

// Triangle for testing vertex count (should show 3 vertices)
const triangle: L.LatLng[][][] = [
  [
    [
      L.latLng(58.41, 15.59),
      L.latLng(58.41, 15.595),
      L.latLng(58.405, 15.592),
      L.latLng(58.41, 15.59), // Closing point
    ],
  ],
];

const map = L.map('map').setView([58.4108, 15.6214], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '<span>&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors</span>'
}).addTo(map);

const polydraw = new Polydraw();
polydraw.addTo(map as any);

// Status box update functionality
function updateStatusBox() {
  const featureGroups = polydraw.getFeatureGroups();
  const countElement = document.getElementById('count-value');
  const structureElement = document.getElementById('structure-value');

  if (!structureElement) return;

  // Build structure representation
  const structure = featureGroups.map((featureGroup: any) => {
    let polygonStructure: {
      outer: number;
      holes: number[];
      coordinates: any;
      layer?: L.Polygon;
      metrics?: {
        outerPerimeter: number;
        holePerimeters: number[];
        totalPerimeter: number;
        outerOrientation: 'CW' | 'CCW' | 'N/A';
        holeOrientations: ('CW' | 'CCW' | 'N/A')[];
        bounds?: { sw: L.LatLng; ne: L.LatLng };
      };
      wkt?: string;
    } = {
      outer: 0,
      holes: [],
      coordinates: null,
    };

    featureGroup.eachLayer((layer: any) => {
      if (layer instanceof L.Polygon) {
        const polygon = layer as L.Polygon;
        const latLngs = polygon.getLatLngs();

        // Store raw coordinates for tooltip
        polygonStructure.coordinates = latLngs;
        polygonStructure.layer = polygon;

        // Helper utilities to count vertices accurately whether ring is closed or not
        const isClosedRing = (ring: L.LatLng[]): boolean => {
          if (!Array.isArray(ring) || ring.length < 2) return false;
          const first = ring[0] as L.LatLng;
          const last = ring[ring.length - 1] as L.LatLng;
          // Leaflet's LatLng has an equals method with an optional margin
          if (first && typeof (first as any).equals === 'function') {
            // use a tiny margin to account for floating errors
            return (first as any).equals(last, 1e-9);
          }
          return Math.abs(first.lat - last.lat) < 1e-12 && Math.abs(first.lng - last.lng) < 1e-12;
        };

        const countVertices = (ring: L.LatLng[]): number => {
          if (!Array.isArray(ring)) return 0;
          return ring.length - (isClosedRing(ring) ? 1 : 0);
        };

        // Metric helpers
        const ensureClosed = (ring: L.LatLng[]): L.LatLng[] => {
          if (!ring || ring.length === 0) return ring;
          return isClosedRing(ring) ? ring : [...ring, ring[0]];
        };

        const ringPerimeterMeters = (ring: L.LatLng[]): number => {
          if (!ring || ring.length < 2) return 0;
          const closed = ensureClosed(ring);
          let sum = 0;
          for (let i = 1; i < closed.length; i++) {
            sum += map.distance(closed[i - 1], closed[i]);
          }
          return sum;
        };

        // Signed area (in projected plan units) to infer orientation
        const ringSignedArea = (ring: L.LatLng[]): number => {
          if (!ring || ring.length < 3) return 0;
          const closed = ensureClosed(ring);
          let area = 0;
          const pts = closed.map((ll) => map.project(ll, map.getZoom()));
          for (let i = 1; i < pts.length; i++) {
            const x1 = pts[i - 1].x,
              y1 = pts[i - 1].y;
            const x2 = pts[i].x,
              y2 = pts[i].y;
            area += x1 * y2 - x2 * y1;
          }
          return area / 2;
        };

        const ringOrientation = (ring: L.LatLng[]): 'CW' | 'CCW' | 'N/A' => {
          const a = ringSignedArea(ring);
          if (a === 0) return 'N/A';
          // In pixel space, positive signed area typically indicates CCW
          return a > 0 ? 'CCW' : 'CW';
        };

        // WKT helpers (lng lat order per WKT spec)
        const toWktCoords = (ring: L.LatLng[]): string => {
          const closed = ensureClosed(ring);
          return closed.map((p) => `${p.lng} ${p.lat}`).join(', ');
        };

        const toWktPolygon = (rings: L.LatLng[][]): string => {
          const parts = rings.map((r) => `(${toWktCoords(r)})`).join(', ');
          return `POLYGON (${parts})`;
        };

        // Handle different polygon structures based on actual Leaflet structure
        if (Array.isArray(latLngs) && latLngs.length > 0) {
          // Check if this is a nested array structure (multi-ring)
          if (Array.isArray(latLngs[0])) {
            // Check if it's triple nested: [[[ring1], [ring2]]] or double nested: [[ring]]
            if (Array.isArray(latLngs[0][0])) {
              // Triple nested structure: [[[outer], [hole1], [hole2]]]
              const polygonGroup = latLngs[0] as L.LatLng[][];

              if (polygonGroup.length > 0) {
                // First ring is outer ring
                polygonStructure.outer = countVertices(polygonGroup[0] as L.LatLng[]);

                // Remaining rings are holes
                if (polygonGroup.length > 1) {
                  polygonStructure.holes = polygonGroup
                    .slice(1)
                    .map((ring) => countVertices(ring as L.LatLng[]));
                }
              }
            } else {
              // Double nested structure: [[outer], [hole1], [hole2]]
              const polygonRings = latLngs as L.LatLng[][];

              if (polygonRings.length > 0) {
                // First ring is outer ring
                polygonStructure.outer = countVertices(polygonRings[0] as L.LatLng[]);

                // Remaining rings are holes
                if (polygonRings.length > 1) {
                  polygonStructure.holes = polygonRings
                    .slice(1)
                    .map((ring) => countVertices(ring as L.LatLng[]));
                }
              }
            }
          } else {
            // Simple polygon - single ring - structure: [LatLng, LatLng, LatLng, ...]
            const simpleRing = latLngs as L.LatLng[];
            polygonStructure.outer = countVertices(simpleRing);
          }

          // Compute metrics (perimeters, orientations), bounds and WKT
          try {
            // Normalize to array of rings: [[outer], [hole1], ...]
            let rings: L.LatLng[][] = [];
            if (Array.isArray(latLngs)) {
              if (Array.isArray(latLngs[0])) {
                if (Array.isArray((latLngs as any)[0][0])) {
                  rings = (latLngs as any)[0] as L.LatLng[][];
                } else {
                  rings = latLngs as L.LatLng[][];
                }
              } else {
                rings = [latLngs as L.LatLng[]];
              }
            }

            const outerRing = rings[0] || [];
            const holeRings = rings.slice(1);

            const outerPerimeter = ringPerimeterMeters(outerRing);
            const holePerimeters = holeRings.map((r) => ringPerimeterMeters(r));
            const totalPerimeter = outerPerimeter + holePerimeters.reduce((a, b) => a + b, 0);

            const outerOrientation = ringOrientation(outerRing);
            const holeOrientations = holeRings.map((r) => ringOrientation(r));

            const bounds = polygon.getBounds();

            polygonStructure.metrics = {
              outerPerimeter,
              holePerimeters,
              totalPerimeter,
              outerOrientation,
              holeOrientations,
              bounds: { sw: bounds.getSouthWest(), ne: bounds.getNorthEast() },
            };

            polygonStructure.wkt = toWktPolygon(rings);
          } catch (e) {
            console.warn('Metric/WKT computation failed:', e);
          }
        }
      }
    });

    return polygonStructure;
  });

  // Helper function to format coordinates as clean JSON
  const formatCoordinatesAsJSON = (coords: any): string => {
    if (!coords) return 'No coordinates available';

    // Convert LatLng objects to simple [lat, lng] arrays for cleaner JSON
    const convertLatLngsToArrays = (latLngs: any): any => {
      if (!Array.isArray(latLngs)) return latLngs;

      return latLngs.map((item: any) => {
        if (item && typeof item.lat === 'number' && typeof item.lng === 'number') {
          // This is a LatLng object, convert to [lat, lng]
          return [item.lat, item.lng];
        } else if (Array.isArray(item)) {
          // This is a nested array, recurse
          return convertLatLngsToArrays(item);
        }
        return item;
      });
    };

    const cleanCoords = convertLatLngsToArrays(coords);
    return JSON.stringify(cleanCoords, null, 2);
  };

  // Function to show coordinates in a modal/popup
  const showCoordinatesModal = (coordsData: string, polygonIndex: number) => {
    // Remove existing modal if any
    const existingModal = document.getElementById('coords-modal');
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal
    const modal = document.createElement('div');
    modal.id = 'coords-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
    modal.style.zIndex = '10002';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';

    // Create modal content
    const modalContent = document.createElement('div');
    modalContent.style.backgroundColor = 'white';
    modalContent.style.padding = '20px';
    modalContent.style.borderRadius = '8px';
    modalContent.style.maxWidth = '80%';
    modalContent.style.maxHeight = '80%';
    modalContent.style.overflow = 'auto';
    modalContent.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)';

    // Create header
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '15px';
    header.style.borderBottom = '1px solid #eee';
    header.style.paddingBottom = '10px';

    const title = document.createElement('h3');
    title.textContent = `Polygon ${polygonIndex + 1} Coordinates`;
    title.style.margin = '0';
    title.style.color = '#333';

    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.fontSize = '24px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.color = '#666';
    closeButton.style.padding = '0';
    closeButton.style.width = '30px';
    closeButton.style.height = '30px';

    header.appendChild(title);
    header.appendChild(closeButton);

    // Create content area
    const content = document.createElement('pre');
    content.textContent = coordsData;
    content.style.fontFamily = 'monospace';
    content.style.fontSize = '12px';
    content.style.backgroundColor = '#f5f5f5';
    content.style.padding = '15px';
    content.style.borderRadius = '4px';
    content.style.overflow = 'auto';
    content.style.maxHeight = '400px';
    content.style.margin = '0';
    content.style.whiteSpace = 'pre-wrap';

    modalContent.appendChild(header);
    modalContent.appendChild(content);
    modal.appendChild(modalContent);

    // Close modal handlers
    const closeModal = () => {
      modal.remove();
    };

    closeButton.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Add to document
    document.body.appendChild(modal);
  };

  // Create the structure display with proper formatting
  const structureContainer = document.createElement('div');
  structureContainer.style.fontFamily = 'monospace';
  structureContainer.style.fontSize = '12px';
  structureContainer.style.lineHeight = '1.4';
  structureContainer.style.whiteSpace = 'pre';

  let structureText = '[\n';

  structure.forEach((polygonStructure: any, polygonIndex: number) => {
    if (polygonIndex > 0) {
      structureText += ',\n';
    }

    structureText += '    [\n        ';

    // Create polygon description
    let displayText;
    const metrics = polygonStructure.metrics;
    if (polygonStructure.holes.length === 0) {
      displayText = `[outer: ${polygonStructure.outer} vtx, perim: ${metrics ? (metrics.outerPerimeter !== undefined ? (metrics.outerPerimeter < 1 ? metrics.outerPerimeter.toFixed(2) + ' m' : metrics.outerPerimeter < 1000 ? metrics.outerPerimeter.toFixed(1) + ' m' : (metrics.outerPerimeter / 1000).toFixed(2) + ' km') : '—') : '—'}, ${metrics ? metrics.outerOrientation : '—'}]`;
    } else {
      const holeText =
        polygonStructure.holes.length === 1
          ? `inner: ${polygonStructure.holes[0]} vtx`
          : `inner: ${polygonStructure.holes.join(', ')} vtx`;
      displayText = `[outer: ${polygonStructure.outer} vtx, ${holeText}, total perim: ${metrics ? (metrics.totalPerimeter !== undefined ? (metrics.totalPerimeter < 1 ? metrics.totalPerimeter.toFixed(2) + ' m' : metrics.totalPerimeter < 1000 ? metrics.totalPerimeter.toFixed(1) + ' m' : (metrics.totalPerimeter / 1000).toFixed(2) + ' km') : '—') : '—'}]`;
    }

    structureText += displayText + ' ';

    // We'll add the info button after creating the text node
    structureText += '(i)\n    ]';
  });

  const totalPolygons = structure.length;
  const totalVertices = structure.reduce(
    (acc: number, p: any) => acc + p.outer + p.holes.reduce((a: number, b: number) => a + b, 0),
    0,
  );
  // Close the structure first, then show summary on its own line after
  structureText += `\n]`;
  const summaryLine = `// Summary: ${totalPolygons} polygon(s), ${totalVertices} total vertex/vertices`;
  structureText += `\n${summaryLine}`;

  // Set the base text
  structureContainer.textContent = structureText;

  // Now we need to replace the (i) markers with actual clickable buttons
  const lines = structureText.split('\n');
  structureContainer.innerHTML = ''; // Clear and rebuild with interactive elements

  // Keep track of polygon index for info buttons
  let currentPolygonIndex = 0;

  lines.forEach((line, lineIndex) => {
    if (line.includes('(i)')) {
      // This line has an info button
      const polygonIndex = currentPolygonIndex;

      const beforeInfo = line.substring(0, line.indexOf('(i)'));
      const afterInfo = line.substring(line.indexOf('(i)') + 3);

      // Create line container
      const lineDiv = document.createElement('div');
      lineDiv.style.display = 'inline';

      // Add text before (i)
      const beforeSpan = document.createElement('span');
      beforeSpan.textContent = beforeInfo;
      lineDiv.appendChild(beforeSpan);

      // Create clickable info button
      const infoButton = document.createElement('span');
      infoButton.textContent = '(i)';
      infoButton.style.color = '#007bff';
      infoButton.style.cursor = 'pointer';
      infoButton.style.textDecoration = 'underline';
      infoButton.style.fontWeight = 'bold';
      infoButton.title = 'Click to view coordinates';

      infoButton.addEventListener('click', () => {
        if (polygonIndex < 0 || polygonIndex >= structure.length || !structure[polygonIndex]) {
          console.error(
            'Invalid polygon index:',
            polygonIndex,
            'Structure length:',
            structure.length,
          );
          return;
        }
        const item = structure[polygonIndex];
        const coordsData = formatCoordinatesAsJSON(item.coordinates);

        // Temporary highlight
        try {
          const layer = item.layer as L.Polygon | undefined;
          if (layer && typeof (layer as any).setStyle === 'function') {
            const original = (layer as any).options && { ...(layer as any).options };
            (layer as any).setStyle({ weight: 5 });
            setTimeout(() => {
              if (original) (layer as any).setStyle({ weight: original.weight ?? 3 });
            }, 1200);
          }
        } catch (e) {
          console.warn('Highlight failed:', e);
        }

        // Build a richer modal content string
        let details = '';
        if (item.metrics) {
          const b = item.metrics.bounds;
          details += `Outer perimeter: ${item.metrics.outerPerimeter < 1 ? item.metrics.outerPerimeter.toFixed(2) + ' m' : item.metrics.outerPerimeter < 1000 ? item.metrics.outerPerimeter.toFixed(1) + ' m' : (item.metrics.outerPerimeter / 1000).toFixed(2) + ' km'}\n`;
          if (item.holes.length > 0) {
            details += `Hole perimeters: ${item.metrics.holePerimeters.map((m: number) => (m < 1 ? m.toFixed(2) + ' m' : m < 1000 ? m.toFixed(1) + ' m' : (m / 1000).toFixed(2) + ' km')).join(', ')}\n`;
          }
          details += `Total perimeter: ${item.metrics.totalPerimeter < 1 ? item.metrics.totalPerimeter.toFixed(2) + ' m' : item.metrics.totalPerimeter < 1000 ? item.metrics.totalPerimeter.toFixed(1) + ' m' : (item.metrics.totalPerimeter / 1000).toFixed(2) + ' km'}\n`;
          details += `Outer orientation: ${item.metrics.outerOrientation}`;
          if (item.metrics.holeOrientations.length) {
            details += `, Hole orientations: ${item.metrics.holeOrientations.join(', ')}`;
          }
          details += '\n';
          if (b) {
            details += `Bounds SW: [${b.sw.lat.toFixed(6)}, ${b.sw.lng.toFixed(6)}], NE: [${b.ne.lat.toFixed(6)}, ${b.ne.lng.toFixed(6)}]\n`;
          }
        }

        const wkt = item.wkt ?? '';

        // Show modal with three sections
        showCoordinatesModal(
          `# Metrics\n${details}\n# Coordinates (JSON)\n${coordsData}\n\n# WKT\n${wkt}`,
          polygonIndex,
        );
      });

      // Increment polygon index for next info button
      currentPolygonIndex++;

      lineDiv.appendChild(infoButton);

      // Add text after (i)
      const afterSpan = document.createElement('span');
      afterSpan.textContent = afterInfo;
      lineDiv.appendChild(afterSpan);

      structureContainer.appendChild(lineDiv);
    } else {
      // Regular line without (i)
      const lineDiv = document.createElement('div');
      lineDiv.style.display = 'inline';
      lineDiv.textContent = line;
      structureContainer.appendChild(lineDiv);
    }

    // Add line break except for the last line
    if (lineIndex < lines.length - 1) {
      structureContainer.appendChild(document.createElement('br'));
    }
  });

  // Update count and structure display
  if (countElement) {
    countElement.textContent = featureGroups.length.toString();
  }

  // Clear and add the new structure
  structureElement.innerHTML = '';
  structureElement.appendChild(structureContainer);
}

// Subscribe to polygon changes using proper event handling
(polydraw as any).on('polydraw:polygon:created', () => {
  console.log('Polygon created');
  updateStatusBox();
});

(polydraw as any).on('polydraw:mode:change', (data: any) => {
  console.log('Mode changed to:', data.mode);
  updateStatusBox();
});

// Listen for any polygon operations (add, subtract, delete)
(polydraw as any).on('polygonOperationComplete', () => {
  console.log('Polygon operation completed');
  updateStatusBox();
});

(polydraw as any).on('polygonDeleted', () => {
  console.log('Polygon deleted');
  updateStatusBox();
});

// Initial status update
updateStatusBox();
