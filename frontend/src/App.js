import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import FormPage1 from './pages/FormPage1';
import FormPage2 from './pages/FormPage2';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';

function App() {
  const [isLoggedIn, setIsLoggedIn] = React.useState(false);

  return (
    <Router>
      <Routes>
        <Route path="/" element={
          isLoggedIn ? <Navigate to="/dashboard" /> : <Login setIsLoggedIn={setIsLoggedIn} />
        } />
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/form1" element={isLoggedIn ? <FormPage1 /> : <Navigate to="/" />} />
          <Route path="/form2" element={isLoggedIn ? <FormPage2 /> : <Navigate to="/" />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
