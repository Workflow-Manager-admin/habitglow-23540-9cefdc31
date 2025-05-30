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

// =================== HOME / HABIT LIST ===================
function HomePage({
  habits,
  allDoneToday,
  onCheck,
  onUndo,
  onEdit,
  onDelete,
  openStreak,
  today,
}) {
  // Confetti Animation if allDoneToday
  useEffect(() => {
    if (!allDoneToday) return;
    // Simple confetti animation with emoji effect
    const burst = document.createElement("div");
    burst.style.position = "fixed";
    burst.style.top = "40%";
    burst.style.left = "50%";
    burst.style.transform = "translate(-50%, -50%)";
    burst.style.fontSize = "2.2rem";
    burst.style.zIndex = 3333;
    burst.textContent = "🎉🎉🎉";
    document.body.appendChild(burst);
    setTimeout(function() {
      document.body.removeChild(burst);
    }, 1300);
  }, [allDoneToday]);

// Removed duplicate HomePage or stray confetti logic below (if any).
// (No-op if none present.)

  return (
    <div>
      <div style={{marginBottom:22, marginTop:24,textAlign:"center"}}>
        <span className="subtitle" style={{fontWeight:600,fontSize:19,color:ACCENT_COLOR}}>
          Today's Habits
        </span>
      </div>
      <div>
        {habits.length === 0 && (
          <div style={{textAlign:"center", margin:"28px 0", opacity:0.6}}>No habits today.</div>
        )}
        {habits.map((h) => (
          <HabitCard
            key={h.id}
            habit={h}
            onCheck={onCheck}
            onUndo={onUndo}
            onEdit={onEdit}
            onDelete={onDelete}
            today={today}
          />
        ))}
      </div>
      {allDoneToday && (
        <div style={{
          textAlign:"center",
          marginTop:28,
          fontWeight:500,
          color:PRIMARY_COLOR,
          fontSize:"1.08rem"
        }}>
          🥳 All done! Keep the streak glowing!
        </div>
      )}
    </div>
  );
}

// =================== HABIT CARD ===================
function HabitCard({ habit, onCheck, onUndo, onEdit, onDelete, today }) {
  const doneToday = habit.history.find(dateIsToday);
  const glow = doneToday
    ? {
        boxShadow: `0 0 15px 2px ${PRIMARY_COLOR}, 0 0 34px 8px #a5b4fc33`,
        border: `2px solid ${PRIMARY_COLOR}`,
        background: "white",
        color: PRIMARY_COLOR,
      }
    : {};
  return (
    <div
      style={{
        borderRadius: 18,
        background: "rgba(255,255,255,0.96)",
        marginBottom: 17,
        padding: "18px 14px 15px 18px",
        boxShadow:
          doneToday
            ? "0 2px 13px 0 #a5b4fc22"
            : "0 1px 2px 0 rgba(131,105,255,0.05)",
        display: "flex",
        alignItems: "center",
        gap: 13,
        ...glow,
        position: "relative",
      }}
    >
      <span style={{fontSize:"1.85rem",marginRight:3,opacity:0.95}}>{habit.emoji}</span>
      <div style={{flex:1}}>
        <span style={{fontWeight:600, fontSize:"1.12rem"}}>{habit.name}</span>
        <div style={{fontSize:"0.93rem",color:"#a7adc0"}}>
          <HabitFrequency frequency={habit.frequency} />
        </div>
        <div style={{fontSize:"0.92rem",marginTop:2}}>
          <span role="img" aria-label="streak">🔥</span>
          <span style={{fontWeight:600,marginLeft:2,marginRight:3}}>{habit.streak||0}</span>streak &nbsp;
          <span style={{opacity:0.7}}>(best: {habit.bestStreak||0})</span>
        </div>
      </div>
      <div>
        {!doneToday && (
          <button className="btn" style={{
            color:"white",background: PRIMARY_COLOR,
            margin:"2px 0 2px 0",padding:"6px 12px"
          }}
          onClick={() => onCheck(habit.id)} title="Mark complete">✔️</button>
        )}
        {doneToday && (
          <button className="btn" style={{
            color: PRIMARY_COLOR, background: "#f7f7fa",
            margin:"2px 0 2px 0", padding:"6px 12px", border:`1px solid ${PRIMARY_COLOR}`
          }}
          onClick={() => onUndo(habit.id)} title="Undo">↩️</button>
        )}
      </div>
      <button className="btn" style={{
        background:"none",
        color:"#bbb",
        padding:"4px 10px",
        fontSize:"1.15rem"
      }}
        title="Edit"
        onClick={() => onEdit(habit.id)}
      >✏️</button>
      <button className="btn" style={{
        background:"none",
        color:"#e76a5d",
        padding:"4px 8px",
        fontSize:"1.19rem"
      }}
        title="Delete"
        onClick={() => onDelete(habit.id)}
      >🗑️</button>
    </div>
  );
}

