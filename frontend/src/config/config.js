// config/config.js - VERSIÓN DEFINITIVA
const getConfig = () => {
  const currentHost = window.location.hostname;
  const currentPort = window.location.port;
  
  console.log('🌍 Detección de entorno frontend:', {
    host: currentHost,
    port: currentPort,
    href: window.location.href
  });

  // URL FIJA DEL BACKEND - USANDO LA IP PÚBLICA
  const apiBaseUrl = 'http://192.168.200.236:5000';

  const config = {
    apiBaseUrl: apiBaseUrl,
    mode: 'production',
    appName: 'Sage200 Contabilidad',
    version: '1.0.0',
    
    empresa: {
      codigo: '10000',
      ejercicio: 2025
    },
    
    timeouts: {
      api: 30000, // Aumentar timeout
      session: 15000,
      login: 30000
    }
  };

  console.log('🔧 Configuración FINAL del frontend:');
  console.log('   Backend URL:', config.apiBaseUrl);
  console.log('   Frontend URL:', window.location.href);
  
  return config;
};

const config = getConfig();
export default config;