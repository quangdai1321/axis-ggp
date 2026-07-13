import RaceDemo from "../components/RaceDemo";

const gadgets = [
  { name: "Air Cannon", type: "Tấn công", emoji: "💨", desc: "Đại bác không khí đẩy văng đối thủ." },
  { name: "Freeze Ray", type: "Tấn công", emoji: "❄️", desc: "Đóng băng xe địch trong giây lát." },
  { name: "Time Cloak", type: "Phòng thủ", emoji: "🧣", desc: "Miễn nhiễm sát thương trong thời gian ngắn." },
  { name: "Translation Bread", type: "Phòng thủ", emoji: "🍞", desc: "Giải mọi hiệu ứng xấu đang dính." },
  { name: "Bamboo Copter", type: "Tốc độ", emoji: "🚁", desc: "Bay lên, né chướng ngại và lối tắt trên không." },
  { name: "Rocket Shoes", type: "Tốc độ", emoji: "👟", desc: "Boost tốc độ tức thời." },
];

const modes = [
  "Classic Race", "Ranked Race", "Battle Race", "Time Trial",
  "Team Race", "Tournament", "Survival Race", "Knockout Race",
  "Boss Race", "Mirror Mode", "Random Gadget Mode",
];

const ranks = [
  "Bronze", "Silver", "Gold", "Platinum", "Diamond",
  "Master", "Grand Master", "Axis Master", "Legend", "Axis Champion",
];

const maps = [
  { name: "Nobita Town", desc: "Nhà Nobita, công viên, trường học, cửa hàng.", color: "from-green-400 to-emerald-600" },
  { name: "Cloud Kingdom", desc: "Thành phố trên mây, cầu mây, đảo bay.", color: "from-sky-300 to-blue-500" },
  { name: "Dinosaur Valley", desc: "Núi lửa, khủng long, rừng nguyên thủy.", color: "from-orange-400 to-red-600" },
  { name: "Future Tokyo", desc: "Thành phố tương lai, xe bay, robot.", color: "from-fuchsia-400 to-purple-600" },
  { name: "Underwater Kingdom", desc: "Hầm dưới biển, cá voi, thành phố Atlantis.", color: "from-cyan-300 to-teal-600" },
];