function HabitFrequency({ frequency }) {
  if (!frequency || frequency.length === 0) return (
    <span>Every day</span>
  );
  if (frequency.length === 7) return (
    <span>Every day</span>
  );
  return (
    <span>
      {frequency.map(wd=>wd.substr(0,3)).join(", ")}
    </span>
  );
}

// =================== ADD/EDIT HABIT MODAL PAGE ===================
function HabitFormModal({ onClose, onSave, existingHabit, allHabits, accentColor }) {
  // UI State
  const [name, setName] = useState(existingHabit ? existingHabit.name : "");
  const [emoji, setEmoji] = useState(existingHabit ? existingHabit.emoji : "📝");
  const [frequency, setFrequency] = useState(
    existingHabit ? [...existingHabit.frequency] : [...WEEKDAYS]
  );
  const [reminders, setReminders] = useState(
    existingHabit && existingHabit.reminders
      ? { ...existingHabit.reminders }
      : { enabled: false, time: "09:00" }
  );
  const [error, setError] = useState("");

  // Generates random color for habit cards
  const randomColor = useMemo(() => {
    const colors = ["#a5b4fc", "#7b61ff", "#6ee7b7", "#ffda77", "#ffb7c5"];
    return colors[Math.floor(Math.random() * colors.length)];
  }, []);

  // PUBLIC_INTERFACE
  /** Returns a random emoji from a curated set, for made-for-fun UX. */
  function randomEmoji() {
    const emojis = ["📝", "🏃", "💧", "🧘", "📚", "🍎", "🤸", "🎨", "🛏️", "🦷", "🥗", "🕯️", "🦋"];
    return emojis[Math.floor(Math.random() * emojis.length)];
  }

  // Validation and Save
  const handleSave = (e) => {
    e.preventDefault();
    if (!name.trim()) return setError("Name cannot be empty.");
    if (allHabits && !existingHabit && allHabits.some(h=>h.name===name.trim())) {
      return setError("You already have a habit with this name.");
    }
    // Construct habit object
    const habitObj = {
      id: existingHabit ? existingHabit.id : Date.now().toString(36) + Math.random().toString(36).substr(2,6),
      name: name.trim(),
      emoji,
      frequency,
      reminders,
      created: existingHabit? existingHabit.created : todayStr(),
      streak: existingHabit? existingHabit.streak : 0,
      bestStreak: existingHabit? existingHabit.bestStreak : 0,
      history: existingHabit? existingHabit.history : [],
      color: existingHabit? existingHabit.color : randomColor,
    };
    onSave(habitObj);
  };

  return (
    <div style={{
      position: "fixed", left:0, top:0, width:"100vw",height:"100vh",
      background:"rgba(50,59,115,0.26)", zIndex:2333,
      display:"flex", alignItems:"center", justifyContent:"center"
    }}>
      <form onSubmit={handleSave}
        style={{
          background:"white", color:"#181926",
          borderRadius:22,
          padding:"32px 26px 23px 26px",
          minWidth:300, maxWidth:350,
          boxShadow:"0 6px 24px 0 rgba(80,53,222,0.10)",
          position:"relative"
        }}>
        <div style={{position:"absolute",top:11,right:18}}>
          <button
            className="btn"
            style={{background:"none",color:accentColor,fontWeight:600,padding:5,fontSize:18}}
            onClick={(e)=>{e.preventDefault();onClose();}}
            aria-label="Close"
          >✖️</button>
        </div>
        <div style={{textAlign:"center",marginBottom:10}}>
          <span style={{fontSize:30,marginBottom:1}}>{emoji}</span>
          <br />
          <input
            type="text"
            value={emoji}
            maxLength={3}
            onChange={e=>setEmoji(e.target.value)}
            style={{
              width:38,textAlign:"center",
              fontSize:23,borderRadius:6,
              margin:"0 6px",padding:"2px 4px",border:"1.2px solid #d4d4d4",
              background:"#fcfcfc"
            }}
            aria-label="Emoji"
          />
          <button
            className="btn"
            type="button"
            style={{
              background:"none",
              border:`1.2px solid #bbb`, color:"#a5b4fc",
              marginLeft:8,fontSize:"0.93rem",padding:"3px 8px"
            }}
            onClick={()=>setEmoji(randomEmoji())}
            aria-label="Random Emoji"
          >🎲</button>
        </div>
        <div style={{marginBottom:14}}>
          <input
            type="text"
            placeholder="Habit name"
            value={name}
            onChange={e=>setName(e.target.value)}
            autoFocus
            style={{
              width:"100%", fontSize:"1.07rem",
              padding:"7px 7px", borderRadius:6,
              border:"1.2px solid #d4d4d4", marginBottom:7
            }}
          />
          {error && (
            <div style={{color:"#e76a5d",fontSize:"0.94rem",marginTop:3}}>{error}</div>
          )}
        </div>
        <div style={{marginBottom:10}}>
          <div style={{fontWeight:600, fontSize:"1.03rem",marginBottom:6}}>
            Days
          </div>
          <div style={{
            display:"flex",justifyContent:"center",gap:8,marginBottom:2
          }}>
            {WEEKDAYS.map(wd=>{
              const selected = frequency.includes(wd);
              return (
                <button
                  type="button"
                  key={wd}
                  onClick={()=>{
                    setFrequency(frequency.includes(wd)
                      ? frequency.filter(d=>d!==wd)
                      : [...frequency, wd]
                    );
                  }}
                  style={{
                    background: selected? accentColor : "#f7fafc",
                    color: selected? "#fff" : "#233",
                    border:"none",borderRadius:5,fontWeight:selected?700:500,
                    fontSize:15,width:30
                  }}
                  aria-pressed={selected}
                >
                  {wd.substr(0,2)}
                </button>
              );
            })}
          </div>
        </div>
        <div style={{marginBottom:11}}>
          <div style={{display:"flex",alignItems:"center"}}>
            <input
              type="checkbox"
              checked={reminders.enabled}
              onChange={e=>setReminders(r=>({...r,enabled:!r.enabled}))}
              id="reminder-check"
              style={{marginRight:7}}
            />
            <label htmlFor="reminder-check" style={{fontWeight:500,fontSize:"1rem"}}>
              Daily Reminder
            </label>
            {reminders.enabled && (
              <input
                type="time"
                value={reminders.time}
                onChange={e=>setReminders(r=>({...r, time:e.target.value}))}
                style={{marginLeft:12, fontSize:"0.97rem"}}
              />
            )}
          </div>
        </div>
        <button
          className="btn btn-large"
          type="submit"
          style={{
            background:accentColor,
            width:"100%",
            marginTop:8
          }}
        >
          {existingHabit? "Update" : "Add"} Habit
        </button>
      </form>
    </div>
  );
}

