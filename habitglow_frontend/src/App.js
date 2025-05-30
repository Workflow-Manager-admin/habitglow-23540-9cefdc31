import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./App.css";

// =================== Theme and Color Setup ===================
const pastelGradients = [
  "linear-gradient(135deg, #a5b4fc 0%, #81e6d9 100%)",
  "linear-gradient(120deg, #7b61ff 0%, #6ee7b7 100%)",
  "linear-gradient(110deg, #a5b4fc 0%, #7b61ff 100%)",
];
const logoEmoji = "✨"; // For HabitSpark
const ACCENT_COLOR = "#A5B4FC";
const PRIMARY_COLOR = "#7B61FF";
const SECONDARY_COLOR = "#6EE7B7";

// =================== Utility Functions ===================
const LOCAL_STORAGE_KEYS = {
  USER: "habitspark_user",
  HABITS: "habitspark_habits",
  SETTINGS: "habitspark_settings",
  LAST_CHECKIN: "habitspark_last_checkin",
};
// Helper: Get and set from localStorage
const getStorage = (key, fallback) => {
  const val = localStorage.getItem(key);
  try {
    if (val) return JSON.parse(val);
  } catch {}
  return fallback;
};
const setStorage = (key, val) => {
  localStorage.setItem(key, JSON.stringify(val));
};
const clearStorage = () => {
  Object.values(LOCAL_STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
};

// Date helpers
function todayStr() {
  return new Date().toISOString().split("T")[0];
}
function getNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}
function dateIsToday(str) {
  return str === todayStr();
}
function isConsecutive(dateStr1, dateStr2) {
  const d1 = new Date(dateStr1);
  const d2 = new Date(dateStr2);
  const diff = (d2 - d1) / (1000 * 60 * 60 * 24);
  return diff === 1;
}

// =================== Core Models ===================
/*
  Habit = {
    id: string,
    name: string,
    emoji: string,
    frequency: array of week days ["Mon",...],
    streak: number,
    bestStreak: number,
    history: [dateStr, ...] (when completed),
    reminders: {enabled: bool, time: "09:00"},
    created: date,
    color: "#...",
  }
*/
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// =================== Global Context (Quick + Simple) ===================
const emptyUser = { isAuthenticated: false, name: "", email: "", onboardingDone: false };
const emptySettings = { dark: false, notifications: false };
const emptyHabitList = [];

