import * as L from 'leaflet';
import Polydraw from 'leaflet-polydraw';
import 'leaflet-polydraw/dist/leaflet-polydraw.css';



const map = L.map('map').setView([51.505, -0.09], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

const polydraw = new Polydraw();
polydraw.addTo(map as any);