// =================== STREAK / PROGRESS PAGE ===================
function StreakPage({ habits, onClose, accentColor }) {
  // Compute streak stats for chart
  // For MVP we do simple bar chart of completed days for past N days.
  const N = 21;
  const today = new Date(todayStr());
  // Build [dates: str] for last N days
  const lastNDates = Array.from({length:N}, (_,i)=>getNDaysAgo(N-1-i));
  // For each date, count how many habits completed that day
  const dateToCount = lastNDates.map(dateStr=>{
    let cnt = habits.reduce(
      (a,h)=>a+(h.history.includes(dateStr)?1:0),0
    );
    return { date: dateStr, count: cnt };
  });
  // Find overall best streak habit
  const best = habits.length
    ? habits.reduce((acc, h) => h.bestStreak > acc.bestStreak ? h : acc, habits[0])
    : null;

  return (
    <div style={{
      position: "fixed", top:0, left:0, width:"100vw", height:"100vh",
      background:"rgba(26,24,42,0.13)",
      zIndex:2333,display:"flex",alignItems:"center",justifyContent:"center"
    }}>
      <div style={{
        background:"white", color:"#1a1a1a", minWidth:340, maxWidth:400,
        borderRadius: 18, padding:"24px 22px 18px 22px", boxShadow:"0 10px 28px 0 rgba(80,53,222,0.12)",
        position:"relative"
      }}>
        <button
          className="btn"
          onClick={onClose}
          style={{position:"absolute",right:13,top:11,background:"none",color:accentColor,fontWeight:700,fontSize:18}}
          aria-label="Close"
        >✖️</button>
        <div style={{fontSize:"1.24rem",fontWeight:700,color:accentColor,marginBottom:8,textAlign:"center"}}>Your Progress</div>
        {best && (
          <div style={{marginBottom:8}}>
            <span style={{fontSize:"1.16rem"}}>🔥 Best Streak: <b>{best.bestStreak||0}</b></span>
            <span style={{marginLeft:8,opacity:0.8}}>
              <span style={{fontSize:19}}>{best.emoji}</span> <span>{best.name}</span>
            </span>
          </div>
        )}
        <div className="subtitle" style={{fontWeight:600, fontSize:16, color:"#5e6df9",margin:"12px 0 2px 0"}}>Last {N} Days Activity</div>
        {/* Simple Bar "Heatmap" */}
        <div style={{
          display:"flex", gap:4, marginTop:7,
          alignItems:"flex-end",height:54,overflowX:"auto"
        }}>
        {dateToCount.map(({date,count}, idx)=>(
          <div key={date}
            style={{
              background: `linear-gradient(171deg,${accentColor},#82e6d9)`,
              width: 10, minHeight:6, height: 14 + 15*count,
              borderRadius:6, opacity:Math.max(0.4,0.72-0.04*(N-idx)),
              display:"flex", flexDirection:"column",alignItems:"center",
              transition:"height 0.22s cubic-bezier(.2,.74,.62,1.46)"
            }}>
              <span style={{
                fontSize: "0.7rem", color: "#a7adc0",height:10
              }}>{count>0?count:""}</span>
          </div>
        ))}
        </div>
        <div style={{
          fontSize:"0.96rem",color:"#a7adc0",marginTop:10, textAlign:"center"
        }}>
          <span role="img" aria-label="hint">💡</span> Keep the streak going! Missing a day breaks the streak.
        </div>
      </div>
    </div>
  );
}

