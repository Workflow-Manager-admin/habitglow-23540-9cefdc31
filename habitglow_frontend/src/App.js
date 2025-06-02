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
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// =================== Global Context ===================
const emptyUser = { isAuthenticated: false, name: "", email: "", onboardingDone: false };
const emptySettings = { dark: false, notifications: false };
const emptyHabitList = [];

/* Enhanced ToastContainer with better animations */
function ToastContainer({ toast }) {
  if (!toast || !toast.msg) return null;
  
  const colors = {
    success: "#6EE7B7",
    info: "#A5B4FC",
    reminder: "#FFD166",
    error: "#F56565"
  };
  
  const color = colors[toast.type] || "#7B61FF";
  const icons = {
    success: "✅",
    info: "ℹ️",
    reminder: "🔔",
    error: "⚠️"
  };
  
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
        maxWidth: "90%",
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
        animation: "toast-fadein 0.24s cubic-bezier(.39,1.08,.47,.97)"
      }}>
      <span role="img" aria-label="notify" style={{fontSize:20}}>
        {icons[toast.type] || "🔔"}
      </span>
      <span>{toast.msg}</span>
      <style>{`
        @keyframes toast-fadein {
          from { opacity: 0; transform: translateY(30px) scale(0.98) translateX(-50%); }
          to { opacity: 0.98; transform: translateY(0px) scale(1) translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

// =================== Main App ===================
function App() {
  const [user, setUser] = useState(() => getStorage(LOCAL_STORAGE_KEYS.USER, emptyUser));
  const [habits, setHabits] = useState(() => getStorage(LOCAL_STORAGE_KEYS.HABITS, emptyHabitList));
  const [settings, setSettings] = useState(() => getStorage(LOCAL_STORAGE_KEYS.SETTINGS, emptySettings));
  const [route, setRoute] = useState(() => user.onboardingDone ? "home" : "onboarding");
  const [toast, setToast] = useState(null);
  const [showHabitForm, setShowHabitForm] = useState(false);
  const [editHabitId, setEditHabitId] = useState(null);
  const [showStreak, setShowStreak] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // State Persistence
  useEffect(() => setStorage(LOCAL_STORAGE_KEYS.USER, user), [user]);
  useEffect(() => setStorage(LOCAL_STORAGE_KEYS.HABITS, habits), [habits]);
  useEffect(() => setStorage(LOCAL_STORAGE_KEYS.SETTINGS, settings), [settings]);

  // Theme Sync
  useEffect(() => {
    document.body.style.background = settings.dark
      ? "linear-gradient(120deg,#181926 0%,#2d3748 100%)"
      : pastelGradients[0];
    document.body.style.color = settings.dark ? "#fff" : "#23272f";
  }, [settings.dark]);

  // Habit Completion Logic
  const completeHabit = useCallback((habitId) => {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        if (h.history && h.history.find(dateIsToday)) return h;
        
        const sortedHistory = [...h.history, todayStr()].sort();
        let newStreak = 1;
        let best = h.bestStreak || 1;
        let consecutive = 1;
        
        for (let i = sortedHistory.length - 2; i >= 0; i--) {
          if (isConsecutive(sortedHistory[i], sortedHistory[i+1])) {
            consecutive++;
            best = Math.max(best, consecutive);
          } else {
            consecutive = 1;
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
    setToast({ type: "info", msg: "Completion undone." });
  }, []);

  const updateHabit = (habitObj) => {
    if (!habitObj.id) return;
    setHabits((prev) =>
      prev.map((h) => (h.id === habitObj.id ? { ...h, ...habitObj } : h))
    );
    setToast({ type: "success", msg: "Habit updated." });
  };

  const addHabit = (habitObj) => {
    setHabits((prev) => [...prev, { 
      ...habitObj,
      id: Date.now().toString(),
      created: todayStr(),
      streak: 0,
      bestStreak: 0,
      history: [],
      color: habitObj.color || PRIMARY_COLOR
    }]);
    setToast({ type: "success", msg: "Habit added!" });
  };

  const deleteHabit = (id) => {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    setToast({ type: "info", msg: "Habit deleted." });
  };

  // Navigation Helpers
  const goto = useCallback((to) => {
    setRoute(to);
    setShowHabitForm(false);
    setShowStreak(false);
    setShowSettings(false);
    setEditHabitId(null);
  }, []);

  const openHabitForm = (habitId = null) => {
    setEditHabitId(habitId);
    setShowHabitForm(true);
  };

  // Toast Management
  useEffect(() => {
    if (toast) {
      const timeout = setTimeout(() => setToast(null), 2500);
      return () => clearTimeout(timeout);
    }
  }, [toast]);

  // Reminders Simulation
  useEffect(() => {
    if (!settings.notifications) return;
    
    const now = new Date();
    const checkReminders = () => {
      habits.forEach((h) => {
        if (h.reminders?.enabled && !h.history.find(dateIsToday)) {
          const [hrStr, minStr] = (h.reminders.time || "09:00").split(":");
          const nowMinutes = now.getHours() * 60 + now.getMinutes();
          const habitMinutes = parseInt(hrStr, 10) * 60 + parseInt(minStr, 10);
          
          if (nowMinutes >= habitMinutes && nowMinutes < habitMinutes + 5) {
            setToast({
              type: "reminder",
              msg: `Don't forget: ${h.emoji || "🌟"} ${h.name}`
            });
          }
        }
      });
    };
    
    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, [habits, settings.notifications]);

  // Derived Values
  const todayHabits = useMemo(() => {
    const wd = WEEKDAYS[new Date().getDay()];
    return habits.filter((h) => 
      Array.isArray(h.frequency) ? h.frequency.includes(wd) : true
    );
  }, [habits]);

  const allDoneToday = useMemo(() =>
    todayHabits.length > 0 && todayHabits.every((h) => h.history.find(dateIsToday)), 
    [todayHabits]
  );

  // Authentication Mocks
  const handleMockAuth = (provider) => {
    setUser({
      isAuthenticated: true,
      name: "Demo User",
      email: "demo@example.com",
      onboardingDone: true,
    });
    setRoute("home");
  };

  // Close Settings Handler
  useEffect(() => {
    function closeSettingsHandler() {
      setShowSettings(false);
    }
    window.addEventListener("close-settings", closeSettingsHandler);
    return () => window.removeEventListener("close-settings", closeSettingsHandler);
  }, []);

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
            habits.length === 0 ? (
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

          {/* Floating Add Button */}
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
              existingHabit={editHabitId ? habits.find((h) => h.id === editHabitId) : null}
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
                setToast({ type: "info", msg: "All data reset." });
              }}
              accentColor={PRIMARY_COLOR}
            />
          )}

          {/* Toast Notifications */}
          <ToastContainer toast={toast} />
        </div>
      </main>
    </div>
  );
}

