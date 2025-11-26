import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import FormPage4 from './pages/FormPage4';
import FormPage5 from './pages/FormPage5';
import FormPage6 from './pages/FormPage6';
import FormPage7 from './pages/FormPage7';
import HistorialAsientos from './pages/HistorialAsientos';
import Login from './pages/Login';

const ProtectedRoute = ({ children }) => {
  const { isLoggedIn, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        flexDirection: 'column'
      }}>
        <div style={{ fontSize: '2rem' }}>⏳</div>
        <p>Verificando autenticación...</p>
      </div>
    );
  }

  return isLoggedIn ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          
          <Route path="/login" element={<Login />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="form4" element={<FormPage4 />} />
            <Route path="form5" element={<FormPage5 />} />
            <Route path="form6" element={<FormPage6 />} />
            <Route path="form7" element={<FormPage7 />} />
            <Route path="historial" element={<HistorialAsientos />} />
          </Route>

        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
