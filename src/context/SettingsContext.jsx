import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import toast from "react-hot-toast";

import {
  subscribeSettings,
  saveSettings,
} from "../services/settingsService";

import { useAuth } from "./AuthContext";

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({
    societyName: "",
    monthlyCharge: 0,
    collectorTiming: "",
    contactNumber: "",
  });

  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setSettings({
        societyName: "",
        monthlyCharge: 0,
        collectorTiming: "",
        contactNumber: "",
      });
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeSettings((data) => {
      setSettings(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  async function updateSettings(data) {
    try {
      await saveSettings(data);
      toast.success("Settings Saved Successfully");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to save settings");
      return false;
    }
  }

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        updateSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}