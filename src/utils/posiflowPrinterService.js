// =========================================================================
// POSIFLOW PSF588 / 58mm Mobile Thermal Receipt Printer Library & Driver
// 100% IN-WEBPAGE DIRECT PRINTING (Zero External Apps Needed)
// Built specifically for POSIFLOW PSF588 Thermal Printer
// Features: Direct Web Bluetooth, WebSerial, Compact Paper-Saving ESC/POS
// =========================================================================

import toast from "react-hot-toast";
import { formatResidentFloor } from "../services/propertyService";

export const PRINTER_STORAGE_KEY = "rwa_posiflow_printer_config";

// Default Configuration for POSIFLOW PSF588
export const DEFAULT_PRINTER_CONFIG = {
  mode: "bluetooth", // "bluetooth" | "system" | "usb"
  directPrint: true, // 1-Click Direct Print (no extra confirmation popups)
  printerName: "POSIFLOW PSF588",
  paperWidth: "58mm",
  charsPerLine: 32, // 58mm standard Font A = 32 columns
  feedLines: 2, // 2 lines cut feed (saves 50%+ paper roll!)
  bluetoothDeviceId: null,
  bluetoothDeviceName: null,
};

// Comprehensive Bluetooth BLE Service UUIDs for thermal printers (POSIFLOW, MPT, Telink, ISSC)
const THERMAL_PRINTER_SERVICES = [
  "0000ffe0-0000-1000-8000-00805f9b34fb", // POSIFLOW PSF588 / Shreyans / Everycom / MPT standard
  "0000e781-0000-1000-8000-00805f9b34fb", // Mobile POS BLE
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455", // ISSC Transparent UART
  "000018f0-0000-1000-8000-00805f9b34fb", // Standard Printer Service
  "0000ff00-0000-1000-8000-00805f9b34fb", // Generic ESC/POS
  "0000ae00-0000-1000-8000-00805f9b34fb",
  "0000af00-0000-1000-8000-00805f9b34fb",
  "0000fee7-0000-1000-8000-00805f9b34fb",
  "0000fee0-0000-1000-8000-00805f9b34fb",
  "0000fff0-0000-1000-8000-00805f9b34fb",
  "0000180a-0000-1000-8000-00805f9b34fb",
];

// Active in-memory Bluetooth device & characteristic
let cachedBluetoothDevice = null;
let cachedWriteCharacteristic = null;

// =========================================================================
// 1. CONFIGURATION STORAGE
// =========================================================================
export function getPrinterConfig() {
  try {
    const raw = localStorage.getItem(PRINTER_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PRINTER_CONFIG };
    return { ...DEFAULT_PRINTER_CONFIG, ...JSON.parse(raw) };
  } catch (e) {
    console.warn("Failed to read printer config:", e);
    return { ...DEFAULT_PRINTER_CONFIG };
  }
}

export function savePrinterConfig(updates) {
  try {
    const current = getPrinterConfig();
    const updated = { ...current, ...updates };
    localStorage.setItem(PRINTER_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("posiflow-printer-config-changed", { detail: updated }));
    return updated;
  } catch (e) {
    console.error("Failed to save printer config:", e);
    return updates;
  }
}

// =========================================================================
// 2. ESC/POS COMMAND BUILDER (ULTRA COMPACT / PAPER-SAVING / 32 COLS)
// =========================================================================
export class EscPosBuilder {
  constructor(charsPerLine = 32) {
    this.buffer = [];
    this.charsPerLine = charsPerLine;
    this.init();
  }

  // Initialize printer with standard reset
  init() {
    this.buffer.push(0x1b, 0x40); // ESC @ (Reset)
    this.buffer.push(0x1b, 0x32); // ESC 2 (Default 1/6 inch line pitch)
    return this;
  }

  // Text alignment: 'left', 'center', 'right'
  align(alignment) {
    let code = 0;
    if (alignment === "center") code = 1;
    else if (alignment === "right") code = 2;
    this.buffer.push(0x1b, 0x61, code);
    return this;
  }

