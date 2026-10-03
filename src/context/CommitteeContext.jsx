import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import toast from "react-hot-toast";

import {
  subscribeCommittee,
  addCommitteeMember as addService,
  updateCommitteeMember as updateService,
  removeCommitteeMember as removeService,
  uploadCommitteePhoto as uploadPhotoService,
  deleteCommitteePhoto as deletePhotoService,
  replaceCommitteePhoto as replacePhotoService,
  setCommitteePhotoUrl as setPhotoUrlService,
} from "../services/committeeService";

import { useAuth } from "./AuthContext";

const CommitteeContext = createContext();

export function CommitteeProvider({ children }) {
  const [committee, setCommittee] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setCommittee([]);
      return;
    }

    const unsubscribe = subscribeCommittee((data) => {
      setCommittee(data);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  async function addCommitteeMember(data) {
    try {
      const uid = await addService(data);
      toast.success("Committee member account created");
      return uid;
    } catch (error) {
      console.error(error);
      if (error.code === "auth/email-already-in-use") {
        toast.error("This mobile number is already registered in the system.");
      } else {
        toast.error(error.message || "Failed to create account");
      }
      return null;
    }
  }

  async function updateCommitteeMember(uid, data) {
    try {
      await updateService(uid, data);
      toast.success("Committee member updated");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to update member");
      return false;
    }
  }

  async function removeCommitteeMember(uid) {
    try {
      await removeService(uid);
      toast.success("Committee member removed");
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove member");
    }
  }

  async function uploadCommitteePhoto(memberId, file) {
    try {
      const url = await uploadPhotoService(memberId, file);
      toast.success("Profile photo uploaded");
      return url;
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to upload photo");
      return null;
    }
  }

  async function deleteCommitteePhoto(memberId) {
    try {
      await deletePhotoService(memberId);
      toast.success("Profile photo removed");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to remove photo");
      return false;
    }
  }

  async function replaceCommitteePhoto(memberId, file) {
    try {
      const url = await replacePhotoService(memberId, file);
      toast.success("Profile photo updated");
      return url;
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to update photo");
      return null;
    }
  }

  async function setCommitteePhotoUrl(memberId, photoUrl) {
    try {
      const url = await setPhotoUrlService(memberId, photoUrl);
      toast.success("Profile photo updated");
      return url;
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Failed to set photo URL");
      return null;
    }
  }

  return (
    <CommitteeContext.Provider
      value={{
        committee,
        addCommitteeMember,
        updateCommitteeMember,
        removeCommitteeMember,
        uploadCommitteePhoto,
        deleteCommitteePhoto,
        replaceCommitteePhoto,
        setCommitteePhotoUrl,
      }}
    >
      {children}
    </CommitteeContext.Provider>
  );
}

export function useCommittee() {
  const ctx = useContext(CommitteeContext);
  return ctx || {
    committee: [],
    addCommitteeMember: async () => null,
    updateCommitteeMember: async () => false,
    removeCommitteeMember: async () => false,
  };
}
