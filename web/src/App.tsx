import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Profile } from './pages/Profile';
import { Orders } from './pages/Orders';
import { OrderDetail } from './pages/OrderDetail';
import { NewOrder } from './pages/NewOrder';
import { EditOrder } from './pages/EditOrder';
import { AdminOrders } from './pages/admin/Orders';
import { AdminOrderDetail } from './pages/admin/OrderDetail';
import { AdminWines } from './pages/admin/Wines';
import { AdminPartners } from './pages/admin/Partners';
import { AdminWarehouses } from './pages/admin/Warehouses';
import { WarehouseOrders } from './pages/warehouse/Orders';
import { WarehouseOrderDetail } from './pages/warehouse/OrderDetail';

function RootRedirect() {
  const { token, role } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (role === 'admin') return <Navigate to="/admin/orders" replace />;
  if (role === 'warehouse') return <Navigate to="/warehouse/orders" replace />;
  return <Navigate to="/orders" replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<RootRedirect />} />
            <Route
              path="/orders"
              element={
                <ProtectedRoute role="partner">
                  <Orders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/new"
              element={
                <ProtectedRoute role="partner">
                  <NewOrder />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/:id"
              element={
                <ProtectedRoute role="partner">
                  <OrderDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/orders/:id/edit"
              element={
                <ProtectedRoute role="partner">
                  <EditOrder />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute role="partner">
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route path="/admin" element={<Navigate to="/admin/orders" replace />} />
            <Route
              path="/admin/orders"
              element={
                <ProtectedRoute role="admin">
                  <AdminOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/orders/:id"
              element={
                <ProtectedRoute role="admin">
                  <AdminOrderDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/wines"
              element={
                <ProtectedRoute role="admin">
                  <AdminWines />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/partners"
              element={
                <ProtectedRoute role="admin">
                  <AdminPartners />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/warehouses"
              element={
                <ProtectedRoute role="admin">
                  <AdminWarehouses />
                </ProtectedRoute>
              }
            />
            <Route
              path="/warehouse/orders"
              element={
                <ProtectedRoute role="warehouse">
                  <WarehouseOrders />
                </ProtectedRoute>
              }
            />
            <Route
              path="/warehouse/orders/:id"
              element={
                <ProtectedRoute role="warehouse">
                  <WarehouseOrderDetail />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