  // Bold on/off
  bold(enable = true) {
    this.buffer.push(0x1b, 0x45, enable ? 1 : 0);
    return this;
  }

  // Text sizing: normal, doubleHeight, doubleWidth, doubleBoth
  size(type = "normal") {
    let byte = 0x00;
    if (type === "doubleHeight") byte = 0x01;
    else if (type === "doubleWidth") byte = 0x10;
    else if (type === "doubleBoth") byte = 0x11;
    this.buffer.push(0x1d, 0x21, byte);
    return this;
  }

  // Line feeds
  lineFeed(lines = 1) {
    for (let i = 0; i < lines; i++) {
      this.buffer.push(0x0a);
    }
    return this;
  }

  // ASCII text conversion (replaces unicode ₹ with Rs. for 100% thermal fidelity)
  text(str) {
    if (!str) return this;
    const cleanStr = String(str)
      .replace(/₹/g, "Rs.")
      .replace(/—/g, "-")
      .replace(/[^\x20-\x7E\n\r]/g, " ");
    for (let i = 0; i < cleanStr.length; i++) {
      this.buffer.push(cleanStr.charCodeAt(i));
    }
    return this;
  }

  // Text followed by newline
  textLine(str) {
    this.text(str);
    this.buffer.push(0x0a);
    return this;
  }

  // Single divider line
  divider(char = "-") {
    this.align("left");
    this.size("normal");
    this.bold(false);
    this.textLine(char.repeat(this.charsPerLine));
    return this;
  }

  // Two-column row formatted to exact 32 characters
  row(label, value) {
    this.align("left");
    this.size("normal");
    this.bold(false);

    const cleanLabel = String(label || "").replace(/₹/g, "Rs.");
    const cleanVal = String(value || "").replace(/₹/g, "Rs.");

    const totalLen = cleanLabel.length + cleanVal.length;
    if (totalLen <= this.charsPerLine) {
      const spaces = this.charsPerLine - totalLen;
      this.textLine(cleanLabel + " ".repeat(spaces) + cleanVal);
    } else {
      const availForVal = this.charsPerLine - cleanLabel.length - 1;
      if (availForVal > 8) {
        const valSub = cleanVal.slice(0, availForVal);
        const spaces = this.charsPerLine - (cleanLabel.length + valSub.length);
        this.textLine(cleanLabel + " ".repeat(spaces) + valSub);
      } else {
        this.textLine(cleanLabel);
        const remSpaces = Math.max(0, this.charsPerLine - cleanVal.length);
        this.textLine(" ".repeat(remSpaces) + cleanVal);
      }
    }
    return this;
  }

  // Cut / feed paper (default 2 lines is ideal to clear tear blade without wasting paper)
  cut(feedLines = 2) {
    this.lineFeed(feedLines);
    this.buffer.push(0x1d, 0x56, 0x42, 0x00); // Partial cut command
    return this;
  }

  toBytes() {
    return new Uint8Array(this.buffer);
  }
}

