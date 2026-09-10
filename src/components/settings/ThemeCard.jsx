import { useTheme } from "../../context/ThemeContext";
import { FaMoon, FaSun, FaPalette } from "react-icons/fa";

export default function ThemeCard() {
  const { darkMode, toggleTheme } = useTheme();

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg">
          <FaPalette />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Appearance & Theme
          </h2>
          <p className="text-gray-500 text-sm">
            Customize visual theme. Your preference is saved across sessions.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="button"
          onClick={() => {
            if (darkMode) toggleTheme();
          }}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl border text-sm font-medium transition ${
            !darkMode
              ? "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm"
              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
          }`}
        >
          <FaSun className={!darkMode ? "text-amber-500" : "text-gray-400"} />
          <span>Light Mode</span>
          {!darkMode && <span className="ml-1 w-2 h-2 rounded-full bg-emerald-500"></span>}
        </button>

        <button
          type="button"
          onClick={() => {
            if (!darkMode) toggleTheme();
          }}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl border text-sm font-medium transition ${
            darkMode
              ? "bg-gray-900 border-gray-900 text-white shadow-sm"
              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
          }`}
        >
          <FaMoon className={darkMode ? "text-yellow-400" : "text-gray-400"} />
          <span>Dark Mode</span>
          {darkMode && <span className="ml-1 w-2 h-2 rounded-full bg-emerald-400"></span>}
        </button>
      </div>
    </div>
  );
}