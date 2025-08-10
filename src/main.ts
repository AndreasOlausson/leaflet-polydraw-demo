import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Polydraw from 'leaflet-polydraw';
import 'leaflet-polydraw/dist/leaflet-polydraw.css';



const map = L.map('map').setView([58.4108, 15.6214], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '<span>&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors</span>'
}).addTo(map);

const polydraw = new Polydraw();
polydraw.addTo(map as any);
