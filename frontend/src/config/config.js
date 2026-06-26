const config = {
  apiBaseUrl: process.env.REACT_APP_API_URL || 'http://192.168.200.236:5000',
  mode: process.env.NODE_ENV || 'production',
  appName: 'Sage200 Contabilidad',
  version: '1.0.0',

  empresa: {
    codigo: '10000',
    ejercicio: 2025
  },

  timeouts: {
    api: 30000,
    session: 15000,
    login: 30000
  }
};

export default config;