// =========================================================================
// 3. RECEIPT DATA ENCODER (MATCHES EXACT PHYSICAL RECEIPT LAYOUT)
// =========================================================================
export function generateEscPosReceipt(rawReceipt, residentInfo = null) {
  const receipt = residentInfo
    ? {
        ...residentInfo,
        ...rawReceipt,
        plotNumber: rawReceipt.plotNumber || residentInfo.plotNumber || residentInfo.plot || "",
        floor: rawReceipt.floor || residentInfo.floor || "",
        floorCode: rawReceipt.floorCode || residentInfo.floorCode || "",
        unitNumber: rawReceipt.unitNumber || residentInfo.unitNumber || residentInfo.unit || "",
        personType: rawReceipt.personType || residentInfo.personType || residentInfo.occupantType || "",
        block: rawReceipt.block || residentInfo.block || "",
        flat: rawReceipt.flat || rawReceipt.flatNumber || residentInfo.flat || residentInfo.flatNumber || "",
      }
    : rawReceipt;

  const isSpecial = Boolean(
    receipt.collectionName ||
    receipt.type === "Special Collection" ||
    receipt.collectionType === "special"
  );

  const receiptNo = receipt.receiptNumber || receipt.receiptNo || receipt.paymentId || "RWA-" + Date.now();
  const residentName = receipt.residentName || receipt.contributorName || receipt.owner || receipt.name || "Resident";
  const flat = receipt.flat || receipt.flatNumber || "";
  const block = receipt.block || "";
  const plot = receipt.plotNumber || receipt.plot || "";
  const unit = receipt.unitNumber || receipt.unit || "";
  const floorStr = formatResidentFloor(receipt.floor);

  let displayPersonType = (receipt.personType || receipt.occupantType || "").trim();
  if (displayPersonType.toUpperCase() === "TENANT" || displayPersonType.toUpperCase() === "RENTED") {
    displayPersonType = "Rented";
  } else if (displayPersonType.toUpperCase() === "OWNER") {
    displayPersonType = "Owner";
  }

  const amount = Number(receipt.totalPaidAmount || receipt.paidAmount || receipt.amount || 0).toLocaleString("en-IN");
  const mode = receipt.paymentMethod || receipt.paymentMode || receipt.method || "Cash";
  const date = receipt.paymentDate || receipt.date || new Date().toLocaleDateString("en-IN");
  const time = receipt.paymentTime || receipt.time || "";
  const collector = receipt.collectorName || receipt.collector || "RWA Staff";
  const designation = receipt.collectorDesignation ? `(${receipt.collectorDesignation})` : (receipt.collectorRole ? `(${receipt.collectorRole})` : "");
  const remarks = receipt.remarks && receipt.remarks !== "-" ? receipt.remarks : "";

  const periodOrCampaign = isSpecial
    ? receipt.collectionName || receipt.specialCampaignName || "Special Campaign"
    : receipt.isAdvance && receipt.periodLabel
    ? receipt.periodLabel
    : `${receipt.month || ""} ${receipt.year || ""}`.trim() || "Monthly Garbage Fee";

  // Build canonical property string matching photo: "Plot D571, 1st Floor"
  let propertyLine = "";
  if (plot) propertyLine += `Plot ${plot}`;
  if (floorStr && floorStr !== "—") propertyLine += (propertyLine ? `, ` : "") + floorStr;
  if (unit) propertyLine += (propertyLine ? `, ` : "") + `Flat ${unit}`;
  if (!propertyLine && flat) propertyLine = `Flat ${flat}`;

  const builder = new EscPosBuilder(32);

  // --- HEADER ---
  builder.align("center")
    .size("doubleBoth")
    .bold(true)
    .textLine("D BLOCK RWA")
    .size("normal")
    .bold(true)
    .textLine("Indraprastha Colony")
    .textLine(isSpecial ? "[ SPECIAL RECEIPT ]" : "[ GARBAGE FEE RECEIPT ]")
    .divider("-");

  // --- VOUCHER META ---
  builder.row("Receipt No:", receiptNo)
    .row("Date & Time:", `${date}${time ? " " + time : ""}`)
    .divider("-");

  // --- RESIDENT & PROPERTY ---
  builder.row("Resident:", residentName.slice(0, 20));
  if (block) builder.row("Block:", block.toLowerCase().startsWith("block") ? block : `Block ${block}`);
  if (propertyLine) builder.row("Property:", propertyLine.slice(0, 22));
  if (displayPersonType) builder.row("Occupant:", displayPersonType);
  builder.divider("-");

  // --- BILLING / COLLECTION DETAILS ---
  builder.row(isSpecial ? "Campaign:" : "Cycle:", periodOrCampaign.slice(0, 24))
    .row("Pay Mode:", mode)
    .row("Collector:", `${collector} ${designation}`.trim().slice(0, 20));
  if (remarks) {
    builder.row("Notes:", remarks.slice(0, 24));
  }
  builder.divider("-");

  // --- BIG TOTAL AMOUNT ---
  builder.align("center")
    .bold(true)
    .size("doubleBoth")
    .textLine(`Rs. ${amount}`)
    .size("normal")
    .bold(false)
    .divider("-");

  // --- FOOTER ---
  builder.align("center")
    .bold(true)
    .textLine("*** PAYMENT RECEIVED ***")
    .bold(false)
    .lineFeed(1)
    .align("center")
    .textLine("Thank you for supporting")
    .textLine("D Block RWA Indraprastha!")
    .textLine("Keep society clean & green.")
    .cut(3);

  return builder.toBytes();
}