// =================== Main App ===================
function App() {
  // -------------- Application State --------------
  const [user, setUser] = useState(() => getStorage(LOCAL_STORAGE_KEYS.USER, emptyUser));
  const [habits, setHabits] = useState(() => getStorage(LOCAL_STORAGE_KEYS.HABITS, emptyHabitList));
  const [settings, setSettings] = useState(() => getStorage(LOCAL_STORAGE_KEYS.SETTINGS, emptySettings));
  const [route, setRoute] = useState(() =>
    user.onboardingDone ? "home" : "onboarding"
  );
  const [toast, setToast] = useState(null); // {type, msg}
  const [showHabitForm, setShowHabitForm] = useState(false);
  const [editHabitId, setEditHabitId] = useState(null);
  const [showStreak, setShowStreak] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // -------------- State Persistence --------------
  useEffect(() => setStorage(LOCAL_STORAGE_KEYS.USER, user), [user]);
  useEffect(() => setStorage(LOCAL_STORAGE_KEYS.HABITS, habits), [habits]);
  useEffect(() => setStorage(LOCAL_STORAGE_KEYS.SETTINGS, settings), [settings]);

  // -------------- Theme Sync --------------
  useEffect(() => {
    document.body.style.background = settings.dark
      ? "linear-gradient(120deg,#181926 0%,#2d3748 100%)"
      : pastelGradients[0];
    document.body.style.color = settings.dark ? "#fff" : "#23272f";
  }, [settings.dark]);

  // -------------- Habit Completion Logic --------------
  const completeHabit = useCallback((habitId) => {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        if (h.history && h.history.find(dateIsToday)) return h; // Already completed today
        // Streak: check last check-in and see if consecutive.
        const sortedHistory = [...h.history, todayStr()].sort();
        let newStreak = 1;
        let best = h.bestStreak || 1;
        let consecutive = 1;
        // Calculate streak by descending order
        for (let i = sortedHistory.length - 2; i >= 0; i--) {
          if (isConsecutive(sortedHistory[i], sortedHistory[i+1])) {
            consecutive++;
            best = Math.max(best, consecutive);
          } else {
            consecutive=1;
          }
        }
        newStreak = consecutive;

        return {
          ...h,
          history: [...h.history, todayStr()],
          streak: newStreak,
          bestStreak: Math.max(best, newStreak)
        };
      })
    );
    setToast({ type: "success", msg: "Great job! Habit marked as complete." });
  }, []);

  const undoHabit = useCallback((habitId) => {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        const newHist = h.history.filter((date) => !dateIsToday(date));
        // Recalculate streak and best streak
        let newStreak = 0;
        let bestStreak = 0;
        let s = 0;
        for (let i = 0; i < newHist.length; ++i) {
          if (i === 0 || isConsecutive(newHist[i-1], newHist[i])) {
            s = s ? s + 1 : 1;
          } else s = 1;
          bestStreak = Math.max(bestStreak, s);
        }
        newStreak = (newHist.length && isConsecutive(newHist[newHist.length-2]||"", newHist[newHist.length-1])) ? s : 0;
        return { ...h, history: newHist, streak: newStreak, bestStreak };
      })
    );
    setToast({type:"info", msg: "Completion undone."});
  }, []);

  const updateHabit = (habitObj) => {
    if (!habitObj.id) return;
    setHabits((prev) =>
      prev.map((h) => (h.id === habitObj.id ? { ...h, ...habitObj } : h))
    );
    setToast({ type: "success", msg: "Habit updated." });
  };

  const addHabit = (habitObj) => {
    setHabits((prev) => [...prev, { ...habitObj }]);
    setToast({ type: "success", msg: "Habit added!" });
  };

  const deleteHabit = (id) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setToast({ type: "info", msg: "Habit deleted." });
  };

  // -------------- Navigation Helpers --------------
  const goto = useCallback(
    (to) => {
      setRoute(to);
      setShowHabitForm(false);
      setShowStreak(false);
      setShowSettings(false);
      setEditHabitId(null);
    },
    []
  );
  const openHabitForm = (habitId = null) => {
    setEditHabitId(habitId);
    setShowHabitForm(true);
  };

  // -------------- Toast (Notification/Reminders) --------------
  useEffect(() => {
    if (toast) {
      const timeout = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(timeout);
    }
  }, [toast]);

  // -------------- Reminders Simulation (Mock) --------------
  useEffect(() => {
    if (!settings.notifications) return;
    // Simulate notification for habits with reminder enabled and not completed today.
    const now = new Date();
    const checkReminders = () => {
      if (!Array.isArray(habits)) return;
      habits.forEach((h) => {
        if (
          h.reminders &&
          h.reminders.enabled &&
          !h.history.find(dateIsToday)
        ) {
          const [hrStr, minStr] = (h.reminders.time || "09:00").split(":");
          const nowMinutes = now.getHours() * 60 + now.getMinutes();
          const habitMinutes = parseInt(hrStr, 10) * 60 + parseInt(minStr, 10);
          if (nowMinutes >= habitMinutes && nowMinutes < habitMinutes + 5) {
            setToast({
              type: "reminder",
              msg: `Don't forget: ${h.emoji || "🌟"} ${h.name}`,
            });
          }
        }
      });
    };
    const interval = setInterval(checkReminders, 60000); // Check every min
    return () => clearInterval(interval);
    // eslint-disable-next-line
  }, [habits, settings.notifications]);

  // -------------- Derived Values --------------
  const todayHabits = useMemo(() => {
    const wd = WEEKDAYS[new Date().getDay()];
    return habits.filter((h) =>
      Array.isArray(h.frequency)
        ? h.frequency.includes(wd)
        : true
    );
  }, [habits]);

  const allDoneToday = useMemo(() =>
    todayHabits.length > 0 && todayHabits.every((h) => h.history.find(dateIsToday)), [todayHabits]
  );

  // -------------- Authentication Mocks --------------
  const handleMockAuth = (provider) => {
    // Simulate Google login; real OAuth not implemented.
    setUser({
      isAuthenticated: true,
      name: "Demo User",
      email: "demo@example.com",
      onboardingDone: true,
    });
    setRoute("home");
  };

  // Listen to "close-settings" event to close Settings in parent (for modal UI)
  useEffect(() => {
    function closeSettingsHandler() {
      setShowSettings(false);
    }
    window.addEventListener("close-settings", closeSettingsHandler);
    return () => window.removeEventListener("close-settings", closeSettingsHandler);
  }, []);

  // ============== Render Application ==============
  return (
    <div className={`app${settings.dark ? " dark" : ""}`}>
      <HabitSparkNav
        user={user}
        goto={goto}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        accent={ACCENT_COLOR}
        showStreak={showStreak}
        setShowStreak={setShowStreak}
      />
      <main style={{ marginTop: 82, minHeight: "80vh" }}>
        <div className="container" style={{ maxWidth: 520, margin: "0 auto" }}>
          {/* Page Routing */}
          {route === "onboarding" && (
            <OnboardingPage
              user={user}
              onLogin={handleMockAuth}
              onContinue={() => {
                setUser({ ...user, onboardingDone: true });
                setRoute("home");
              }}
            />
          )}

          {route === "home" && (
            (habits.length === 0) ? (
              <EmptyStatePage onAdd={() => openHabitForm()} />
            ) : (
              <HomePage
                habits={todayHabits}
                allDoneToday={allDoneToday}
                onCheck={completeHabit}
                onUndo={undoHabit}
                onEdit={openHabitForm}
                onDelete={deleteHabit}
                openStreak={() => setShowStreak(true)}
                today={todayStr()}
              />
            )
          )}

          {/* "Floating" Add Button */}
          {route === "home" && habits.length > 0 && (
            <FloatingAddButton onClick={() => openHabitForm()} />
          )}

          {/* Add/Edit Habit Modal */}
          {showHabitForm && (
            <HabitFormModal
              onClose={() => setShowHabitForm(false)}
              onSave={(habit) => {
                if (editHabitId) updateHabit(habit);
                else addHabit(habit);
                setShowHabitForm(false);
              }}
              existingHabit={
                editHabitId
                  ? habits.find((h) => h.id === editHabitId)
                  : null
              }
              allHabits={habits}
              accentColor={ACCENT_COLOR}
            />
          )}

          {/* Streak Page */}
          {showStreak && (
            <StreakPage
              habits={habits}
              onClose={() => setShowStreak(false)}
              accentColor={PRIMARY_COLOR}
            />
          )}

          {/* Settings Page */}
          {showSettings && (
            <SettingsPage
              settings={settings}
              setSettings={setSettings}
              onLogout={() => {
                setUser(emptyUser);
                clearStorage();
                setRoute("onboarding");
              }}
              onDataReset={() => {
                setHabits(emptyHabitList);
                setToast({type:"info", msg:"All data reset."});
              }}
              accentColor={PRIMARY_COLOR}
            />
          )}

          {/* Toast Notifications/Reminders */}
          <ToastContainer toast={toast} />
        </div>
      </main>
    </div>
  );
}

