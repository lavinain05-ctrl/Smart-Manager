import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import toast from "react-hot-toast";

import {
  subscribeComplaints,
  addComplaint as addComplaintService,
  updateComplaint as updateComplaintService,
  updateComplaintStatus as updateStatusService,
  addCommentToComplaint as addCommentService,
  deleteComplaint as deleteComplaintService,
} from "../services/complaintService";

import { useAuth } from "./AuthContext";

const ComplaintContext = createContext();

export function ComplaintProvider({ children }) {
  const [complaints, setComplaints] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setComplaints([]);
      return;
    }

    const unsubscribe = subscribeComplaints((data) => {
      setComplaints(data);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  async function addComplaint(data) {
    try {
      await addComplaintService(data);
      toast.success("Complaint Submitted Successfully");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit complaint");
      return false;
    }
  }

  async function updateComplaint(id, data) {
    try {
      await updateComplaintService(id, data);
      toast.success("Complaint Updated Successfully");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to update complaint");
      return false;
    }
  }

  async function updateComplaintStatus(id, existingTimeline, status, note) {
    try {
      await updateStatusService(id, existingTimeline, status, note);
      toast.success(`Complaint marked as ${status}`);
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to update status");
      return false;
    }
  }

  async function addComment(id, existingComments, comment) {
    try {
      await addCommentService(id, existingComments, comment);
      toast.success("Comment Added");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to add comment");
      return false;
    }
  }

  async function deleteComplaint(id) {
    try {
      await deleteComplaintService(id);
      toast.success("Complaint Deleted Successfully");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete complaint");
    }
  }

  return (
    <ComplaintContext.Provider
      value={{
        complaints,
        addComplaint,
        updateComplaint,
        updateComplaintStatus,
        addComment,
        deleteComplaint,
      }}
    >
      {children}
    </ComplaintContext.Provider>
  );
}

export function useComplaints() {
  return useContext(ComplaintContext);
}