// Generate test receipt for POSIFLOW PSF588
export function generatePosiflowTestReceipt() {
  const builder = new EscPosBuilder(32);
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN");
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  builder.align("center")
    .size("doubleBoth")
    .bold(true)
    .textLine("D BLOCK RWA")
    .size("normal")
    .bold(true)
    .textLine("Indraprastha Colony")
    .textLine("[ GARBAGE FEE RECEIPT ]")
    .divider("-");

  builder.row("Receipt No:", "REC-TEST-588")
    .row("Date & Time:", `${dateStr} ${timeStr}`)
    .divider("-");

  builder.row("Resident:", "Dharmendra Singh")
    .row("Block:", "Block 90 METRE")
    .row("Property:", "Plot D571, 1st Floor")
    .row("Occupant:", "Owner")
    .divider("-");

  builder.row("Cycle:", "Current Cycle")
    .row("Pay Mode:", "Cash")
    .row("Collector:", "Admin (collector)")
    .divider("-");

  builder.align("center")
    .bold(true)
    .size("doubleBoth")
    .textLine("Rs. 480")
    .size("normal")
    .bold(false)
    .divider("-");

  builder.align("center")
    .bold(true)
    .textLine("*** PAYMENT RECEIVED ***")
    .bold(false)
    .lineFeed(1)
    .align("center")
    .textLine("Thank you for supporting")
    .textLine("D Block RWA Indraprastha!")
    .textLine("Keep society clean & green.")
    .cut(3);

  return builder.toBytes();
}

// =========================================================================
// 4. WEB BLUETOOTH DRIVER (DIRECT WIRELESS PRINTING FROM WEBPAGE - ZERO APPS)
// =========================================================================
export function isBluetoothSupported() {
  return typeof navigator !== "undefined" && Boolean(navigator.bluetooth);
}

export async function connectPosiflowBluetooth(forceNew = false) {
  if (!isBluetoothSupported()) {
    throw new Error("Web Bluetooth is not supported in this browser. Please use Chrome on Android/Desktop.");
  }

  // If already connected and not forcing new pair
  if (!forceNew && cachedBluetoothDevice?.gatt?.connected && cachedWriteCharacteristic) {
    return {
      device: cachedBluetoothDevice,
      characteristic: cachedWriteCharacteristic,
      name: cachedBluetoothDevice.name || "POSIFLOW PSF588",
    };
  }

  try {
    toast.loading("Pairing with POSIFLOW PSF588...", { id: "bt-connect" });

    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: THERMAL_PRINTER_SERVICES,
    });

    const server = await device.gatt.connect();

    // Find writable GATT characteristic across known thermal printer services
    let writeChar = null;
    for (const serviceUuid of THERMAL_PRINTER_SERVICES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);
        const chars = await service.getCharacteristics();
        for (const char of chars) {
          if (char.properties.write || char.properties.writeWithoutResponse) {
            writeChar = char;
            break;
          }
        }
        if (writeChar) break;
      } catch (err) {
        // Continue searching
      }
    }

    // Fallback: search all primary services if specific service list didn't hit
    if (!writeChar) {
      const services = await server.getPrimaryServices();
      for (const service of services) {
        try {
          const chars = await service.getCharacteristics();
          for (const char of chars) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              writeChar = char;
              break;
            }
          }
          if (writeChar) break;
        } catch (e) {
          // continue
        }
      }
    }

    if (!writeChar) {
      throw new Error("Could not find printable characteristic on this Bluetooth device. Make sure POSIFLOW PSF588 is powered on.");
    }

    cachedBluetoothDevice = device;
    cachedWriteCharacteristic = writeChar;

    savePrinterConfig({
      mode: "bluetooth",
      bluetoothDeviceId: device.id,
      bluetoothDeviceName: device.name || "POSIFLOW PSF588",
    });

    toast.success(`Connected to ${device.name || "POSIFLOW PSF588"}!`, { id: "bt-connect" });
    return { device, characteristic: writeChar, name: device.name || "POSIFLOW PSF588" };
  } catch (err) {
    toast.dismiss("bt-connect");
    if (err.name === "NotFoundError" || err.message?.includes("cancelled")) {
      throw new Error("Bluetooth pairing cancelled.");
    }
    throw err;
  }
}

