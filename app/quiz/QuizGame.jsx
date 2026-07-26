"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QUIZ_TOPICS, QUESTION_SECONDS, shuffleQuestions } from "@/lib/quizData";
import { loadCustomQuizzes, saveCustomQuiz, deleteCustomQuiz } from "@/lib/customQuiz";
import { submitQuizScore } from "./actions";
import QuizCreator from "./QuizCreator";

// 4 ô đáp án kiểu quiz.com: mỗi ô một màu + một ký hiệu cố định
const TILES = [
  { shape: "▲", bg: "#e74c3c", fg: "#ffffff" },
  { shape: "◆", bg: "#1e9bf0", fg: "#ffffff" },
  { shape: "●", bg: "#ffcf3a", fg: "#0a1a2f" },
  { shape: "■", bg: "#53e07a", fg: "#0a1a2f" },
];

const REVEAL_MS = 2600;
const CONFETTI_COLORS = ["#ffcf3a", "#ff6fa1", "#1e9bf0", "#53e07a", "#ff9a3c"];

export default function QuizGame({ username, supabaseReady, topScores }) {
  const router = useRouter();

  const [phase, setPhase] = useState("menu"); // menu | create | countdown | question | reveal | results
  const [topic, setTopic] = useState(null);
  const [customQuizzes, setCustomQuizzes] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(QUESTION_SECONDS);
  const [chosen, setChosen] = useState(null); // single: số/null · multi: mảng chỉ số
  const [selected, setSelected] = useState([]); // lựa chọn đang gõ cho câu nhiều đáp án
  const [lastCorrect, setLastCorrect] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [lastGain, setLastGain] = useState(0);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error

  const timerRef = useRef(null);
  const advanceRef = useRef(null);
  const audioRef = useRef(null);
  const savedRef = useRef(false);
  const selectedRef = useRef([]);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (advanceRef.current) clearTimeout(advanceRef.current);
    timerRef.current = null;
    advanceRef.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  // localStorage chỉ có ở client → nạp danh sách quiz tự tạo sau khi mount
  useEffect(() => {
    setCustomQuizzes(loadCustomQuizzes());
  }, []);

  function handleCreateSave(quiz) {
    setCustomQuizzes(saveCustomQuiz(quiz));
    startTopic(quiz);
  }
  function handleDeleteCustom(id) {
    setCustomQuizzes(deleteCustomQuiz(id));
  }

  // ---- Âm thanh: bíp nhẹ bằng WebAudio, không cần file ----
  const tone = useCallback((freq, duration, delay = 0, type = "sine", volume = 0.12) => {
    try {
      if (!audioRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioRef.current = new Ctx();
      }
      const ctx = audioRef.current;
      if (ctx.state === "suspended") ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      const t = ctx.currentTime + delay;
      gain.gain.setValueAtTime(volume, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + duration);
    } catch {
      // trình duyệt chặn audio thì bỏ qua, game vẫn chạy bình thường
    }
  }, []);

  const playCorrect = useCallback(() => {
    tone(660, 0.12);
    tone(880, 0.2, 0.12);
  }, [tone]);
  const playWrong = useCallback(() => tone(170, 0.35, 0, "square", 0.08), [tone]);
  const playTick = useCallback(() => tone(520, 0.06, 0, "sine", 0.06), [tone]);

  // ---- Luồng game ----
  const startTopic = useCallback(
    (t) => {
      clearTimers();
      setTopic(t);
      setQuestions(shuffleQuestions(t.questions));
      setQIndex(0);
      setScore(0);
      setStreak(0);
      setBestStreak(0);
      setCorrectCount(0);
      setSaveState("idle");
      savedRef.current = false;
      setCountdown(3);
      setPhase("countdown");
      playTick();
    },
    [clearTimers, playTick]
  );

  useEffect(() => {
    if (phase !== "countdown") return;
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          setPhase("question");
          return 0;
        }
        playTick();
        return c - 1;
      });
    }, 800);
    return () => clearInterval(id);
  }, [phase, playTick]);

  useEffect(() => {
    if (phase !== "question") return;
    setChosen(null);
    setSelected([]);
    selectedRef.current = [];
    setTimeLeft(QUESTION_SECONDS);
    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      const left = QUESTION_SECONDS - (Date.now() - startedAt) / 1000;
      if (left <= 0) {
        setTimeLeft(0);
        const q = questions[qIndex];
        answer(q?.multi ? selectedRef.current : null, 0);
      } else {
        setTimeLeft(left);
      }
    }, 100);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qIndex]);

  function answer(choice, leftOverride) {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;

    const left = leftOverride ?? timeLeft;
    const q = questions[qIndex];

    let isCorrect;
    let chosenValue;
    if (q.multi) {
      // câu nhiều đáp án: đúng khi chọn CHÍNH XÁC tập đáp án đúng (không thiếu, không thừa)
      const picked = [...(Array.isArray(choice) ? choice : [])].sort((a, b) => a - b);
      const correct = [...q.correct].sort((a, b) => a - b);
      isCorrect =
        picked.length === correct.length && picked.every((v, idx) => v === correct[idx]);
      chosenValue = picked;
    } else {
      isCorrect = choice !== null && choice === q.correct;
      chosenValue = choice;
    }

    let gain = 0;
    if (isCorrect) {
      const newStreak = streak + 1;
      // Điểm kiểu quiz.com: trả lời càng nhanh càng cao (500–1000),
      // cộng thưởng chuỗi đúng liên tiếp (tối đa +300)
      gain = Math.round(500 + 500 * (left / QUESTION_SECONDS)) + 50 * Math.min(newStreak - 1, 6);
      setScore((s) => s + gain);
      setStreak(newStreak);
      setBestStreak((b) => Math.max(b, newStreak));
      setCorrectCount((c) => c + 1);
      playCorrect();
    } else {
      setStreak(0);
      playWrong();
    }

    setChosen(chosenValue);
    setLastCorrect(isCorrect);
    setLastGain(gain);
    setPhase("reveal");

    advanceRef.current = setTimeout(() => {
      if (qIndex + 1 < questions.length) {
        setQIndex((i) => i + 1);
        setPhase("question");
      } else {
        setPhase("results");
      }
    }, REVEAL_MS);
  }

  function toggleSelect(i) {
    setSelected((prev) => (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]));
  }

  // Lưu điểm 1 lần khi vào màn kết quả (nếu đã đăng nhập)
  useEffect(() => {
    if (phase !== "results" || savedRef.current) return;
    if (!supabaseReady || !username || topic?.isCustom) return;
    savedRef.current = true;
    setSaveState("saving");
    submitQuizScore({
      topicId: topic.id,
      score,
      correctCount,
      questionCount: questions.length,
    }).then((res) => {
      if (res?.error) {
        setSaveState("error");
      } else {
        setSaveState("saved");
        router.refresh();
      }
    });
  }, [phase, supabaseReady, username, topic, score, correctCount, questions.length, router]);

  // ================= RENDER =================

  if (phase === "create") {
    return <QuizCreator onSave={handleCreateSave} onCancel={() => setPhase("menu")} />;
  }

  if (phase === "menu") {
    return (
      <div>
        <Link
          href="/quiz/room"
          className="flex items-center justify-between gap-4 bg-gradient-to-r from-axis-blue/30 to-axis-pink/30 border border-white/15 rounded-2xl p-5 mb-8 hover:border-axis-yellow transition group"
        >
          <div>
            <h2 className="font-display font-extrabold text-xl mb-1 group-hover:text-axis-yellow transition">
              👥 Chơi nhiều người (tới 100 người)
            </h2>
            <p className="text-white/60 text-sm">
              Tạo phòng, chia mã, chủ phòng bấm bắt đầu — mọi người cùng thi một lúc.
            </p>
          </div>
          <span className="font-display font-extrabold text-2xl text-axis-yellow shrink-0">→</span>
        </Link>

        <h2 className="font-display font-extrabold text-lg mb-4">Chủ đề có sẵn</h2>
        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          {QUIZ_TOPICS.map((t) => (
            <button
              key={t.id}
              onClick={() => startTopic(t)}
              className="text-left bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-axis-yellow hover:-translate-y-1 transition group"
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3"
                style={{ backgroundColor: `${t.color}33` }}
              >
                {t.emoji}
              </div>
              <h3 className="font-display font-extrabold text-lg mb-1 group-hover:text-axis-yellow transition">
                {t.name}
              </h3>
              <p className="text-white/60 text-sm mb-3">{t.description}</p>
              <span className="text-xs font-extrabold text-white/40">
                {t.questions.length} câu hỏi · {QUESTION_SECONDS}s/câu
              </span>
            </button>
          ))}
        </div>

        {/* Quiz tự tạo */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-extrabold text-lg">Quiz của bạn</h2>
          <button
            onClick={() => setPhase("create")}
            className="bg-axis-yellow text-axis-navy font-extrabold text-sm px-4 py-1.5 rounded-full hover:scale-105 transition"
          >
            + Tạo quiz mới
          </button>
        </div>

        {customQuizzes.length > 0 ? (
          <div className="grid sm:grid-cols-3 gap-4 mb-12">
            {customQuizzes.map((t) => (
              <div
                key={t.id}
                className="relative bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-axis-yellow hover:-translate-y-1 transition group"
              >
                <button
                  onClick={() => handleDeleteCustom(t.id)}
                  title="Xóa bộ quiz này"
                  className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-white/10 hover:bg-red-500/80 text-white/70 hover:text-white text-sm transition"
                >
                  ✕
                </button>
                <button onClick={() => startTopic(t)} className="text-left w-full">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-3"
                    style={{ backgroundColor: `${t.color}33` }}
                  >
                    {t.emoji}
                  </div>
                  <h3 className="font-display font-extrabold text-lg mb-1 pr-6 group-hover:text-axis-yellow transition">
                    {t.name}
                  </h3>
                  <span className="inline-block text-[10px] font-extrabold bg-white/10 text-white/60 px-2 py-0.5 rounded-full mb-2">
                    TỰ TẠO
                  </span>
                  <p className="text-xs font-extrabold text-white/40">
                    {t.questions.length} câu hỏi · {QUESTION_SECONDS}s/câu
                  </p>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <button
            onClick={() => setPhase("create")}
            className="w-full border-2 border-dashed border-white/20 rounded-2xl py-8 mb-12 font-bold text-white/50 hover:border-axis-yellow hover:text-axis-yellow transition"
          >
            Chưa có bộ quiz nào — bấm để tự tạo câu hỏi của riêng bạn ✏️
          </button>
        )}

        <QuizLeaderboard topScores={topScores} supabaseReady={supabaseReady} />
      </div>
    );
  }

  if (phase === "countdown") {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-white/60 font-bold mb-6">
          {topic.emoji} {topic.name}
        </p>
        <div
          key={countdown}
          className="quiz-pop font-display font-extrabold text-8xl text-axis-yellow"
        >
          {countdown === 0 ? "GO!" : countdown}
        </div>
      </div>
    );
  }

  if (phase === "question" || phase === "reveal") {
    const q = questions[qIndex];
    const pct = (timeLeft / QUESTION_SECONDS) * 100;
    const timerColor = pct > 50 ? "#53e07a" : pct > 25 ? "#ffcf3a" : "#e74c3c";
    const revealing = phase === "reveal";
    const isMulti = !!q.multi;
    const nothingChosen = isMulti
      ? !Array.isArray(chosen) || chosen.length === 0
      : chosen === null;

    return (
      <div>
        {/* Thanh trạng thái trên cùng */}
        <div className="flex items-center justify-between mb-3 text-sm font-extrabold">
          <span className="text-white/60">
            Câu {qIndex + 1}/{questions.length}
          </span>
          <span className="flex items-center gap-3">
            {streak >= 2 && (
              <span className="text-axis-yellow quiz-pop" key={streak}>
                🔥 chuỗi {streak}
              </span>
            )}
            <span className="bg-white/10 rounded-full px-4 py-1">{score.toLocaleString("vi")} điểm</span>
          </span>
        </div>

        {/* Thanh đếm giờ */}
        <div className="h-2.5 bg-white/10 rounded-full overflow-hidden mb-6">
          <div
            className="h-full rounded-full transition-[width] duration-100 ease-linear"
            style={{ width: `${revealing ? 0 : pct}%`, backgroundColor: timerColor }}
          />
        </div>

        {/* Câu hỏi */}
        <div
          key={`q-${qIndex}`}
          className="quiz-fade-in bg-white/5 border border-white/10 rounded-2xl px-6 py-8 text-center mb-6 relative"
        >
          <h2 className="font-display font-extrabold text-xl sm:text-2xl leading-snug">{q.text}</h2>
          {isMulti && (
            <p className="text-white/50 text-xs font-bold mt-2">Chọn tất cả đáp án đúng</p>
          )}
          {!revealing && (
            <span
              className="absolute top-3 right-4 font-display font-extrabold text-lg"
              style={{ color: timerColor }}
            >
              {Math.ceil(timeLeft)}s
            </span>
          )}
        </div>

        {/* Banner kết quả câu vừa rồi */}
        {revealing && (
          <div className="text-center mb-4 quiz-pop">
            {lastCorrect ? (
              <span className="font-display font-extrabold text-2xl text-axis-yellow">
                ✓ Chính xác! +{lastGain.toLocaleString("vi")} điểm
              </span>
            ) : nothingChosen ? (
              <span className="font-display font-extrabold text-2xl text-red-400">⏰ Hết giờ!</span>
            ) : (
              <span className="font-display font-extrabold text-2xl text-red-400">✗ Chưa đúng!</span>
            )}
          </div>
        )}

        {/* Ô đáp án */}
        <div key={`a-${qIndex}`} className="quiz-fade-in grid sm:grid-cols-2 gap-3">
          {q.answers.map((ans, i) => {
            const tile = TILES[i];
            const isCorrect = isMulti ? q.correct.includes(i) : i === q.correct;
            const isChosen = isMulti
              ? Array.isArray(chosen) && chosen.includes(i)
              : i === chosen;
            const isPicked = isMulti && selected.includes(i);
            let extra = "";
            if (revealing) {
              if (isCorrect) extra = "ring-4 ring-white scale-[1.02]";
              else if (isChosen) extra = "opacity-60 quiz-shake";
              else extra = "opacity-30";
            } else if (isPicked) {
              extra = "ring-4 ring-white scale-[1.02]";
            } else {
              extra = "hover:scale-[1.02] active:scale-95";
            }
            return (
              <button
                key={`${qIndex}-${i}`}
                disabled={revealing}
                onClick={() => (isMulti ? toggleSelect(i) : answer(i))}
                className={`flex items-center gap-4 rounded-2xl px-5 py-5 sm:py-6 font-extrabold text-left text-base sm:text-lg transition ${extra}`}
                style={{ backgroundColor: tile.bg, color: tile.fg }}
              >
                <span className="text-2xl shrink-0">{tile.shape}</span>
                <span>{ans}</span>
                {revealing && isCorrect && <span className="ml-auto text-2xl">✓</span>}
                {!revealing && isPicked && <span className="ml-auto text-xl">✓</span>}
              </button>
            );
          })}
        </div>

        {/* Nút xác nhận cho câu nhiều đáp án */}
        {isMulti && !revealing && (
          <div className="text-center mt-5">
            <button
              onClick={() => answer(selected)}
              disabled={selected.length === 0}
              className="bg-axis-yellow text-axis-navy font-extrabold px-8 py-2.5 rounded-full hover:scale-105 transition disabled:opacity-40"
            >
              Xác nhận ({selected.length})
            </button>
          </div>
        )}
      </div>
    );
  }

  // phase === "results"
  const accuracy = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  return (
    <div className="relative text-center py-8">
      {/* Confetti */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-visible" aria-hidden>
        {Array.from({ length: 24 }).map((_, i) => (
          <span
            key={i}
            className="confetti-piece absolute w-2.5 h-2.5 rounded-sm"
            style={{
              left: `${(i * 41) % 100}%`,
              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animationDelay: `${(i % 8) * 0.18}s`,
            }}
          />
        ))}
      </div>

      <p className="text-white/60 font-bold mb-2">
        {topic.emoji} {topic.name}
      </p>
      <h2 className="font-display font-extrabold text-3xl mb-6">
        {accuracy >= 80 ? "🏆 Xuất sắc!" : accuracy >= 50 ? "🎉 Làm tốt lắm!" : "💪 Cố lên lần sau!"}
      </h2>

      <div className="inline-block bg-white/5 border border-white/10 rounded-3xl px-10 py-8 mb-6">
        <p className="font-display font-extrabold text-5xl text-axis-yellow mb-2">
          {score.toLocaleString("vi")}
        </p>
        <p className="text-white/60 font-bold text-sm">điểm</p>
      </div>

      <div className="flex items-center justify-center gap-6 text-sm font-bold text-white/70 mb-8">
        <span>
          ✓ Đúng {correctCount}/{questions.length} ({accuracy}%)
        </span>
        <span>🔥 Chuỗi tốt nhất: {bestStreak}</span>
      </div>

      <div className="mb-10 text-sm font-bold">
        {topic.isCustom ? (
          <span className="text-white/40">Quiz tự tạo — điểm không tính vào bảng xếp hạng.</span>
        ) : !supabaseReady ? (
          <span className="text-white/40">Chưa cấu hình Supabase — điểm không được lưu.</span>
        ) : !username ? (
          <span className="text-white/60">
            <a href="/login" className="text-axis-yellow underline">
              Đăng nhập
            </a>{" "}
            để lưu điểm lên bảng xếp hạng.
          </span>
        ) : saveState === "saving" ? (
          <span className="text-white/60">Đang lưu điểm...</span>
        ) : saveState === "saved" ? (
          <span className="text-axis-yellow">✓ Đã lưu điểm cho {username}</span>
        ) : saveState === "error" ? (
          <span className="text-red-400">Không lưu được điểm, thử lại sau nhé.</span>
        ) : null}
      </div>

      <div className="flex items-center justify-center gap-3 mb-12">
        <button
          onClick={() => startTopic(topic)}
          className="bg-axis-yellow text-axis-navy font-extrabold px-6 py-2.5 rounded-full hover:scale-105 transition"
        >
          Chơi lại
        </button>
        <button
          onClick={() => {
            clearTimers();
            setPhase("menu");
          }}
          className="bg-white/10 font-extrabold px-6 py-2.5 rounded-full hover:bg-white/20 transition"
        >
          Chủ đề khác
        </button>
      </div>

      <QuizLeaderboard topScores={topScores} supabaseReady={supabaseReady} />
    </div>
  );
}

function QuizLeaderboard({ topScores, supabaseReady }) {
  if (!supabaseReady) return null;
  return (
    <section className="text-left">
      <h2 className="font-display font-extrabold text-lg mb-4">🏅 Top cao thủ Quiz</h2>
      {topScores && topScores.length > 0 ? (
        <ol className="space-y-2">
          {topScores.map((row, i) => (
            <li
              key={`${row.username}-${i}`}
              className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-4 py-3"
            >
              <span className="flex items-center gap-3">
                <span className="font-display font-extrabold text-axis-yellow w-8">#{i + 1}</span>
                <span className="font-bold">{row.username}</span>
                <span className="text-white/50 text-xs hidden sm:inline">
                  {row.topicName} · đúng {row.correct_count}/{row.question_count}
                </span>
              </span>
              <span className="text-axis-yellow font-extrabold">
                {row.score.toLocaleString("vi")}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-white/60 text-sm">Chưa có ai chơi — hãy là người đầu tiên!</p>
      )}
    </section>
  );
}
