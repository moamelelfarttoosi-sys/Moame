import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { Spinner } from "./components/ui";
import { Layout } from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Vendors from "./pages/Vendors";
import Contracts from "./pages/Contracts";
import Requests from "./pages/Requests";
import Orders from "./pages/Orders";
import Users from "./pages/Users";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <Spinner />;
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/contracts" element={<Contracts />} />
        <Route path="/requests" element={<Requests />} />
        <Route path="/orders" element={<Orders />} />
        {user.role === "admin" && <Route path="/users" element={<Users />} />}
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