// =================== NAVBAR ===================
function HabitSparkNav({
  user,
  goto,
  showSettings,
  setShowSettings,
  accent,
  showStreak,
  setShowStreak,
}) {
  return (
    <nav className="navbar" style={{
      background: "rgba(255,255,255,0.16)",
      borderBottom: "1px solid var(--border-color)",
      boxShadow: "0 1px 5px 0 rgba(131,105,255,0.03)",
      position: 'fixed',
      width: "100%",
      left: 0,
      top: 0,
      zIndex: 1030,
      backdropFilter: "blur(8px)",
    }}>
      <div className="container" style={{display:"flex",alignItems:"center",justifyContent:"space-between",maxWidth:520}}>
        <div className="logo">
          <span className="logo-symbol" style={{fontSize:"1.7rem", color: accent}}>{logoEmoji}</span>
          <span className="logo-text" style={{fontWeight:700, marginLeft:6,color:accent}}>HabitSpark</span>
        </div>
        <div>
          {/* Settings & Streak Buttons */}
          {user.onboardingDone && (
            <>
              <button
                className="btn"
                style={{background:"none", color:accent,marginRight:3,padding:"6px 10px"}}
                onClick={()=>setShowStreak(s=>!s)}
                aria-label="View Streak/Progress"
              >
                <span role="img" aria-label="flame" style={{fontSize:18}}>🔥</span>
              </button>
              <button
                className="btn"
                onClick={()=>setShowSettings(s=>!s)}
                aria-label="Settings"
                style={{background:"none",color:accent,padding:"6px 10px"}}
              >
                <span role="img" aria-label="cog" style={{fontSize:18}}>⚙️</span>
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

// =================== ONBOARDING PAGE ===================
function OnboardingPage({ user, onLogin, onContinue }) {
  return (
    <div className="hero" style={{
      marginTop:64,
      background: pastelGradients[1],
      borderRadius: 20,
      padding:"48px 8px 36px 8px",
      boxShadow:"0 6px 32px 0 rgba(80,53,222,0.10)"
    }}>
      <div
        style={{
          fontSize:52,
          marginBottom:8,
        }}
      >{logoEmoji}</div>
      <div className="title" style={{
        color:PRIMARY_COLOR,
        fontSize:"2.3rem",marginBottom:8,
        fontWeight:700,
        letterSpacing:"-2px",
      }}>
        Welcome to HabitSpark!
      </div>
      <div className="description" style={{
        color:"#2d3748",
        marginBottom: 18
      }}>
        <b>Your spark for healthy routines!</b> <br/>
        Build and reinforce habits, track your streaks,<br />
        and get gentle reminders, all in a soothing, motivating UI.
      </div>
      <button className="btn btn-large"
        style={{
          background:PRIMARY_COLOR,
          width:"70%",
          margin:"0 auto",
          marginBottom:14
        }}
        onClick={onContinue}
      >Get Started</button>
      <button
        className="btn"
        style={{
          background: "white",
          color: PRIMARY_COLOR,
          border: `1.5px solid ${PRIMARY_COLOR}`,
          margin:"0 auto",
        }}
        onClick={()=>onLogin("google")}
      >
        <span style={{fontSize:19,marginRight:7}}>🔒</span>
        Login with Google
      </button>
      <div style={{fontSize:"0.93rem", color:"#a7adc0",
        marginTop:16}}>No downloads, free for personal use.</div>
    </div>
  );
}

// ... [Rest of components: HomePage, HabitCard, HabitFrequency, HabitFormModal, StreakPage]
// ... [They are unchanged from the version provided above, omitted here for brevity.]
// ... [If needed, please request the full file including the repeated components.]

/* Modernized Settings Page with close/back, animated toggles, and updated layout */
function SettingsPage({ settings, setSettings, onLogout, onDataReset, accentColor }) {
  // PUBLIC_INTERFACE
  /**
   * This SettingsPage component displays app settings in a modern, card-styled modal.
   * Features a prominent close/back button, animated toggle switches for dark mode & reminders,
   * logout & reset actions, consistent gradient minimal layout, and updates parent state reactively.
   */
  return (
    <div
      className="settings-modal-bg"
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        top: 0, left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(18,19,34,0.12)",
        zIndex: 2333,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "background 0.16s",
      }}
      onClick={e => {
        if (e.target.className && String(e.target.className).includes("settings-modal-bg")) {
          // Close when clicking on modal background
          if (typeof window !== "undefined")
            window.dispatchEvent(new CustomEvent("close-settings"));
        }
      }}
    >
      <div
        className="settings-card"
        style={{
          background: "linear-gradient(129deg, #fcfcff 75%, #e0eafc 112%)",
          color: "#22284d",
          minWidth: 325,
          maxWidth: 370,
          borderRadius: 22,
          boxShadow: "0 8px 32px 0 rgba(131,105,255,0.13)",
          padding: "32px 25px 22px 25px",
          position: "relative",
        }}
      >
        {/* Close/back button */}
        <button
          className="settings-close-btn"
          style={{
            position: "absolute",
            left: 16,
            top: 15,
            background: "none",
            border: "none",
            color: accentColor,
            fontWeight: 700,
            fontSize: 23,
            borderRadius: "50%",
            width: 34,
            height: 34,
            cursor: "pointer",
            transition: "background 0.1s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          aria-label="Close settings"
          tabIndex={0}
          onClick={() => {
            if (typeof window !== "undefined")
              window.dispatchEvent(new CustomEvent("close-settings"));
          }}
        >
          <span role="img" aria-label="Back" style={{ fontSize: 21 }}>&#8592;</span>
        </button>
        {/* Logout and Reset */}
        <button
          className="btn"
          onClick={onLogout}
          style={{
            position: "absolute",
            left: 58,
            top: 14,
            background: "none",
            color: "#F56565",
            fontWeight: 700,
            fontSize: 14,
            border: "none",
            outline: "none",
            transition: "color 0.15s",
          }}
        ><span role="img" aria-label="logout">🚪</span> Logout</button>
        <button
          className="btn"
          onClick={onDataReset}
          style={{
            position: "absolute",
            right: 18,
            top: 14,
            background: "none",
            color: "#767ee7",
            fontWeight: 700,
            fontSize: 14,
            border: "none",
            outline: "none",
            transition: "color 0.15s",
          }}
        ><span role="img" aria-label="reset">🗑️</span> Reset</button>
        <div className="title" style={{
          color: accentColor,
          fontWeight: 700,
          fontSize: "1.21rem",
          marginBottom: 4,
          marginTop: 7,
          textAlign: "center",
          letterSpacing: "-0.5px",
          userSelect: "none",
        }}>
          <span role="img" aria-label="cog" style={{marginRight: 7}}>⚙️</span>
          Settings
        </div>
        <div style={{ marginBottom: 18, marginTop: 22 }}>
          <label
            style={{
              fontWeight: 500,
              fontSize: "1.08rem",
              display: "flex",
              alignItems: "center",
              gap: 13,
            }}
            htmlFor="darkmode-toggle"
          >
            <span role="img" aria-label="moon" style={{fontSize:"1.18rem"}}>🌙</span>
            Dark Mode
            <ToggleSwitch
              id="darkmode-toggle"
              checked={settings.dark}
              onChange={() => setSettings(s => ({ ...s, dark: !s.dark }))}
              ariaLabel="Toggle dark mode"
              accent={accentColor}
            />
          </label>
        </div>
        <div style={{ marginBottom: 8 }}>
          <label
            style={{
              fontWeight: 500,
              fontSize: "1.08rem",
              display: "flex",
              alignItems: "center",
              gap: 13,
            }}
            htmlFor="notif-toggle"
          >
            <span role="img" aria-label="bell" style={{fontSize:"1.14rem"}}>🔔</span>
            Reminders
            <ToggleSwitch
              id="notif-toggle"
              checked={settings.notifications}
              onChange={() => setSettings(s => ({ ...s, notifications: !s.notifications }))}
              ariaLabel="Toggle reminders & notifications"
              accent="#82e6d9"
            />
          </label>
        </div>
        <div style={{
          fontSize: "0.95rem",
          color: "#a7adc0",
          marginTop: 36,
          textAlign: "center",
          userSelect: "none",
        }}>
          <span role="img" aria-label="lock">🔒</span> No data is synced/shared.<br />All habits stored on your device.
        </div>
      </div>
    </div>
  );
}

/* Animated ToggleSwitch Component */
function ToggleSwitch({ checked, onChange, id, ariaLabel, accent }) {
  // PUBLIC_INTERFACE
  /** Accessible toggle switch, modern/stylish, animated, rounded, with color transitions */
  return (
    <button
      className={`habitglow-toggle-switch${checked ? " checked" : ""}`}
      onClick={() => onChange(!checked)}
      aria-pressed={!!checked}
      aria-label={ariaLabel}
      id={id}
      tabIndex={0}
      style={{ '--habitglow-toggle-accent': accent || "#7B61FF" }}
    >
      <span className="habitglow-switch-track"></span>
      <span className="habitglow-switch-thumb"></span>
    </button>
  );
}

/* Minimal ToastContainer implementation */
function ToastContainer({ toast }) {
  // PUBLIC_INTERFACE
  /**
   * Inline ToastContainer: Displays animated toast-like notification based on the toast object.
   * Supports: {type: "success"|"info"|"reminder", msg: string}
   */
  if (!toast || !toast.msg) return null;
  let color = "#7B61FF";
  if (toast.type === "success") color = "#6EE7B7";
  if (toast.type === "info") color = "#A5B4FC";
  if (toast.type === "reminder") color = "#FFD166";
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        minWidth: 220,
        maxWidth: 400,
        background: "white",
        color: "#22284d",
        borderRadius: 16,
        boxShadow: "0 6px 22px 0 rgba(80,53,222,0.12)",
        padding: "14px 28px",
        fontWeight: 600,
        fontSize: "1.03rem",
        border: `2.5px solid ${color}`,
        zIndex: 2333,
        opacity: 0.98,
        display: "flex",
        alignItems: "center",
        gap: 12,
        pointerEvents: "none",
        animation: "habitglow-toast-fadein 0.24s cubic-bezier(.39,1.08,.47,.97)"
      }}>
      <span role="img" aria-label="notify" style={{fontSize:20}}>
        {toast.type === "success" ? "✅"
          : toast.type === "info" ? "ℹ️"
            : "🔔"}
      </span>
      <span>{toast.msg}</span>
      <style>{`
        @keyframes habitglow-toast-fadein {
          from { opacity: 0; transform: translateY(30px) scale(0.98) translateX(-50%);}
          to { opacity: 0.98; transform: translateY(0px) scale(1) translateX(-50%);}
        }
      `}</style>
    </div>
  );
}

// ... ToastContainer, FloatingAddButton, EmptyStatePage as before ...

export default App;
