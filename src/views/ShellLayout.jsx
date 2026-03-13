import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import {
  IoBulbOutline,
  IoBulbSharp,
  IoChatbubbleEllipsesOutline,
  IoChatbubbleEllipsesSharp,
  IoHomeOutline,
  IoHomeSharp,
  IoPeopleOutline,
  IoPeopleSharp,
  IoPersonCircleOutline,
  IoStatsChartOutline,
  IoStatsChartSharp,
} from "react-icons/io5";
import { useTheme } from "../state/ThemeContext";
import HomePage from "./tabs/HomePage";
import JournalPage from "./tabs/JournalPage";
import AnalyticsPage from "./tabs/AnalyticsPage";
import InsightsPage from "./tabs/InsightsPage";
import CirclePage from "./tabs/CirclePage";
import ProfilePage from "./tabs/ProfilePage";

const tabs = [
  {
    path: "/",
    label: "Home",
    icon: { idle: IoHomeOutline, active: IoHomeSharp },
  },
  {
    path: "/journal",
    label: "Journal",
    icon: {
      idle: IoChatbubbleEllipsesOutline,
      active: IoChatbubbleEllipsesSharp,
    },
  },
  {
    path: "/circle",
    label: "Circle",
    icon: { idle: IoPeopleOutline, active: IoPeopleSharp },
  },
  {
    path: "/analytics",
    label: "Analytics",
    icon: { idle: IoStatsChartOutline, active: IoStatsChartSharp },
  },
  {
    path: "/insights",
    label: "Insights",
    icon: { idle: IoBulbOutline, active: IoBulbSharp },
  },
];

export default function ShellLayout() {
  const { isPrivateMode } = useTheme();
  const location = useLocation();
  const activeTab = tabs.find((tab) =>
    tab.path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(tab.path),
  );
  const pageTitle = activeTab?.label || "HappyState";

  return (
    <div className="app-stage">
      <div className={`phone-shell${isPrivateMode ? " private" : ""}`}>
        <header className="app-header">
          <div className="header-title">{pageTitle}</div>
          <NavLink className="profile-link" to="/profile" aria-label="Profile">
            <IoPersonCircleOutline size={34} />
          </NavLink>
        </header>

        <main className="page-wrap">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/journal" element={<JournalPage />} />
            <Route path="/circle" element={<CirclePage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <nav className="bottom-nav">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              className={({ isActive }) => `bottom-link${isActive ? " active" : ""}`}
              to={tab.path}
              end={tab.path === "/"}
            >
              {({ isActive }) => {
                const Icon = isActive ? tab.icon.active : tab.icon.idle;
                return <Icon size={24} />;
              }}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
