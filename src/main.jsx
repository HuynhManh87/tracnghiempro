import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/legacy.css';
import { initPwa } from './pwa';

initPwa();

createRoot(document.getElementById('root')).render(<App/>);
