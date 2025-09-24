import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import FormPage1 from './pages/FormPage1';
import FormPage2 from './pages/FormPage2';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';

function App() {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);
  const [user, setUser] = React.useState(null);

  // Verificar si hay sesión al cargar la aplicación
  React.useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = (userData) => {
    setIsLoggedIn(true);
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          isLoggedIn ? <Navigate to="/dashboard" /> : 
          <Login onLogin={handleLogin} />
        } />
        <Route element={<Layout user={user} onLogout={handleLogout} isLoggedIn={isLoggedIn} />}>
          <Route path="/dashboard" element={
            isLoggedIn ? <Dashboard user={user} /> : <Navigate to="/" />
          } />
          <Route path="/form1" element={
            isLoggedIn ? <FormPage1 user={user} /> : <Navigate to="/" />
          } />
          <Route path="/form2" element={
            isLoggedIn ? <FormPage2 user={user} /> : <Navigate to="/" />
          } />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;