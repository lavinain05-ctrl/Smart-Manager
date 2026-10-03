import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
} from "react";

import toast from "react-hot-toast";
import { useAuth } from "./AuthContext";
import {
  subscribeProperties,
  createProperty as createPropertyService,
  updateProperty as updatePropertyService,
  deleteProperty as deletePropertyService,
  linkOccupantToProperty as linkOccupantService,
  endTenancy as endTenancyService,
  validatePropertyUniqueness,
  generatePropertyId,
  normalizeFloor,
  normalizePlotNumber,
  normalizeUnitNumber,
  formatPropertyDisplay,
} from "../services/propertyService";

const PropertyContext = createContext();

export function PropertyProvider({ children }) {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setProperties([]);
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeProperties((data) => {
      setProperties(data || []);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // =============================================
  // Duplicate Property Checker (In-memory + Fast UI Feedback)
  // =============================================
  function checkPropertyDuplicate({
    blockId,
    blockName = "",
    plotNumber,
    floor,
    unitNumber = "",
    excludePropertyId = null,
  }) {
    return validatePropertyUniqueness({
      targetBlockId: blockId,
      targetPlotNumber: plotNumber,
      targetFloor: floor,
      targetUnitNumber: unitNumber,
      existingProperties: properties,
      excludePropertyId,
      blockName,
    });
  }

  // =============================================
  // Lookup helpers
  // =============================================
  function getPropertyById(id) {
    if (!id) return null;
    return properties.find((p) => p.id === id || p.propertyId === id) || null;
  }

  function findPropertyMatch({ blockId, plotNumber, floor, unitNumber }) {
    const normPlot = normalizePlotNumber(plotNumber);
    const normFloorCode = normalizeFloor(floor).code;
    const normUnit = normalizeUnitNumber(unitNumber);

    return (
      properties.find((p) => {
        const pBlock = String(p.blockId || "").trim();
        const pPlot = normalizePlotNumber(p.plotNumber);
        const pFloor = normalizeFloor(p.floor || p.floorNumber).code;
        const pUnit = normalizeUnitNumber(p.unitNumber);

        return (
          pBlock === String(blockId || "").trim() &&
          pPlot === normPlot &&
          pFloor === normFloorCode &&
          pUnit === normUnit
        );
      }) || null
    );
  }

  // =============================================
  // Add / Create Property
  // =============================================
  async function addProperty(propertyData) {
    try {
      // 1. In-memory validation check
      const validation = checkPropertyDuplicate({
        blockId: propertyData.blockId,
        blockName: propertyData.blockName,
        plotNumber: propertyData.plotNumber,
        floor: propertyData.floor,
        unitNumber: propertyData.unitNumber,
      });

      if (!validation.valid) {
        toast.error(validation.error);
        return false;
      }

      // 2. Atomic Firestore transaction write
      const created = await createPropertyService({
        ...propertyData,
        createdBy: user?.name || user?.email || "Admin",
        createdById: user?.uid || "",
      });

      toast.success(
        `Property created: Plot ${created.plotNumber} ${created.floor} ${
          created.unitNumber ? `Unit ${created.unitNumber}` : ""
        }`
      );
      return created;
    } catch (error) {
      console.error("[PropertyContext] Error adding property:", error);
      toast.error(error.message || "Failed to create property.");
      return false;
    }
  }

  // =============================================
  // Update Property
  // =============================================
  async function updateProperty(id, updates) {
    try {
      if (
        updates.blockId !== undefined ||
        updates.plotNumber !== undefined ||
        updates.floor !== undefined ||
        updates.unitNumber !== undefined
      ) {
        const current = getPropertyById(id) || {};
        const validation = checkPropertyDuplicate({
          blockId: updates.blockId ?? current.blockId,
          blockName: updates.blockName ?? current.blockName,
          plotNumber: updates.plotNumber ?? current.plotNumber,
          floor: updates.floor ?? current.floor,
          unitNumber: updates.unitNumber ?? current.unitNumber,
          excludePropertyId: id,
        });

        if (!validation.valid) {
          toast.error(validation.error);
          return false;
        }
      }

      await updatePropertyService(id, updates, user?.name || "Admin");
      toast.success("Property updated successfully.");
      return true;
    } catch (error) {
      console.error("[PropertyContext] Error updating property:", error);
      toast.error(error.message || "Failed to update property.");
      return false;
    }
  }

  // =============================================
  // Delete Property
  // =============================================
  async function deleteProperty(id) {
    try {
      const property = getPropertyById(id);
      if (property?.currentOccupantResidentId || property?.ownerResidentId) {
        toast.error("Cannot delete property with registered occupants. Please reassign occupants first.");
        return false;
      }

      await deletePropertyService(id);
      toast.success("Property deleted.");
      return true;
    } catch (error) {
      console.error("[PropertyContext] Error deleting property:", error);
      toast.error(error.message || "Failed to delete property.");
      return false;
    }
  }

  // =============================================
  // Link Occupant (Owner or Tenant)
  // =============================================
  async function linkOccupant(propertyId, residentId, residentName, personType = "OWNER") {
    try {
      await linkOccupantService({
        propertyId,
        residentId,
        residentName,
        personType,
        recordedBy: user?.name || "Admin",
      });
      return true;
    } catch (error) {
      console.error("[PropertyContext] Error linking occupant:", error);
      toast.error(error.message || "Failed to link resident to property.");
      return false;
    }
  }

  // =============================================
  // End Tenancy
  // =============================================
  async function endTenancy(propertyId, formerTenantId) {
    try {
      await endTenancyService({
        propertyId,
        formerTenantId,
        endedBy: user?.name || "Admin",
        revertToOwner: true,
      });
      toast.success("Tenancy ended. Property occupancy status updated.");
      return true;
    } catch (error) {
      console.error("[PropertyContext] Error ending tenancy:", error);
      toast.error(error.message || "Failed to end tenancy.");
      return false;
    }
  }

  // =============================================
  // Computed Aggregate Stats (Admin Dashboard & Reports)
  // =============================================
  const propertyStats = useMemo(() => {
    const total = properties.length;
    let ownerOccupied = 0;
    let tenantOccupied = 0;
    let vacant = 0;
    let withUnitNumbers = 0;
    let withoutUnitNumbers = 0;
    const byFloor = {};

    properties.forEach((p) => {
      const occ = (p.occupancyStatus || "").toUpperCase();
      if (occ === "OWNER_OCCUPIED") ownerOccupied++;
      else if (occ === "TENANT_OCCUPIED") tenantOccupied++;
      else vacant++;

      const unit = normalizeUnitNumber(p.unitNumber);
      if (unit) withUnitNumbers++;
      else withoutUnitNumbers++;

      const fl = normalizeFloor(p.floor || p.floorNumber).label;
      byFloor[fl] = (byFloor[fl] || 0) + 1;
    });

    return {
      total,
      occupied: ownerOccupied + tenantOccupied,
      ownerOccupied,
      tenantOccupied,
      vacant,
      withUnitNumbers,
      withoutUnitNumbers,
      byFloor,
    };
  }, [properties]);

  const value = {
    properties,
    loading,
    propertyStats,
    getPropertyById,
    findPropertyMatch,
    checkPropertyDuplicate,
    addProperty,
    updateProperty,
    deleteProperty,
    linkOccupant,
    endTenancy,
    formatPropertyDisplay,
    generatePropertyId,
  };

  return (
    <PropertyContext.Provider value={value}>
      {children}
    </PropertyContext.Provider>
  );
}

export function useProperties() {
  const context = useContext(PropertyContext);
  if (!context) {
    throw new Error("useProperties must be used within a PropertyProvider");
  }
  return context;
}
