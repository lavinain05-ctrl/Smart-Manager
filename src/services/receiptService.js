import { generateReceipt } from "../utils/receiptGenerator";

export function downloadReceipt(payment) {
  generateReceipt(payment);
}