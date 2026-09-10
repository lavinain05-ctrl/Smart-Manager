import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

import { storage } from "../firebase/firebase";

// =============================
// Upload an image to Firebase Storage
// =============================

export async function uploadImage(path, file) {
  const storageRef = ref(storage, path);
  const snapshot = await uploadBytes(storageRef, file);
  return await getDownloadURL(snapshot.ref);
}

// =============================
// Delete an image from Firebase Storage
// =============================

export async function deleteImage(path) {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
    return true;
  } catch (error) {
    // File may not exist — not critical
    console.warn("[Storage] delete failed:", error.message);
    return false;
  }
}

// =============================
// Get download URL for existing path
// =============================

export async function getImageUrl(path) {
  try {
    const storageRef = ref(storage, path);
    return await getDownloadURL(storageRef);
  } catch {
    return null;
  }
}

// =============================
// Upload profile photo with standardized path
// =============================

export async function uploadProfilePhoto(userId, file, folder = "profiles") {
  const ext = file.name?.split(".").pop() || "jpg";
  const path = `${folder}/${userId}.${ext}`;
  return await uploadImage(path, file);
}