/* Modernized Settings Page with close/back, animated toggles, and updated layout */
function SettingsPage({ settings, setSettings, onLogout, onDataReset, accentColor }) {
  // PUBLIC_INTERFACE
  /**
   * This SettingsPage component displays app settings in a modern, card-styled modal.
   * Features a prominent close/back button, animated toggle switches for dark mode & reminders,
   * logout & reset actions, consistent gradient minimal layout, and updates parent state reactively.
   */
  const handleClose = () => {
    // Find a handler from props or fallback to window close
    if (typeof window !== "undefined") {
      // Simulate a close/back action via history if needed or setShowSettings(false) in parent
      const evt = new CustomEvent("close-settings");
      window.dispatchEvent(evt);
    }
    // In app: parent sets setShowSettings(false)
    // Not directly controlled here – acts as modal so suggest using onClose in future.
    // For this template, we will require parent to control showSettings.
    // We can trigger a "close" using a ref/callback in future.
    // This is left as an explicit instruction.
    // In this codebase, parent sets showSettings with setShowSettings(false).
    // So we rely on ESC/close/back handler, see usage in App.js.
    // No-op here; close handled in parent.
  };

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



// =================== NOTIFICATION/TOAST ===================
function ToastContainer({ toast }) {
  if (!toast) return null;
  let bg = "#f7fafc", color= "#233", border="#6ee7b7";
  if (toast.type==="success") {bg="#dcfff2"; color:"#315d38"; border="#6ee7b7";}
  else if (toast.type==="info") {bg="#e2e8f0"; color:"#3f4855"; border="#a5b4fc";}
  else if (toast.type==="reminder") {bg="#fff9e2"; color:"#a07915";border:"#ffc05c";}
  else if (toast.type==="error") {bg="#ffe4e6"; color:"#9b1c1c"; border:"#e76a5d";}
  return (
    <div style={{
      position:"fixed",bottom:30,right:20,zIndex:3549,
      background:bg, color, borderLeft:`5px solid ${border}`,
      borderRadius:12,padding:"14px 26px 14px 18px",
      boxShadow: "0 6px 36px 0 rgba(80,53,222,0.08)",
      fontSize:"1.13rem",minWidth:130
    }}>
      {toast.msg}
    </div>
  );
}

// =================== FLOATING ADD BUTTON ===================
function FloatingAddButton({ onClick }) {
  return (
    <button
      className="btn btn-large"
      aria-label="Add habit"
      onClick={onClick}
      style={{
        position:"fixed",
        right:28,
        bottom:34,
        background:PRIMARY_COLOR,
        boxShadow:"0 8px 24px 0 #7b9cff41, 0 1.5px 4px 0 #a5b4fc35",
        color:"#fff",
        borderRadius:"50%",
        width:57,
        height:57,
        fontSize:"2.15rem",
        zIndex:2933,
        display:"flex",
        alignItems:"center",
        justifyContent:"center"
      }}
    >
      <span role="img" aria-label="plus">➕</span>
    </button>
  );
}

// =================== EMPTY STATE PAGE ===================
function EmptyStatePage({ onAdd }) {
  return (
    <div style={{
      padding:"38px 4px 25px 4px",
      marginTop:30,
      textAlign:"center",
      background:"linear-gradient(120deg,#e0e7ff33,#a5b4fc11)",
      borderRadius:21,
      boxShadow:"0 1px 9px 0 #a5b4fc11"
    }}>
      <div style={{
        fontSize:59,
        marginBottom:6,
        marginTop:7
      }}>🌱</div>
      <div style={{
        fontWeight:600,
        fontSize:"1.23rem",
        color:PRIMARY_COLOR,
        marginBottom:11
      }}>Your Habit List is Empty</div>
      <div className="description" style={{
        color:"#2d3748", fontSize:"1rem",
        marginBottom:16
      }}>
        Let's get started with your first habit!<br />
        Click below to add a new habit and begin your streak.
      </div>
      <button
        className="btn btn-large"
        style={{background:PRIMARY_COLOR, color:"#fff",width:"68%",margin:"0 auto"}}
        onClick={onAdd}
      >
        + Add Habit
      </button>
    </div>
  );
}


export default App;
