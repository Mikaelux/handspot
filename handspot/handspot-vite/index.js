import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from '../handspot-vite/App';
import reportWebVitals from './reportWebVitals';
import SongCarousel from '../handspot-vite/car';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App/>
      <SongCarousel/>
  </React.StrictMode>
);