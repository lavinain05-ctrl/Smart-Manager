import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";

import toast from "react-hot-toast";
import { doc, writeBatch } from "firebase/firestore";
import { db } from "../firebase/firebase";

import {
  subscribeBlocks,
  addBlock as addBlockService,
  updateBlock as updateBlockService,
  deleteBlock as deleteBlockService,
  subscribeFlats,
  addFlat as addFlatService,
  updateFlat as updateFlatService,
  deleteFlat as deleteFlatService,
  flatNumberExists,
  linkResidentToFlat as linkService,
  unlinkResidentFromFlat as unlinkService,
  generateFlatsForBlock as generateService,
} from "../services/blockFlatService";

import { useAuth } from "./AuthContext";
import { useResidents } from "./ResidentContext";

const BlockFlatContext = createContext();

export function BlockFlatProvider({ children }) {
  const [blocks, setBlocks] = useState([]);
  const [flats, setFlats] = useState([]);
  const { user } = useAuth();
  const { residents } = useResidents();

  useEffect(() => {
    if (!user) {
      setBlocks([]);
      setFlats([]);
      return;
    }

    const unsubBlocks = subscribeBlocks(setBlocks);
    const unsubFlats = subscribeFlats(setFlats);

    return () => {
      unsubBlocks();
      unsubFlats();
    };
  }, [user?.uid]);

  // =============================================
  // Resolve flats: join residentId → resident data
  // Same pattern as GarbageContext — render-time join
  // =============================================

  const residentsMap = useMemo(() => {
    const map = {};
    (residents || []).forEach((r) => { map[r.id] = r; });
    return map;
  }, [residents]);

  const resolvedFlats = useMemo(() => {
    return flats.map((flat) => {
      if (!flat.residentId) return { ...flat, residentName: "" };
      const resident = residentsMap[flat.residentId];
      return {
        ...flat,
        residentName: resident?.owner || "Unlinked Resident",
        residentMobile: resident?.mobile || "",
        residentEmail: resident?.email || "",
        garbageStatus: resident?.garbageStatus || "not_participating",
        residentCharge: Number(resident?.charge || 0),
      };
    });
  }, [flats, residentsMap]);

  // ---- Blocks ----

  async function addBlock(data) {
    try {
      if (blocks.some((b) => b.name.toLowerCase() === data.name.trim().toLowerCase())) {
        toast.error(`Block "${data.name}" already exists`);
        return false;
      }
      const docRef = await addBlockService(data);
      toast.success("Block added");
      return docRef;
    } catch (error) {
      console.error(error);
      toast.error("Failed to add block");
      return false;
    }
  }

  async function updateBlock(id, data) {
    try {
      await updateBlockService(id, data);
      toast.success("Block updated");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to update block");
      return false;
    }
  }

  async function deleteBlock(id) {
    try {
      const block = blocks.find((b) => b.id === id);
      const blockFlats = flats.filter((f) => f.blockId === id);

      // Check if any resident is living in this block or in any flat of this block
      const hasActiveResidents = (residents || []).some((r) => {
        return (
          (block && r.block === block.name) ||
          (block && r.blockId === id) ||
          blockFlats.some((f) => f.residentId === r.id || (r.flat && f.flatNumber === r.flat))
        );
      });

      if (hasActiveResidents) {
        toast.error("Cannot delete block — active residents are still registered in this block. Please reassign or delete residents first.");
        return false;
      }

      // If there are vacant flats in this block, delete them automatically
      if (blockFlats.length > 0) {
        const batch = writeBatch(db);
        blockFlats.forEach((f) => {
          batch.delete(doc(db, "flats", f.id));
        });
        await batch.commit();
      }

      await deleteBlockService(id);
      toast.success(`Block "${block?.name || ""}" deleted successfully`);
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete block: " + (error.message || "Unknown error"));
      return false;
    }
  }

  // ---- Flats ----

  async function addFlat(data) {
    try {
      const exists = await flatNumberExists(data.flatNumber, data.blockId);
      if (exists) {
        toast.error(`Flat "${data.flatNumber}" already exists in this block`);
        return false;
      }
      await addFlatService(data);
      toast.success("Flat added");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to add flat");
      return false;
    }
  }

  async function updateFlat(id, data) {
    try {
      await updateFlatService(id, data);
      toast.success("Flat updated");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to update flat");
      return false;
    }
  }

  async function deleteFlat(id) {
    try {
      await deleteFlatService(id);
      toast.success("Flat deleted");
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete flat");
    }
  }

  // ---- Link / Unlink ----

  async function linkResidentToFlat(flatId, residentId) {
    try {
      await linkService(flatId, residentId);
      toast.success("Resident linked to flat");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to link resident");
      return false;
    }
  }

  async function unlinkResidentFromFlat(flatId) {
    try {
      await unlinkService(flatId);
      toast.success("Flat released");
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to release flat");
      return false;
    }
  }

  // ---- Auto-generate Flats ----

  async function generateFlats(blockId, blockName, count, startNumber, floors) {
    try {
      await generateService(blockId, blockName, count, startNumber, floors);
      toast.success(`${count} flats generated for ${blockName}`);
      return true;
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate flats");
      return false;
    }
  }

  return (
    <BlockFlatContext.Provider
      value={{
        blocks,
        flats: resolvedFlats,
        rawFlats: flats,
        residents,
        addBlock,
        updateBlock,
        deleteBlock,
        addFlat,
        updateFlat,
        deleteFlat,
        linkResidentToFlat,
        unlinkResidentFromFlat,
        generateFlats,
      }}
    >
      {children}
    </BlockFlatContext.Provider>
  );
}

export function useBlockFlat() {
  return useContext(BlockFlatContext);
}
