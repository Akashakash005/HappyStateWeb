import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./state/AuthContext";
import { useTheme } from "./state/ThemeContext";
import LoginPage from "./views/LoginPage";
import SignupPage from "./views/SignupPage";
import ShellLayout from "./views/ShellLayout";

function PrivateRoute({ children }) {
  const { user, initializing } = useAuth();
  if (initializing) return <div className="screen-center">Loading HappyState...</div>;
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, initializing } = useAuth();
  if (initializing) return <div className="screen-center">Loading HappyState...</div>;
  return user ? <Navigate to="/" replace /> : children;
}

export default function App() {
  const { modeClassName } = useTheme();

  return (
    <div className={`app-root ${modeClassName}`}>
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicRoute>
              <SignupPage />
            </PublicRoute>
          }
        />
        <Route
          path="/*"
          element={
            <PrivateRoute>
              <ShellLayout />
            </PrivateRoute>
          }
        />
      </Routes>
    </div>
  );
}
