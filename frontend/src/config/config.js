// config/config.js
const getConfig = () => {
  const isProduction = window.location.hostname === '99.999.99.999';
  
  const config = {
    // URL base de la API - usa la IP pública en producción
    apiBaseUrl: isProduction 
      ? 'http://99.999.99.999:5000'
      : 'http://localhost:5000',
    
    // Modo de la aplicación
    mode: isProduction ? 'production' : 'development',
    
    appName: 'Sage200 Contabilidad',
    version: '1.0.0',
    
    // Configuración de la empresa
    empresa: {
      codigo: '9999',
      ejercicio: 2025
    },
    
    timeouts: {
      api: 30000,
      session: 24 * 60 * 60 * 1000
    }
  };

  console.log(`🔧 Configuración cargada: Modo ${config.mode}`);
  console.log(`🔗 API Base URL: ${config.apiBaseUrl}`);
  
  return config;
};

const config = getConfig();
export default config;