// Configuración de la aplicación - Detección automática de entorno
const getConfig = () => {
  // Detectar si estamos en el mismo puerto (modo integrado) o puertos separados (desarrollo)
  const isIntegratedMode = window.location.port === '5000' || 
                          !window.location.port || 
                          window.location.hostname !== 'localhost';

  const config = {
    // URL base de la API
    apiBaseUrl: isIntegratedMode 
      ? window.location.origin 
      : 'http://localhost:5000',
    
    // Modo de la aplicación
    mode: isIntegratedMode ? 'integrated' : 'development',
    
    // Otras configuraciones
    appName: 'Sage200 Contabilidad',
    version: '1.0.0',
    
    // Configuración de la empresa
    empresa: {
      codigo: '9999',
      ejercicio: 2025
    },
    
    // Timeouts
    timeouts: {
      api: 30000,
      session: 24 * 60 * 60 * 1000 // 24 horas
    }
  };

  console.log(`🔧 Configuración cargada: Modo ${config.mode}`);
  console.log(`🔗 API Base URL: ${config.apiBaseUrl}`);
  
  return config;
};

const config = getConfig();
export default config;