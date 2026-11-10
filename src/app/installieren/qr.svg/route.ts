import QRCode from "qrcode";
import { appUrl } from "@/lib/auth";

// QR-Code als SVG (druckbar, beliebig skalierbar), z. B. für Aushang, Flyer oder Website
export async function GET() {
  const svg = await QRCode.toString(`${appUrl()}/installieren`, { type: "svg", margin: 2, width: 512, color: { dark: "#0B4F2A", light: "#FFFFFF" } });
  return new Response(svg, { headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=3600" } });
}