// Send binary ESC/POS data in chunks to prevent Bluetooth buffer overflow on POSIFLOW PSF588
export async function sendBluetoothEscPos(bytes) {
  let char = cachedWriteCharacteristic;
  let dev = cachedBluetoothDevice;

  if (!dev?.gatt?.connected || !char) {
    const res = await connectPosiflowBluetooth();
    char = res.characteristic;
    dev = res.device;
  }

  const CHUNK_SIZE = 80; // 80 bytes safe buffer for POSIFLOW 588 microcontroller
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.slice(i, i + CHUNK_SIZE);
    if (char.writeValueWithoutResponse) {
      await char.writeValueWithoutResponse(chunk);
    } else {
      await char.writeValue(chunk);
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

// =========================================================================
// 5. WEBSERIAL / USB DRIVER (FOR CABLE CONNECTION ON PC OR ANDROID OTG)
// =========================================================================
export function isSerialSupported() {
  return typeof navigator !== "undefined" && Boolean(navigator.serial);
}

export async function printViaSerial(bytes) {
  if (!isSerialSupported()) {
    throw new Error("Web Serial is not supported in this browser. Please use Chrome on desktop/laptop.");
  }
  toast.loading("Connecting to USB / Serial Printer...", { id: "usb-print" });
  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: 9600 });
    const writer = port.writable.getWriter();
    await writer.write(bytes);
    writer.releaseLock();
    await port.close();
    toast.success("Printed successfully via USB!", { id: "usb-print" });
    return true;
  } catch (e) {
    toast.dismiss("usb-print");
    if (e.name !== "NotFoundError") {
      throw e;
    }
    return false;
  }
}

