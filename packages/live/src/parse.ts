// Screenshot filename → position/heading. EFT names screenshots
//   YYYY-MM-DD[HH-MM]_x, y, z_qx, qy, qz, qw[_fov] (n).png
// so the player's location is available without OCR or any network call.
// Regexes and yaw math ported from the-hideout/TarkovMonitor (MIT),
// TarkovMonitor/GameWatcher.cs.

export interface LiveFix {
  position: { x: number; y: number; z: number };
  /** heading in degrees (Unity Y-up yaw) */
  yawDeg: number;
  /** "YYYY-MM-DD[HH-MM]" from the filename, null if absent */
  takenAt: string | null;
  /** the filename that produced this fix */
  raw: string;
}

const FILENAME_RE = /(?<taken>\d{4}-\d{2}-\d{2}\[\d{2}-\d{2}\])_?(?<position>.+) \(\d+\)\.png/;
const POSITION_RE =
  /(?<x>-?\d+\.\d{2}), (?<y>-?\d+\.\d{2}), (?<z>-?\d+\.\d{2})_?(?<rx>-?[\d.]\.\d{1,5}), (?<ry>-?[\d.]\.\d{1,5}), (?<rz>-?[\d.]\.\d{1,5}), (?<rw>-?[\d.]\.\d{1,5})/;

function quaternionToYawDeg(qx: number, qy: number, qz: number, qw: number): number {
  // Unity Y-up yaw: atan2(2(qw·qy + qx·qz), 1 − 2(qy² + qz²))
  const sinyCosp = 2 * (qw * qy + qx * qz);
  const cosyCosp = 1 - 2 * (qy * qy + qz * qz);
  return (Math.atan2(sinyCosp, cosyCosp) * 180) / Math.PI;
}

export function parseScreenshotName(filename: string): LiveFix | null {
  const nameMatch = FILENAME_RE.exec(filename);
  if (!nameMatch?.groups) return null;
  const posMatch = POSITION_RE.exec(nameMatch.groups.position);
  if (!posMatch?.groups) return null;
  const g = posMatch.groups;
  return {
    position: { x: Number(g.x), y: Number(g.y), z: Number(g.z) },
    yawDeg: quaternionToYawDeg(Number(g.rx), Number(g.ry), Number(g.rz), Number(g.rw)),
    takenAt: nameMatch.groups.taken ?? null,
    raw: filename,
  };
}

export function isScreenshotName(filename: string): boolean {
  return parseScreenshotName(filename) !== null;
}
