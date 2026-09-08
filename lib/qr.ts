import QRCode from "qrcode";

export async function generateQrDataUrl(url: string) {
  return QRCode.toDataURL(url, { margin: 1, width: 320 });
}
