import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1A1D24',
            color: '#F0F2F7',
            border: '1px solid #2A2E38',
            borderRadius: '8px',
            fontSize: '13px',
          },
          success: { iconTheme: { primary: '#4FF79A', secondary: '#1A1D24' } },
          error:   { iconTheme: { primary: '#F75F5F', secondary: '#1A1D24' } },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
