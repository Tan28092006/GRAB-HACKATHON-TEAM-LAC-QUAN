import { useState, useCallback } from "react";
import LoginPage from "./components/LoginPage";
import DriverView from "./components/DriverView";
import PassengerView from "./components/PassengerView";

function App() {
  const [user, setUser] = useState(null); // null if not logged in

  const handleLogout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <div className="min-h-dvh flex flex-col bg-surface-dark text-white selection:bg-grab-green/30">
      {/* ── Header (shown when logged in) ────────────────────────────── */}
      {user && (
        <header className="flex items-center gap-3 px-4 py-3 bg-surface-card border-b border-white/10 justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight">
              {user.role === "driver" ? "🚗 Chế độ Tài xế" : "👤 Chế độ Hành khách"}
            </h1>
          </div>
          <button
            onClick={handleLogout}
            aria-label="Đăng xuất"
            className="px-4 py-2 rounded-xl text-sm font-semibold
                       bg-white/10 hover:bg-white/20 active:scale-95
                       transition-all duration-150 cursor-pointer text-white"
          >
            Đăng xuất
          </button>
        </header>
      )}

      {/* ── Main Content ───────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col">
        {!user && (
          <LoginPage onLogin={setUser} />
        )}
        {user && user.role === "driver" && <DriverView user={user} />}
        {user && user.role === "passenger" && <PassengerView user={user} />}
      </main>
    </div>
  );
}

export default App;