// =================== Enhanced Components ===================

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
      transition: "all 0.2s ease",
    }}>
      <div className="container" style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        maxWidth: 520,
        margin: "0 auto",
        padding: "12px 16px"
      }}>
        <div className="logo" style={{ display: "flex", alignItems: "center" }}>
          <span className="logo-symbol" style={{
            fontSize: "1.7rem",
            color: accent,
            transition: "transform 0.3s ease"
          }} onMouseEnter={e => e.currentTarget.style.transform = "rotate(15deg)"}
             onMouseLeave={e => e.currentTarget.style.transform = "rotate(0)"}>
            {logoEmoji}
          </span>
          <span className="logo-text" style={{
            fontWeight: 700,
            marginLeft: 6,
            color: accent,
            fontSize: "1.2rem",
            letterSpacing: "-0.5px"
          }}>HabitSpark</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {user.onboardingDone && (
            <>
              <button
                className="btn"
                style={{
                  background: "none",
                  color: accent,
                  padding: "8px",
                  borderRadius: "50%",
                  transition: "all 0.2s ease",
                  transform: showStreak ? "scale(1.1)" : "scale(1)"
                }}
                onClick={() => setShowStreak(s => !s)}
                aria-label="View Streak/Progress"
              >
                <span role="img" aria-label="flame" style={{ fontSize: 20 }}>🔥</span>
              </button>
              <button
                className="btn"
                onClick={() => setShowSettings(s => !s)}
                aria-label="Settings"
                style={{
                  background: "none",
                  color: accent,
                  padding: "8px",
                  borderRadius: "50%",
                  transition: "all 0.2s ease",
                  transform: showSettings ? "scale(1.1)" : "scale(1)"
                }}
              >
                <span role="img" aria-label="cog" style={{ fontSize: 20 }}>⚙️</span>
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function OnboardingPage({ user, onLogin, onContinue }) {
  return (
    <div className="hero" style={{
      marginTop: 64,
      background: pastelGradients[1],
      borderRadius: 20,
      padding: "48px 24px 36px",
      boxShadow: "0 6px 32px 0 rgba(80,53,222,0.10)",
      textAlign: "center",
      animation: "fadeIn 0.5s ease",
      maxWidth: "90%",
      marginLeft: "auto",
      marginRight: "auto"
    }}>
      <div style={{
        fontSize: 64,
        marginBottom: 8,
        animation: "bounce 2s infinite"
      }}>{logoEmoji}</div>
      <div className="title" style={{
        color: PRIMARY_COLOR,
        fontSize: "2rem",
        marginBottom: 12,
        fontWeight: 700,
        letterSpacing: "-1px",
      }}>
        Welcome to HabitSpark!
      </div>
      <div className="description" style={{
        color: "#2d3748",
        marginBottom: 24,
        lineHeight: 1.5,
        fontSize: "1.05rem"
      }}>
        <b>Your spark for healthy routines!</b> <br />
        Build habits, track streaks, and get reminders in a beautiful interface.
      </div>
      <button
        className="btn btn-large"
        style={{
          background: PRIMARY_COLOR,
          width: "80%",
          maxWidth: 280,
          margin: "0 auto 14px",
          padding: "14px 24px",
          fontSize: "1.1rem",
          fontWeight: 600,
          borderRadius: 12,
          boxShadow: "0 4px 14px rgba(123, 97, 255, 0.3)",
          transition: "all 0.2s ease"
        }}
        onClick={onContinue}
        onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
        onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
      >
        Get Started
      </button>
      <button
        className="btn"
        style={{
          background: "white",
          color: PRIMARY_COLOR,
          border: `1.5px solid ${PRIMARY_COLOR}`,
          margin: "0 auto",
          padding: "10px 20px",
          borderRadius: 12,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          transition: "all 0.2s ease"
        }}
        onClick={() => onLogin("google")}
      >
        <span style={{ fontSize: 19 }}>🔒</span>
        Login with Google
      </button>
      <div style={{
        fontSize: "0.93rem",
        color: "#a7adc0",
        marginTop: 24
      }}>No downloads, free for personal use.</div>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
}

function EmptyStatePage({ onAdd }) {
  return (
    <div style={{
      padding: "48px 0",
      textAlign: "center",
      animation: "fadeIn 0.6s ease"
    }}>
      <div style={{
        fontSize: 64,
        marginBottom: 16,
        animation: "pulse 2s infinite"
      }}>🌱</div>
      <div style={{
        fontWeight: 600,
        fontSize: "1.5rem",
        marginBottom: 8,
        color: PRIMARY_COLOR
      }}>No habits yet...</div>
      <div style={{
        color: "#a7adc0",
        marginBottom: 24,
        fontSize: "1.05rem"
      }}>Start your first healthy habit today!</div>
      <button
        className="btn btn-large"
        onClick={onAdd}
        style={{
          background: PRIMARY_COLOR,
          color: "white",
          padding: "14px 28px",
          borderRadius: 12,
          fontSize: "1.1rem",
          fontWeight: 600,
          boxShadow: "0 4px 14px rgba(123, 97, 255, 0.3)",
          transition: "all 0.2s ease"
        }}
        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
      >
        Add Your First Habit
      </button>
      
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}

function HomePage({ habits, allDoneToday, onCheck, onUndo, onEdit, onDelete, openStreak, today }) {
  return (
    <div style={{ padding: "0 16px", animation: "fadeIn 0.5s ease" }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24
      }}>
        <h2 style={{
          fontWeight: 600,
          fontSize: "1.3rem",
          color: PRIMARY_COLOR,
          margin: 0
        }}>Today's Habits</h2>
        <div style={{
          fontSize: "0.9rem",
          color: "#a7adc0"
        }}>{today}</div>
      </div>
      
      {habits.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "40px 0",
          color: "#a7adc0"
        }}>
          No habits scheduled for today
        </div>
      ) : (
        <ul style={{
          listStyle: "none",
          padding: 0,
          display: "grid",
          gap: 12
        }}>
          {habits.map((h) => (
            <HabitCard
              key={h.id}
              habit={h}
              onCheck={onCheck}
              onUndo={onUndo}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
      
      {allDoneToday && (
        <div style={{
          color: SECONDARY_COLOR,
          marginTop: 24,
          textAlign: "center",
          fontSize: "1.1rem",
          fontWeight: 600,
          padding: "16px",
          background: "rgba(110, 231, 183, 0.1)",
          borderRadius: 12,
          animation: "fadeIn 0.5s ease"
        }}>
          🎉 All done for today! Great job!
        </div>
      )}
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function HabitCard({ habit, onCheck, onUndo, onEdit, onDelete }) {
  const [isChecked, setIsChecked] = useState(habit.history.find(dateIsToday));
  const [isExpanded, setIsExpanded] = useState(false);
  
  const handleCheck = () => {
    setIsChecked(true);
    onCheck(habit.id);
  };
  
  const handleUndo = () => {
    setIsChecked(false);
    onUndo(habit.id);
  };
  
  return (
    <li style={{
      background: "rgba(255,255,255,0.7)",
      borderRadius: 12,
      padding: "16px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
      transition: "all 0.2s ease",
      borderLeft: `4px solid ${habit.color || PRIMARY_COLOR}`
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12
      }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flex: 1
        }}>
          <span role="img" aria-label={habit.name} style={{ fontSize: 24 }}>
            {habit.emoji || "🌟"}
          </span>
          <div>
            <div style={{ fontWeight: 600 }}>{habit.name}</div>
            <div style={{
              fontSize: "0.85rem",
              color: "#a7adc0",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}>
              <span>🔥 {habit.streak || 0}</span>
              <span>•</span>
              <span>🏆 {habit.bestStreak || 0}</span>
            </div>
          </div>
        </div>
        
        {isChecked ? (
          <button
            onClick={handleUndo}
            style={{
              background: "rgba(165, 180, 252, 0.2)",
              color: ACCENT_COLOR,
              border: "none",
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(165, 180, 252, 0.3)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(165, 180, 252, 0.2)"}
          >
            Done
          </button>
        ) : (
          <button
            onClick={handleCheck}
            style={{
              background: ACCENT_COLOR,
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "8px 12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            Check
          </button>
        )}
      </div>
      
      <div style={{ marginTop: 12, display: isExpanded ? "block" : "none" }}>
        <div style={{
          display: "flex",
          gap: 8,
          marginTop: 8
        }}>
          <button
            onClick={() => onEdit(habit.id)}
            style={{
              background: "rgba(123, 97, 255, 0.1)",
              color: PRIMARY_COLOR,
              border: "none",
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: "0.85rem",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(habit.id)}
            style={{
              background: "rgba(245, 101, 101, 0.1)",
              color: "#F56565",
              border: "none",
              borderRadius: 6,
              padding: "6px 12px",
              fontSize: "0.85rem",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
          >
            Delete
          </button>
        </div>
      </div>
      
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          background: "none",
          border: "none",
          color: "#a7adc0",
          fontSize: "0.8rem",
          display: "flex",
          alignItems: "center",
          marginTop: 8,
          cursor: "pointer",
          padding: 0
        }}
      >
        {isExpanded ? "Show less" : "Show more"}
        <span style={{ marginLeft: 4, fontSize: "1.2rem" }}>
          {isExpanded ? "↑" : "↓"}
        </span>
      </button>
    </li>
  );
}

function FloatingAddButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        position: "fixed",
        bottom: 34,
        right: 24,
        background: PRIMARY_COLOR,
        color: "white",
        fontSize: "2rem",
        borderRadius: "50%",
        width: 64,
        height: 64,
        zIndex: 1002,
        boxShadow: "0 4px 20px rgba(123, 97, 255, 0.4)",
        border: "none",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s ease"
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "scale(1.1) rotate(90deg)";
        e.currentTarget.style.boxShadow = "0 6px 24px rgba(123, 97, 255, 0.6)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "scale(1) rotate(0)";
        e.currentTarget.style.boxShadow = "0 4px 20px rgba(123, 97, 255, 0.4)";
      }}
      aria-label="Add Habit"
    >
      ＋
    </button>
  );
}

function HabitFormModal({ onClose, onSave, existingHabit, allHabits, accentColor }) {
  const [name, setName] = useState(existingHabit?.name || "");
  const [emoji, setEmoji] = useState(existingHabit?.emoji || "🌟");
  const [frequency, setFrequency] = useState(existingHabit?.frequency || WEEKDAYS.slice(1));
  const [reminders, setReminders] = useState(existingHabit?.reminders || { enabled: false, time: "09:00" });
  const [color, setColor] = useState(existingHabit?.color || PRIMARY_COLOR);
  
  const colors = [PRIMARY_COLOR, SECONDARY_COLOR, ACCENT_COLOR, "#FFD166", "#F56565", "#9F7AEA"];
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      return;
    }
    
    const habit = {
      id: existingHabit?.id || Date.now().toString(),
      name,
      emoji,
      frequency,
      reminders,
      color,
      history: existingHabit?.history || [],
      streak: existingHabit?.streak || 0,
      bestStreak: existingHabit?.bestStreak || 0,
      created: existingHabit?.created || todayStr()
    };
    
    onSave(habit);
  };
  
  const toggleDay = (day) => {
    if (frequency.includes(day)) {
      setFrequency(frequency.filter(d => d !== day));
    } else {
      setFrequency([...frequency, day]);
    }
  };
  
  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        background: "rgba(0,0,0,0.5)",
        zIndex: 2222,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        animation: "fadeIn 0.3s ease"
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#fff",
          color: "#2d3748",
          borderRadius: 16,
          boxShadow: "0 6px 32px 0 rgba(80,53,222,0.13)",
          padding: "24px",
          width: "90%",
          maxWidth: 400,
          maxHeight: "90vh",
          overflowY: "auto"
        }}
      >
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16
        }}>
          <h3 style={{
            fontWeight: 700,
            fontSize: "1.2rem",
            color: accentColor,
            margin: 0
          }}>
            {existingHabit ? "Edit Habit" : "Add New Habit"}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              color: "#a7adc0",
              cursor: "pointer"
            }}
          >
            ×
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block",
              marginBottom: 8,
              fontWeight: 500
            }}>
              Habit Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Drink water"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: "1rem"
              }}
              required
            />
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block",
              marginBottom: 8,
              fontWeight: 500
            }}>
              Emoji
            </label>
            <input
              type="text"
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
                            maxLength="2"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 8,
                border: "1px solid #e2e8f0",
                fontSize: "1rem"
              }}
            />
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "block",
              marginBottom: 8,
              fontWeight: 500
            }}>
              Frequency
            </label>
            <div style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8
            }}>
              {WEEKDAYS.map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  style={{
                    background: frequency.includes(day) ? accentColor : "rgba(226, 232, 240, 0.5)",
                    color: frequency.includes(day) ? "white" : "#4a5568",
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 10px",
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  {day}
                </button>
              ))}
            </div>
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
              fontWeight: 500
            }}>
              <input
                type="checkbox"
                checked={reminders.enabled}
                onChange={(e) => setReminders({...reminders, enabled: e.target.checked})}
              />
              Daily Reminder
            </label>
            {reminders.enabled && (
              <input
                type="time"
                value={reminders.time}
                onChange={(e) => setReminders({...reminders, time: e.target.value})}
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0"
                }}
              />
            )}
          </div>
          
          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: "block",
              marginBottom: 8,
              fontWeight: 500
            }}>
              Color
            </label>
            <div style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap"
            }}>
              {colors.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: c,
                    border: color === c ? "2px solid white" : "2px solid transparent",
                    boxShadow: color === c ? `0 0 0 2px ${c}` : "none",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
          
          <button
            type="submit"
            style={{
              background: accentColor,
              color: "white",
              border: "none",
              borderRadius: 8,
              padding: "12px 24px",
              width: "100%",
              fontWeight: 600,
              fontSize: "1rem",
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
          >
            {existingHabit ? "Update Habit" : "Add Habit"}
          </button>
        </form>
      </div>
    </div>
  );
}

function StreakPage({ habits, onClose, accentColor }) {
  const [selectedHabit, setSelectedHabit] = useState(null);
  
  const habitsWithStreaks = useMemo(() => 
    habits
      .filter(h => h.streak > 0)
      .sort((a, b) => b.streak - a.streak)
  , [habits]);
  
  const renderCalendar = (habit) => {
    if (!habit) return null;
    
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const startDay = monthStart.getDay();
    
    const dates = habit.history.map(d => d.split('T')[0]);
    
    const days = [];
    for (let i = 0; i < startDay; i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({
        date: i,
        completed: dates.includes(dateStr)
      });
    }
    
    return (
      <div style={{ marginTop: 16 }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 8,
          textAlign: "center"
        }}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
            <div key={day} style={{
              fontSize: "0.8rem",
              color: "#a7adc0"
            }}>{day}</div>
          ))}
          
          {days.map((day, i) => (
            <div key={i} style={{
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 4,
              background: day?.completed ? accentColor : "transparent",
              opacity: day?.completed ? 1 : 0.3
            }}>
              {day?.date}
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "rgba(255,255,255,0.96)",
      zIndex: 2000,
      padding: "24px",
      overflowY: "auto",
      animation: "slideIn 0.3s ease"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24
      }}>
        <h2 style={{
          fontWeight: 700,
          fontSize: "1.5rem",
          color: accentColor,
          margin: 0
        }}>Your Streaks</h2>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            fontSize: "1.5rem",
            color: "#a7adc0",
            cursor: "pointer"
          }}
        >
          ×
        </button>
      </div>
      
      {habitsWithStreaks.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "40px 0",
          color: "#a7adc0"
        }}>
          No active streaks yet - keep going!
        </div>
      ) : (
        <div style={{
          display: "grid",
          gap: 16
        }}>
          {habitsWithStreaks.map(habit => (
            <div 
              key={habit.id}
              onClick={() => setSelectedHabit(habit.id === selectedHabit ? null : habit.id)}
              style={{
                background: "white",
                borderRadius: 12,
                padding: "16px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                cursor: "pointer",
                transition: "all 0.2s ease",
                borderLeft: `4px solid ${habit.color || accentColor}`
              }}
            >
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span role="img" aria-label={habit.name} style={{ fontSize: 24 }}>
                    {habit.emoji || "🌟"}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{habit.name}</div>
                    <div style={{
                      fontSize: "0.85rem",
                      color: "#a7adc0",
                      display: "flex",
                      alignItems: "center",
                      gap: 4
                    }}>
                      <span>🔥 {habit.streak} day streak</span>
                      <span>•</span>
                      <span>🏆 Best: {habit.bestStreak}</span>
                    </div>
                  </div>
                </div>
                <span style={{
                  fontSize: "1.2rem",
                  transition: "transform 0.2s ease",
                  transform: selectedHabit === habit.id ? "rotate(180deg)" : "rotate(0)"
                }}>
                  ▼
                </span>
              </div>
              
              {selectedHabit === habit.id && (
                <div style={{ marginTop: 16 }}>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8
                  }}>
                    <span style={{ color: "#a7adc0" }}>Started</span>
                    <span>{habit.created}</span>
                  </div>
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8
                  }}>
                    <span style={{ color: "#a7adc0" }}>Completed</span>
                    <span>{habit.history.length} days</span>
                  </div>
                  
                  <h3 style={{
                    fontWeight: 600,
                    fontSize: "1rem",
                    margin: "16px 0 8px",
                    color: accentColor
                  }}>
                    This Month
                  </h3>
                  {renderCalendar(habit)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      
      <style>{`
        @keyframes slideIn {
          from { transform: translateY(20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function SettingsPage({ settings, setSettings, onLogout, onDataReset, accentColor }) {
  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "rgba(255,255,255,0.96)",
      zIndex: 2000,
      padding: "24px",
      overflowY: "auto",
      animation: "slideIn 0.3s ease"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24
      }}>
        <h2 style={{
          fontWeight: 700,
          fontSize: "1.5rem",
          color: accentColor,
          margin: 0
        }}>Settings</h2>
        <button
          onClick={() => window.dispatchEvent(new Event('close-settings'))}
          style={{
            background: "none",
            border: "none",
            fontSize: "1.5rem",
            color: "#a7adc0",
            cursor: "pointer"
          }}
        >
          ×
        </button>
      </div>
      
      <div style={{
        display: "grid",
        gap: 24
      }}>
        <div>
          <h3 style={{
            fontWeight: 600,
            fontSize: "1.1rem",
            marginBottom: 16,
            color: accentColor
          }}>Appearance</h3>
          
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12
          }}>
            <span>Dark Mode</span>
            <label style={{
              position: "relative",
              display: "inline-block",
              width: 50,
              height: 24
            }}>
              <input
                type="checkbox"
                checked={settings.dark}
                onChange={() => setSettings({...settings, dark: !settings.dark})}
                style={{
                  opacity: 0,
                  width: 0,
                  height: 0
                }}
              />
              <span style={{
                position: "absolute",
                cursor: "pointer",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: settings.dark ? accentColor : "#e2e8f0",
                transition: "all 0.3s",
                borderRadius: 24
              }}>
                <span style={{
                  position: "absolute",
                  height: 18,
                  width: 18,
                  left: settings.dark ? "calc(100% - 20px)" : "3px",
                  bottom: 3,
                  backgroundColor: "white",
                  transition: "all 0.3s",
                  borderRadius: "50%"
                }} />
              </span>
            </label>
          </div>
        </div>
        
        <div>
          <h3 style={{
            fontWeight: 600,
            fontSize: "1.1rem",
            marginBottom: 16,
            color: accentColor
          }}>Notifications</h3>
          
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12
          }}>
            <span>Enable Reminders</span>
            <label style={{
              position: "relative",
              display: "inline-block",
              width: 50,
              height: 24
            }}>
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={() => setSettings({...settings, notifications: !settings.notifications})}
                style={{
                  opacity: 0,
                  width: 0,
                  height: 0
                }}
              />
              <span style={{
                position: "absolute",
                cursor: "pointer",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: settings.notifications ? accentColor : "#e2e8f0",
                transition: "all 0.3s",
                borderRadius: 24
              }}>
                <span style={{
                  position: "absolute",
                  height: 18,
                  width: 18,
                  left: settings.notifications ? "calc(100% - 20px)" : "3px",
                  bottom: 3,
                  backgroundColor: "white",
                  transition: "all 0.3s",
                  borderRadius: "50%"
                }} />
              </span>
            </label>
          </div>
        </div>
        
        <div>
          <h3 style={{
            fontWeight: 600,
            fontSize: "1.1rem",
            marginBottom: 16,
            color: accentColor
          }}>Account</h3>
          
          <button
            onClick={onLogout}
            style={{
              background: "none",
              border: `1px solid ${accentColor}`,
              color: accentColor,
              borderRadius: 8,
              padding: "10px 16px",
              width: "100%",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease",
              marginBottom: 12
            }}
            onMouseEnter={e => {
              e.currentTarget.background = accentColor;
              e.currentTarget.color = "white";
            }}
            onMouseLeave={e => {
              e.currentTarget.background = "none";
              e.currentTarget.color = accentColor;
            }}
          >
            Log Out
          </button>
        </div>
        
        <div>
          <h3 style={{
            fontWeight: 600,
            fontSize: "1.1rem",
            marginBottom: 16,
            color: accentColor
          }}>Danger Zone</h3>
          
          <button
            onClick={onDataReset}
            style={{
              background: "none",
              border: "1px solid #F56565",
              color: "#F56565",
              borderRadius: 8,
              padding: "10px 16px",
              width: "100%",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s ease"
            }}
            onMouseEnter={e => {
              e.currentTarget.background = "rgba(245, 101, 101, 0.1)";
            }}
            onMouseLeave={e => {
              e.currentTarget.background = "none";
            }}
          >
            Reset All Data
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;