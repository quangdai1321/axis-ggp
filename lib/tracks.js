// 2D top-down circuit layouts for the race replay map. viewBox is sized
// generously (1400x800) so up to 50 lane-spread car markers stay readable.
// Checkpoints/start point are derived at render time from the live SVG
// path (getPointAtLength), so only the `d` string needs to be authored.

export const TRACKS = [
  {
    id: "gp-circuit",
    name: "AXIS GP Circuit",
    description: "Đường đua chính, nhiều khúc cua S liên tiếp.",
    viewBox: "0 0 1400 800",
    d: "M224,658 C154,644 126,560 182,504 C266,420 350,448 364,364 C375,280 308,238 350,168 C392,95 504,84 574,133 C644,182 616,266 672,308 C728,350 812,294 882,266 C980,227 1092,245 1148,315 C1204,385 1176,462 1106,490 C1036,518 980,476 910,497 C826,521 812,588 742,623 C644,672 532,658 448,651 C364,644 294,669 224,658 Z",
    center: { x: 542, y: 457 },
    logoRadius: 130,
  },
  {
    id: "cloud-oval",
    name: "Cloud Oval",
    description: "Đường vòng bầu dục rộng, tốc độ cao, dễ theo dõi.",
    viewBox: "0 0 1400 800",
    d: "M450,150 H950 A250,250 0 0 1 1200,400 A250,250 0 0 1 950,650 H450 A250,250 0 0 1 200,400 A250,250 0 0 1 450,150 Z",
    center: { x: 700, y: 400 },
    logoRadius: 150,
  },
  {
    id: "serpent-loop",
    name: "Serpent Loop",
    description: "Nhiều khúc cua gắt, thử thách kỹ thuật.",
    viewBox: "0 0 1400 800",
    d: "M200,700 C120,650 100,550 180,500 C260,450 340,480 360,400 C380,320 300,280 340,200 C380,120 480,100 560,150 C640,200 600,280 680,320 C760,360 820,280 900,250 C1000,210 1120,230 1180,320 C1240,410 1200,500 1120,520 C1040,540 1000,480 920,500 C840,520 820,600 740,630 C660,660 580,600 500,620 C420,640 340,680 200,700 Z",
    center: { x: 537, y: 435 },
    logoRadius: 110,
  },
];

export const DEFAULT_TRACK_ID = TRACKS[0].id;

export function getTrackById(id) {
  return TRACKS.find((t) => t.id === id) ?? TRACKS[0];
}
