## Leaflet Polydraw Demo

A simple demonstration of the Leaflet Polydraw plugin using TypeScript and Vite.

### Features

- Interactive polygon drawing on Leaflet maps
- TypeScript support
- Modern build system with Vite

### Installation

```bash
npm install
```

### Usage

```bash
npm start
```

This will start a development server at `http://localhost:5173` where you can view the demo.

### Dependencies

- Leaflet: ^1.9.4
- Leaflet Polydraw: ^0.8.5
- TypeScript: ^5.8.3
- Vite: ^6.3.5

### How to Use

1. Click on the map to start drawing a polygon
2. Click additional points to continue the polygon
3. Double-click to complete the polygon
4. Use the drawing tools to edit or delete polygons

### Project Structure

```
leaflet-polydraw-demo/
├── index.html          # Main HTML file
├── package.json        # Project dependencies and scripts
├── package-lock.json   # Locked dependency versions
├── tsconfig.json       # TypeScript configuration
├── README.md           # This file
└── src/
    ├── main.ts         # Main TypeScript file with Leaflet setup
    ├── styles.css      # CSS styles
    └── leaflet-polydraw.d.ts  # TypeScript definitions for Polydraw
```

### Development

To run the development server:
```bash
npm start
```

To build for production:
```bash
npm run build
```

### License

ISC
