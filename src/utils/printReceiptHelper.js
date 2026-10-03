// =========================================================================
// RWA Official Receipt Direct Print Dispatcher
// 100% IN-WEBPAGE THERMAL PRINTING FOR POSIFLOW PSF588 & 58MM PRINTERS
// Zero external apps needed (no RawBT, no third-party spoolers)
// =========================================================================

import {
  printThermalReceipt,
  printViaSystemHtml,
  getPrinterConfig,
  savePrinterConfig,
  executePosiflowTestPrint,
  connectPosiflowBluetooth,
  generateEscPosReceipt,
} from "./posiflowPrinterService";

/**
 * Universal print handler for all payment receipts across Admin, Collector, and Resident portals.
 * Directly sends commands via Web Bluetooth to POSIFLOW PSF588 or falls back to in-webpage 58mm layout.
 *
 * @param {Object} rawReceipt - Raw receipt payment data
 * @param {Object} residentInfo - Optional resident info to enrich data
 * @param {Object} customOptions - Optional printer overrides
 */
export function printPaymentReceipt(rawReceipt, residentInfo = null, customOptions = {}) {
  if (!rawReceipt) return;

  const config = getPrinterConfig();
  const mergedConfig = { ...config, ...customOptions };

  // If user configured system HTML print
  if (mergedConfig.mode === "system") {
    printViaSystemHtml(rawReceipt, residentInfo);
    return;
  }

  // Default: Direct Web Bluetooth to POSIFLOW PSF588 (zero apps)
  printThermalReceipt(rawReceipt, residentInfo, mergedConfig);
}

export {
  printThermalReceipt,
  printViaSystemHtml,
  getPrinterConfig,
  savePrinterConfig,
  executePosiflowTestPrint,
  connectPosiflowBluetooth,
  generateEscPosReceipt,
};
