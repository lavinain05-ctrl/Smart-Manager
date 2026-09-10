import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  orderBy,
  writeBatch,
  getDocs,
} from "firebase/firestore";

import { db } from "../firebase/firebase";

const notificationsRef = collection(db, "notifications");

/* ===============================
   Subscribe user notifications
================================ */

export function subscribeNotifications(userId, callback, userRole = "resident") {
  if (!userId) return () => {};

  let userNotifs = [];
  let broadcastNotifs = [];
  let roleNotifs = [];

  const notify = () => {
    const combined = [...userNotifs, ...broadcastNotifs, ...roleNotifs];
    const uniqueMap = new Map();
    combined.forEach((item) => {
      uniqueMap.set(item.id, item);
    });
    const sorted = Array.from(uniqueMap.values()).sort((a, b) => {
      const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return timeB - timeA;
    });
    callback(sorted);
  };

  const qUser = query(
    notificationsRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );
  const unsubUser = onSnapshot(qUser, (snap) => {
    userNotifs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    notify();
  }, (err) => {
    console.warn("[Notifications] User listener warning:", err.message);
  });

  const qAll = query(
    notificationsRef,
    where("userId", "==", "all"),
    orderBy("createdAt", "desc")
  );
  const unsubAll = onSnapshot(qAll, (snap) => {
    broadcastNotifs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    notify();
  }, (err) => {
    console.warn("[Notifications] Broadcast listener warning:", err.message);
  });

  let unsubRole = () => {};
  if (userRole && userRole !== "all") {
    const qRole = query(
      notificationsRef,
      where("userId", "==", userRole),
      orderBy("createdAt", "desc")
    );
    unsubRole = onSnapshot(qRole, (snap) => {
      roleNotifs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      notify();
    }, (err) => {
      console.warn("[Notifications] Role listener warning:", err.message);
    });
  }

  return () => {
    unsubUser();
    unsubAll();
    unsubRole();
  };
}

/* ===============================
   Create notification
================================ */

export async function createNotification({
  userId,
  title,
  message,
  type,
  link,
}) {
  return await addDoc(notificationsRef, {
    userId,
    title,
    message: message || "",
    type: type || "info",
    link: link || "",
    read: false,
    createdAt: serverTimestamp(),
  });
}

/* ===============================
   Create notification for multiple users
================================ */

export async function createBulkNotifications({
  userIds,
  title,
  message,
  type,
  link,
}) {
  const batch = writeBatch(db);

  userIds.forEach((userId) => {
    const ref = doc(notificationsRef);
    batch.set(ref, {
      userId,
      title,
      message: message || "",
      type: type || "info",
      link: link || "",
      read: false,
      createdAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

/* ===============================
   Mark as read
================================ */

export async function markNotificationRead(id) {
  await updateDoc(doc(db, "notifications", id), {
    read: true,
  });
}

export async function markAllNotificationsRead(userId) {
  const q = query(
    notificationsRef,
    where("userId", "==", userId),
    where("read", "==", false)
  );

  const snapshot = await getDocs(q);
  const batch = writeBatch(db);

  snapshot.docs.forEach((d) => {
    batch.update(d.ref, { read: true });
  });

  await batch.commit();
}
