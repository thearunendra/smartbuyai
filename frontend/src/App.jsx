import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./auth";
import Home from "./pages/Home";
import Products from "./pages/Products";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import AdminLogin from "./pages/AdminLogin";
import Admin from "./pages/Admin";
import Chatbot from "./pages/Chatbot";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/products" element={<Products />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/chatbot" element={<Chatbot />} />
          <Route path="/chatbot/:chatId" element={<Chatbot />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