// =========================================================================
// 6. IN-BROWSER 58mm HTML SYSTEM PRINT (ZERO MARGINS / MATCHES PHYSICAL LAYOUT)
// =========================================================================
export function printViaSystemHtml(rawReceipt, residentInfo = null) {
  const receipt = residentInfo
    ? {
        ...residentInfo,
        ...rawReceipt,
        plotNumber: rawReceipt.plotNumber || residentInfo.plotNumber || residentInfo.plot || "",
        floor: rawReceipt.floor || residentInfo.floor || "",
        floorCode: rawReceipt.floorCode || residentInfo.floorCode || "",
        unitNumber: rawReceipt.unitNumber || residentInfo.unitNumber || residentInfo.unit || "",
        personType: rawReceipt.personType || residentInfo.personType || residentInfo.occupantType || "",
        block: rawReceipt.block || residentInfo.block || "",
        flat: rawReceipt.flat || rawReceipt.flatNumber || residentInfo.flat || residentInfo.flatNumber || "",
      }
    : rawReceipt;

  const isSpecial = Boolean(
    receipt.collectionName ||
    receipt.type === "Special Collection" ||
    receipt.collectionType === "special"
  );

  const receiptNo = receipt.receiptNumber || receipt.receiptNo || receipt.paymentId || "RWA-" + Date.now();
  const residentName = receipt.residentName || receipt.contributorName || receipt.owner || receipt.name || "Resident";
  const flat = receipt.flat || receipt.flatNumber || "";
  const block = receipt.block || "";
  const plot = receipt.plotNumber || receipt.plot || "";
  const unit = receipt.unitNumber || receipt.unit || "";
  const floorStr = formatResidentFloor(receipt.floor);

  let displayPersonType = (receipt.personType || receipt.occupantType || "").trim();
  if (displayPersonType.toUpperCase() === "TENANT" || displayPersonType.toUpperCase() === "RENTED") {
    displayPersonType = "Rented";
  } else if (displayPersonType.toUpperCase() === "OWNER") {
    displayPersonType = "Owner";
  }

  const amount = Number(receipt.totalPaidAmount || receipt.paidAmount || receipt.amount || 0).toLocaleString("en-IN");
  const mode = receipt.paymentMethod || receipt.paymentMode || receipt.method || "Cash";
  const date = receipt.paymentDate || receipt.date || new Date().toLocaleDateString("en-IN");
  const time = receipt.paymentTime || receipt.time || "";
  const collector = receipt.collectorName || receipt.collector || "RWA Staff";
  const designation = receipt.collectorDesignation ? `(${receipt.collectorDesignation})` : (receipt.collectorRole ? `(${receipt.collectorRole})` : "");
  const remarks = receipt.remarks && receipt.remarks !== "-" ? receipt.remarks : "";

  const periodOrCampaign = isSpecial
    ? receipt.collectionName || receipt.specialCampaignName || "Special Campaign"
    : receipt.isAdvance && receipt.periodLabel
    ? receipt.periodLabel
    : `${receipt.month || ""} ${receipt.year || ""}`.trim() || "Monthly Garbage Fee";

  let propertyLine = "";
  if (plot) propertyLine += `Plot ${plot}`;
  if (floorStr && floorStr !== "—") propertyLine += (propertyLine ? `, ` : "") + floorStr;
  if (unit) propertyLine += (propertyLine ? `, ` : "") + `Flat ${unit}`;
  if (!propertyLine && flat) propertyLine = `Flat ${flat}`;

  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Receipt - ${receiptNo}</title>
        <style>
          @page {
            size: 58mm auto;
            margin: 0mm !important;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          html, body {
            width: 58mm;
            max-width: 58mm;
            margin: 0 auto;
            padding: 0;
            background: #fff;
            color: #000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
            font-size: 10px;
            line-height: 1.35;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .pos-receipt {
            width: 48mm;
            margin: 0 auto;
            padding: 2mm 0 4mm 0;
          }
          .center { text-align: center; }
          .title { font-size: 14px; font-weight: 900; letter-spacing: 0.5px; }
          .sub { font-size: 10px; font-weight: 700; margin-top: 1px; }
          .tag { font-size: 10px; font-weight: 700; margin-top: 1px; }
          .divider { border-top: 1px dashed #000; margin: 3px 0; }
          .row { display: flex; justify-content: space-between; margin-bottom: 2px; }
          .lbl { font-weight: 600; }
          .val { font-weight: 800; text-align: right; max-width: 65%; word-break: break-word; }
          .amount-val { font-size: 20px; font-weight: 900; margin: 4px 0; }
          .conf-title { font-size: 10.5px; font-weight: 900; margin-top: 3px; }
          .footer-msg { font-size: 9.5px; margin-top: 1px; }
        </style>
      </head>
      <body>
        <div class="pos-receipt">
          <div class="center">
            <div class="title">D BLOCK RWA</div>
            <div class="sub">Indraprastha Colony</div>
            <div class="tag">${isSpecial ? "[ SPECIAL RECEIPT ]" : "[ GARBAGE FEE RECEIPT ]"}</div>
          </div>
          <div class="divider"></div>
          <div class="row"><span class="lbl">Receipt No:</span><span class="val">${receiptNo}</span></div>
          <div class="row"><span class="lbl">Date & Time:</span><span class="val">${date}${time ? " " + time : ""}</span></div>
          <div class="divider"></div>
          <div class="row"><span class="lbl">Resident:</span><span class="val">${residentName}</span></div>
          ${block ? `<div class="row"><span class="lbl">Block:</span><span class="val">${block.toLowerCase().startsWith("block") ? block : `Block ${block}`}</span></div>` : ""}
          ${propertyLine ? `<div class="row"><span class="lbl">Property:</span><span class="val">${propertyLine}</span></div>` : ""}
          ${displayPersonType ? `<div class="row"><span class="lbl">Occupant:</span><span class="val">${displayPersonType}</span></div>` : ""}
          <div class="divider"></div>
          <div class="row"><span class="lbl">${isSpecial ? "Campaign:" : "Cycle:"}</span><span class="val">${periodOrCampaign}</span></div>
          <div class="row"><span class="lbl">Pay Mode:</span><span class="val">${mode}</span></div>
          <div class="row"><span class="lbl">Collector:</span><span class="val">${collector} ${designation}</span></div>
          ${remarks ? `<div class="row"><span class="lbl">Notes:</span><span class="val">${remarks}</span></div>` : ""}
          <div class="divider"></div>
          <div class="center amount-val">Rs. ${amount}</div>
          <div class="divider"></div>
          <div class="center conf-title">*** PAYMENT RECEIVED ***</div>
          <div style="height: 6px;"></div>
          <div class="center footer-msg">Thank you for supporting</div>
          <div class="center footer-msg">D Block RWA Indraprastha!</div>
          <div class="center footer-msg">Keep society clean & green.</div>
        </div>
      </body>
    </html>
  `);
  doc.close();

  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 2000);
  }, 250);
}

// =========================================================================
// 7. MASTER ENTRY POINT: DIRECT THERMAL PRINT (POSIFLOW PSF588)
// =========================================================================
export async function printThermalReceipt(rawReceipt, residentInfo = null, customConfig = null) {
  if (!rawReceipt) {
    toast.error("No receipt data to print.");
    return false;
  }

  const config = customConfig || getPrinterConfig();
  const escPosBytes = generateEscPosReceipt(rawReceipt, residentInfo);

  // Default: Direct Web Bluetooth (Zero external apps)
  if (config.mode === "bluetooth") {
    try {
      toast.loading("Sending to POSIFLOW PSF588 via Bluetooth...", { id: "direct-print" });
      await sendBluetoothEscPos(escPosBytes);
      toast.success("Receipt printed on POSIFLOW PSF588!", { id: "direct-print" });
      return true;
    } catch (err) {
      toast.dismiss("direct-print");
      console.warn("Bluetooth direct print failed:", err);
      if (err.message?.includes("cancelled")) {
        toast("Bluetooth pairing cancelled.", { icon: "ℹ️" });
        return false;
      }
      // Fallback directly inside webpage (no external apps)
      toast("Bluetooth unavailable. Printing via webpage 58mm preview...", { icon: "🖨️" });
      printViaSystemHtml(rawReceipt, residentInfo);
      return true;
    }
  }

  // USB / WebSerial
  if (config.mode === "usb") {
    try {
      return await printViaSerial(escPosBytes);
    } catch (err) {
      toast.error("USB Print error: " + err.message);
      return false;
    }
  }

  // In-browser 58mm system print
  printViaSystemHtml(rawReceipt, residentInfo);
  return true;
}

// Execute POSIFLOW Self-Test Print
export async function executePosiflowTestPrint() {
  const config = getPrinterConfig();
  const testBytes = generatePosiflowTestReceipt();

  if (config.mode === "bluetooth") {
    toast.loading("Printing test on POSIFLOW PSF588...", { id: "test-print" });
    try {
      await sendBluetoothEscPos(testBytes);
      toast.success("Test receipt printed on POSIFLOW PSF588!", { id: "test-print" });
      return true;
    } catch (err) {
      toast.dismiss("test-print");
      toast.error("Bluetooth test failed: " + err.message);
      return false;
    }
  }

  if (config.mode === "usb") {
    return await printViaSerial(testBytes);
  }

  printViaSystemHtml({
    receiptNumber: "TEST-PSF588",
    paymentDate: new Date().toLocaleDateString("en-IN"),
    residentName: "POSIFLOW Test Resident",
    flat: "PSF588",
    amount: "100",
    paymentMethod: "Bluetooth Test",
    collectorName: "System Self-Test",
  });
  return true;
}