function Section({ id, eyebrow, title, children, className = "" }) {
  return (
    <section id={id} className={`max-w-6xl mx-auto px-5 sm:px-8 py-16 sm:py-24 ${className}`}>
      {eyebrow && (
        <p className="text-axis-yellow font-extrabold tracking-widest text-xs sm:text-sm uppercase mb-2">
          {eyebrow}
        </p>
      )}
      {title && (
        <h2 className="font-display text-3xl sm:text-4xl font-extrabold mb-8 sm:mb-10">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

export default function Home() {
  return (
    <main>
      {/* HERO */}
      <header className="relative overflow-hidden bg-gradient-to-b from-axis-blue via-sky-500 to-axis-navy">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white,transparent_35%),radial-gradient(circle_at_80%_60%,white,transparent_30%)]" />
        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 pt-14 pb-20 sm:pt-20 sm:pb-28 text-center">
          <p className="text-axis-yellow font-extrabold tracking-widest text-xs sm:text-sm uppercase mb-4">
            Đại Hội Đua Xe Bảo Bối
          </p>
          <h1 className="font-display text-4xl sm:text-6xl font-extrabold leading-tight mb-6">
            AXIS: Gadget Grand Prix
          </h1>
          <p className="max-w-2xl mx-auto text-base sm:text-lg text-white/90 mb-10">
            50 tay đua thực chiến trong một vũ trụ vô tận nơi mọi đường đua
            Doraemon cùng tồn tại. Chế tạo xe từ bảo bối, nhặt Miracle Bag,
            và trở thành Axis Champion.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="#demo"
              className="bg-axis-yellow text-axis-navy font-extrabold px-6 py-3 rounded-full hover:scale-105 transition"
            >
              🎮 Trải nghiệm demo ngay
            </a>
            <a
              href="#gadget"
              className="bg-white/10 border border-white/40 font-extrabold px-6 py-3 rounded-full hover:bg-white/20 transition"
            >
              Khám phá bảo bối
            </a>
            <a
              href="/lobby"
              className="bg-white/10 border border-white/40 font-extrabold px-6 py-3 rounded-full hover:bg-white/20 transition"
            >
              🏆 Vào giải đấu (chọn xe, đua tự động)
            </a>
          </div>
        </div>
      </header>

      {/* LORE */}
      <Section eyebrow="Cốt truyện" title="Không gian AXIS ra đời như thế nào?">
        <p className="text-white/80 leading-relaxed max-w-3xl">
          Doraemon vô tình phát hiện bảo bối cổ đại{" "}
          <strong className="text-axis-yellow">Axis Creator Box</strong>. Kết
          hợp cùng <strong className="text-axis-yellow">Track Seed</strong>,
          cậu tạo ra một không gian vô hạn mang tên{" "}
          <strong className="text-axis-blue">AXIS</strong> — nơi mọi đường
          đua nổi tiếng trong thế giới Doraemon đều có thể tồn tại cùng lúc.
          Để tìm ra tay đua mạnh nhất, Doraemon mở giải đấu{" "}
          <strong>Gadget Grand Prix</strong>, triệu hồi 50 người chơi trên
          toàn thế giới tới AXIS để tự chế tạo xe đua từ bảo bối và tranh
          ngôi vị <strong className="text-axis-yellow">Axis Champion</strong>.
        </p>
      </Section>

      {/* DEMO */}
      <Section id="demo" eyebrow="Chơi thử" title="Mini Demo — Vòng đua thử nghiệm">
        <p className="text-white/70 mb-6 max-w-2xl">
          Bản demo nhẹ chạy thẳng trên trình duyệt (Three.js), minh hoạ cảm
          giác lái, nhặt Miracle Bag và dùng bảo bối. Dùng phím{" "}
          <kbd className="px-1.5 py-0.5 bg-white/10 rounded">↑ ↓ ← →</kbd> hoặc{" "}
          <kbd className="px-1.5 py-0.5 bg-white/10 rounded">W A S D</kbd>{" "}
          để lái, <kbd className="px-1.5 py-0.5 bg-white/10 rounded">Space</kbd>{" "}
          để dùng bảo bối vừa nhặt.
        </p>
        <RaceDemo />
      </Section>

      {/* GAMEPLAY FLOW */}
      <Section eyebrow="Gameplay" title="Match Flow">
        <div className="flex flex-wrap gap-3 items-center text-sm sm:text-base font-bold">
          {["Lobby", "Matchmaking", "Loading", "Countdown", "Race", "Final Lap", "Finish", "Reward", "Leaderboard"].map(
            (step, i, arr) => (
              <div key={step} className="flex items-center gap-3">
                <span className="px-4 py-2 rounded-full bg-white/10 border border-white/20">
                  {step}
                </span>
                {i < arr.length - 1 && <span className="text-axis-yellow">→</span>}
              </div>
            )
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-10">
          {[
            ["50", "Người chơi thực / trận"],
            ["8–15", "Phút mỗi trận"],
            ["2–4", "Vòng đua (hoặc checkpoint)"],
            ["Realtime", "Bảng xếp hạng trực tiếp"],
          ].map(([big, label]) => (
            <div key={label} className="bg-white/5 rounded-2xl p-5 text-center border border-white/10">
              <div className="font-display text-2xl sm:text-3xl font-extrabold text-axis-yellow">{big}</div>
              <div className="text-xs sm:text-sm text-white/70 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* MAPS */}
      <Section eyebrow="Đường đua" title="Thế giới AXIS">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {maps.map((m) => (
            <div key={m.name} className="rounded-2xl overflow-hidden border border-white/10 bg-white/5">
              <div className={`h-24 bg-gradient-to-br ${m.color}`} />
              <div className="p-4">
                <h3 className="font-display font-extrabold text-lg mb-1">{m.name}</h3>
                <p className="text-white/70 text-sm">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* GADGETS */}
      <Section id="gadget" eyebrow="Hệ thống bảo bối" title="Miracle Bag — Túi Thần Kỳ">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {gadgets.map((g) => (
            <div key={g.name} className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="text-3xl mb-2">{g.emoji}</div>
              <h3 className="font-display font-extrabold">{g.name}</h3>
              <p className="text-xs uppercase tracking-wide text-axis-yellow font-bold mb-2">{g.type}</p>
              <p className="text-white/70 text-sm">{g.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* MODES */}
      <Section eyebrow="Chế độ chơi" title="Game Modes">
        <div className="flex flex-wrap gap-3">
          {modes.map((m) => (
            <span key={m} className="px-4 py-2 rounded-full bg-axis-blue/20 border border-axis-blue/40 text-sm font-bold">
              {m}
            </span>
          ))}
        </div>
      </Section>

      {/* RANK */}
      <Section eyebrow="Tiến trình" title="Rank System">
        <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
          {ranks.map((r, i, arr) => (
            <div key={r} className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-full bg-white/10 border border-white/20">{r}</span>
              {i < arr.length - 1 && <span className="text-axis-yellow">›</span>}
            </div>
          ))}
        </div>
      </Section>

      {/* MONETIZATION */}
      <Section eyebrow="Cam kết" title="Fair Play">
        <div className="bg-white/5 border border-axis-blue/30 rounded-2xl p-6 max-w-2xl">
          <p className="text-white/80">
            Battle Pass, skin xe, trang phục, hiệu ứng — tất cả đều là{" "}
            <strong>cosmetic</strong>.{" "}
            <span className="text-axis-yellow font-extrabold">
              Không bán vật phẩm tăng sức mạnh (No Pay-to-Win).
            </span>
          </p>
        </div>
      </Section>

      <footer className="border-t border-white/10 py-10 text-center text-white/50 text-sm">
        AXIS: Gadget Grand Prix — Fan concept design doc, lấy cảm hứng từ thế giới Doraemon.
      </footer>
    </main>
  );
}
