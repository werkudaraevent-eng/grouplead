import QRCode from "qrcode"

/**
 * A QR code as inline SVG, for the wall.
 *
 * No width or height on the element, so the tile that holds it decides the
 * size in `em` like everything else on the board. Error correction M: the
 * code is scanned from a metre away on a bright screen, not printed and
 * scuffed. Margin 0 because the white tile around it is the quiet zone.
 */
export async function renderQrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", errorCorrectionLevel: "M", margin: 0 })
}
