"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { loadCustomQuizzes } from "@/lib/customQuiz";
import { createRoom, advanceRoom, closeRoom } from "./actions";

// Mỗi câu trong phòng nhiều người: 10 giây, hết 10s mới đồng loạt hiện đúng/sai.
// (Phải khớp với hằng v_qsec trong hàm submit_quiz_room_answer ở schema.sql.)
const QUESTION_SECONDS = 10;

const TILES = [
  { shape: "▲", bg: "#e74c3c", fg: "#fff" },
  { shape: "◆", bg: "#1e9bf0", fg: "#fff" },
  { shape: "●", bg: "#ffcf3a", fg: "#0a1a2f" },
  { shape: "■", bg: "#53e07a", fg: "#0a1a2f" },
];

const ROOM_COLS =
  "id, code, host_id, topic_id, topic_name, questions, status, current_index, question_started_at";
const STORE_KEY = "axis_quiz_room_membership";

function loadMembership() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveMembership(m) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}
function clearMembership() {
  try {
    window.localStorage.removeItem(STORE_KEY);
  } catch {
    /* ignore */
  }
}

export default function RoomClient({ username, userId, supabaseReady, topics }) {
  const [room, setRoom] = useState(null);
  const [membership, setMembership] = useState(null); // { code, roomId, playerId, token, nickname } — chỉ người chơi
  const [isHost, setIsHost] = useState(false);

  const [players, setPlayers] = useState([]);
  const [answeredCount, setAnsweredCount] = useState(0);

  const [joinCode, setJoinCode] = useState("");
  const [joinNickname, setJoinNickname] = useState(username || "");
  const [joinError, setJoinError] = useState("");
  const [createError, setCreateError] = useState("");
  const [busy, setBusy] = useState(false);

  const [selectedTopic, setSelectedTopic] = useState(topics[0]?.id ?? "");
  const [customQuizzes, setCustomQuizzes] = useState([]);

  // đồng hồ đếm ngược cục bộ, gắn với ĐÚNG chỉ số câu đang mở để tránh
  // tính nhầm "đã hết giờ" ở render đầu tiên của mỗi câu (gây tự nộp trống)
  const [timer, setTimer] = useState({ index: -1, startedAt: 0 });
  const [nowTs, setNowTs] = useState(() => Date.now());
  const [myAnswer, setMyAnswer] = useState(null); // { answerIndex, gained, isCorrect, correctIndex }
  const submittedRef = useRef(false);
  const revealDoneRef = useRef(-1);

  const supabaseRef = useRef(null);
  const getSupabase = useCallback(() => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  }, []);

  // nạp bộ quiz tự tạo (localStorage) để chủ phòng chọn dùng cho phòng
  useEffect(() => {
    setCustomQuizzes(loadCustomQuizzes());
  }, []);

  const fetchRoom = useCallback(
    async (roomId) => {
      const supabase = getSupabase();
      const { data } = await supabase.from("quiz_rooms").select(ROOM_COLS).eq("id", roomId).maybeSingle();
      return data;
    },
    [getSupabase]
  );

  const fetchPlayers = useCallback(async () => {
    if (!room?.id) return;
    const supabase = getSupabase();
    const { data } = await supabase
      .from("quiz_room_players")
      .select("id, nickname, score, correct_count")
      .eq("room_id", room.id)
      .order("score", { ascending: false });
    setPlayers(data ?? []);
  }, [room?.id, getSupabase]);

  // ---- Khôi phục phiên nếu đã ở trong 1 phòng (F5 không mất) ----
  useEffect(() => {
    if (!supabaseReady) return;
    const mem = loadMembership();
    if (!mem?.roomId) return;
    fetchRoom(mem.roomId).then((data) => {
      if (!data) {
        clearMembership();
        return;
      }
      setRoom(data);
      if (mem.isHost && data.host_id === userId) {
        setIsHost(true);
      } else if (!mem.isHost) {
        setMembership(mem);
      }
    });
  }, [supabaseReady, userId, fetchRoom]);

  // ---- Realtime: theo dõi đúng 1 dòng phòng ----
  useEffect(() => {
    if (!room?.id || !supabaseReady) return;
    const supabase = getSupabase();
    const channel = supabase
      .channel(`quiz-room-${room.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "quiz_rooms", filter: `id=eq.${room.id}` },
        (payload) => setRoom((prev) => ({ ...prev, ...payload.new }))
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [room?.id, supabaseReady, getSupabase]);

  // ---- Khi sang câu mới: đặt lại đồng hồ + trạng thái trả lời ----
  useEffect(() => {
    if (room?.status === "playing") {
      setTimer({ index: room.current_index, startedAt: Date.now() });
      setNowTs(Date.now());
      setMyAnswer(null);
      submittedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status, room?.current_index]);

  // ---- Tick đồng hồ khi đang chơi ----
  useEffect(() => {
    if (room?.status !== "playing") return;
    const id = setInterval(() => setNowTs(Date.now()), 100);
    return () => clearInterval(id);
  }, [room?.status, room?.current_index]);

  // ---- Poll danh sách người chơi ở sảnh chờ ----
  useEffect(() => {
    if (!room?.id || room.status !== "lobby") return;
    fetchPlayers();
    const id = setInterval(fetchPlayers, 2500);
    return () => clearInterval(id);
  }, [room?.id, room?.status, fetchPlayers]);

  // chỉ tính giờ khi đồng hồ đã được khởi tạo cho ĐÚNG câu hiện tại
  const timerReady = room?.status === "playing" && timer.index === room.current_index;
  const elapsed = timerReady ? (nowTs - timer.startedAt) / 1000 : 0;
  const timeLeft = Math.max(0, QUESTION_SECONDS - elapsed);
  const revealNow = timerReady && elapsed >= QUESTION_SECONDS;
  const currentQuestion =
    room?.status === "playing" && Array.isArray(room.questions)
      ? room.questions[room.current_index]
      : null;

  // ---- Khi hết giờ 1 câu: người chơi tự nộp (để biết đáp án đúng) + tải bảng xếp hạng ----
  useEffect(() => {
    if (!revealNow || !room) return;
    if (revealDoneRef.current === room.current_index) return;
    revealDoneRef.current = room.current_index;

    if (!isHost && membership && !submittedRef.current) {
      doSubmit(null);
    }
    fetchPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealNow, room?.current_index]);

  // ---- Host: đếm số người đã trả lời câu hiện tại ----
  useEffect(() => {
    if (!isHost || room?.status !== "playing") return;
    let active = true;
    const tick = async () => {
      const supabase = getSupabase();
      const { count } = await supabase
        .from("quiz_room_answers")
        .select("id", { count: "exact", head: true })
        .eq("room_id", room.id)
        .eq("question_index", room.current_index);
      if (active) setAnsweredCount(count ?? 0);
    };
    tick();
    const id = setInterval(tick, 1500);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [isHost, room?.status, room?.current_index, room?.id, getSupabase]);

  // ---- Khi phòng kết thúc: tải bảng xếp hạng cuối ----
  useEffect(() => {
    if (room?.status === "finished") fetchPlayers();
  }, [room?.status, fetchPlayers]);

  async function doSubmit(answerIndex) {
    if (submittedRef.current || !membership || !room) return;
    submittedRef.current = true;
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("submit_quiz_room_answer", {
      p_code: room.code,
      p_player_id: membership.playerId,
      p_token: membership.token,
      p_question_index: room.current_index,
      p_answer_index: answerIndex,
    });
    if (!error && data && data[0]) {
      setMyAnswer({
        answerIndex,
        gained: data[0].gained,
        isCorrect: data[0].is_correct,
        correctIndex: data[0].correct_index,
      });
    } else if (error) {
      submittedRef.current = false; // cho phép thử lại nếu lỗi mạng
    }
  }

  async function handleCreate() {
    setCreateError("");
    setBusy(true);
    let res;
    if (selectedTopic.startsWith("custom:")) {
      const cq = customQuizzes.find((q) => `custom:${q.id}` === selectedTopic);
      if (!cq) {
        setBusy(false);
        setCreateError("Không tìm thấy bộ quiz tự tạo.");
        return;
      }
      res = await createRoom({ custom: { name: cq.name, questions: cq.questions } });
    } else {
      res = await createRoom({ topicId: selectedTopic });
    }
    setBusy(false);
    if (res.error) {
      setCreateError(res.error);
      return;
    }
    const data = await fetchRoom(res.roomId);
    setRoom(data);
    setIsHost(true);
    setMembership(null);
    saveMembership({ code: res.code, roomId: res.roomId, isHost: true });
  }

  async function handleJoin(e) {
    e?.preventDefault();
    setJoinError("");
    const code = joinCode.trim().toUpperCase();
    const nickname = joinNickname.trim();
    if (!code || !nickname) {
      setJoinError("Nhập mã phòng và tên của bạn.");
      return;
    }
    setBusy(true);
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc("join_quiz_room", {
      p_code: code,
      p_nickname: nickname,
    });
    setBusy(false);
    if (error) {
      setJoinError(error.message.replace(/^.*?:\s*/, ""));
      return;
    }
    const row = data[0];
    const mem = {
      code,
      roomId: row.room_id,
      playerId: row.player_id,
      token: row.token,
      nickname,
      isHost: false,
    };
    saveMembership(mem);
    setMembership(mem);
    setIsHost(false);
    const r = await fetchRoom(row.room_id);
    setRoom(r);
  }

  async function handleAdvance() {
    if (!room) return;
    setBusy(true);
    const res = await advanceRoom({ roomId: room.id });
    setBusy(false);
    if (res?.success) {
      const r = await fetchRoom(room.id);
      if (r) setRoom(r);
    }
  }

  async function handleClose() {
    if (!room) return;
    await closeRoom({ roomId: room.id });
    const r = await fetchRoom(room.id);
    if (r) setRoom(r);
  }

  function handleLeave() {
    clearMembership();
    setRoom(null);
    setMembership(null);
    setIsHost(false);
    setPlayers([]);
  }

  // ==================== RENDER ====================

  if (!supabaseReady) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
        <p className="text-white/70">
          Chế độ chơi nhiều người cần cấu hình Supabase. Xem README để thêm{" "}
          <code className="text-axis-yellow">.env.local</code>.
        </p>
      </div>
    );
  }

  // ---- Chưa ở trong phòng: tạo / tham gia ----
  if (!room) {
    return (
      <div className="grid md:grid-cols-2 gap-5">
        {/* Tham gia phòng */}
        <form
          onSubmit={handleJoin}
          className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col"
        >
          <h2 className="font-display font-extrabold text-xl mb-1">Tham gia phòng</h2>
          <p className="text-white/50 text-sm mb-4">Nhập mã phòng — không cần đăng nhập.</p>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            maxLength={5}
            placeholder="MÃ PHÒNG"
            className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-3 mb-3 text-center text-2xl font-display font-extrabold tracking-[0.3em] outline-none focus:border-axis-yellow uppercase"
          />
          <input
            value={joinNickname}
            onChange={(e) => setJoinNickname(e.target.value)}
            maxLength={24}
            placeholder="Tên của bạn"
            className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 mb-3 outline-none focus:border-axis-yellow"
          />
          {joinError && <p className="text-red-400 text-sm font-bold mb-3">{joinError}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-auto bg-axis-yellow text-axis-navy font-extrabold px-6 py-2.5 rounded-full hover:scale-105 transition disabled:opacity-50"
          >
            {busy ? "Đang vào..." : "Vào phòng"}
          </button>
        </form>

        {/* Tạo phòng */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col">
          <h2 className="font-display font-extrabold text-xl mb-1">Tạo phòng (chủ phòng)</h2>
          {username ? (
            <>
              <p className="text-white/50 text-sm mb-4">
                Chọn chủ đề (hoặc bộ quiz tự tạo) rồi chia mã cho mọi người.
              </p>
              <select
                value={selectedTopic}
                onChange={(e) => setSelectedTopic(e.target.value)}
                className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 mb-3 outline-none focus:border-axis-yellow"
              >
                <optgroup label="Chủ đề có sẵn" className="bg-axis-navy">
                  {topics.map((t) => (
                    <option key={t.id} value={t.id} className="bg-axis-navy">
                      {t.emoji} {t.name} ({t.count} câu)
                    </option>
                  ))}
                </optgroup>
                {customQuizzes.length > 0 && (
                  <optgroup label="Quiz tự tạo của bạn" className="bg-axis-navy">
                    {customQuizzes.map((q) => (
                      <option key={q.id} value={`custom:${q.id}`} className="bg-axis-navy">
                        {q.emoji || "📝"} {q.name} ({q.questions.length} câu)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {createError && <p className="text-red-400 text-sm font-bold mb-3">{createError}</p>}
              <button
                onClick={handleCreate}
                disabled={busy}
                className="mt-auto bg-axis-blue text-white font-extrabold px-6 py-2.5 rounded-full hover:scale-105 transition disabled:opacity-50"
              >
                {busy ? "Đang tạo..." : "Tạo phòng"}
              </button>
            </>
          ) : (
            <div className="mt-auto">
              <p className="text-white/50 text-sm mb-4">
                Cần đăng nhập để tạo và điều khiển phòng.
              </p>
              <Link
                href="/login"
                className="inline-block bg-axis-blue text-white font-extrabold px-6 py-2.5 rounded-full hover:scale-105 transition"
              >
                Đăng nhập
              </Link>
            </div>
          )}
        </div>
      </div>
    );
  }

  const total = Array.isArray(room.questions) ? room.questions.length : 0;
  const isLastQuestion = room.current_index >= total - 1;

  // ---- Sảnh chờ phòng ----
  if (room.status === "lobby") {
    return (
      <div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center mb-6">
          <p className="text-white/50 text-sm font-bold uppercase tracking-widest mb-2">Mã phòng</p>
          <p className="font-display font-extrabold text-6xl tracking-[0.2em] text-axis-yellow mb-2">
            {room.code}
          </p>
          <p className="text-white/60 text-sm">
            {room.topic_name} · {total} câu · chia mã này cho mọi người vào chơi
          </p>
        </div>

        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-extrabold text-lg">
            Người chơi ({players.length})
          </h2>
          <span className="w-2 h-2 rounded-full bg-emerald-400" title="Đang cập nhật" />
        </div>
        {players.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-8">
            {players.map((p) => (
              <span
                key={p.id}
                className="bg-white/10 border border-white/10 rounded-full px-4 py-1.5 font-bold text-sm"
              >
                {p.nickname}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-white/50 mb-8">Chưa có ai vào. Đang chờ...</p>
        )}

        {isHost ? (
          <div className="flex items-center gap-3">
            <button
              onClick={handleAdvance}
              disabled={busy || players.length === 0}
              className="bg-axis-yellow text-axis-navy font-extrabold px-8 py-3 rounded-full hover:scale-105 transition disabled:opacity-40"
            >
              {busy ? "..." : "🚀 Bắt đầu"}
            </button>
            <button
              onClick={handleLeave}
              className="bg-white/10 font-bold px-5 py-3 rounded-full hover:bg-white/20 transition"
            >
              Thoát
            </button>
            {players.length === 0 && (
              <span className="text-white/40 text-sm">Chờ ít nhất 1 người vào phòng</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <p className="text-white/70 font-bold">
              Bạn là <span className="text-axis-yellow">{membership?.nickname}</span> — đang chờ chủ
              phòng bắt đầu...
            </p>
            <button
              onClick={handleLeave}
              className="bg-white/10 font-bold px-4 py-1.5 rounded-full text-sm hover:bg-white/20 transition"
            >
              Rời phòng
            </button>
          </div>
        )}
      </div>
    );
  }

  // ---- Đang chơi ----
  if (room.status === "playing" && currentQuestion) {
    const pct = (timeLeft / QUESTION_SECONDS) * 100;
    const timerColor = pct > 50 ? "#53e07a" : pct > 25 ? "#ffcf3a" : "#e74c3c";
    const correctIndex = myAnswer?.correctIndex;

    return (
      <div>
        <div className="flex items-center justify-between mb-3 text-sm font-extrabold">
          <span className="text-white/60">
            Câu {room.current_index + 1}/{total}
          </span>
          {isHost && (
            <span className="bg-white/10 rounded-full px-4 py-1">
              Đã trả lời: {answeredCount}/{players.length || "?"}
            </span>
          )}
        </div>

        <div className="h-2.5 bg-white/10 rounded-full overflow-hidden mb-6">
          <div
            className="h-full rounded-full transition-[width] duration-100 ease-linear"
            style={{ width: `${pct}%`, backgroundColor: timerColor }}
          />
        </div>

        <div
          key={`rq-${room.current_index}`}
          className="quiz-fade-in bg-white/5 border border-white/10 rounded-2xl px-6 py-10 text-center mb-6 relative"
        >
          <h2 className="font-display font-extrabold text-xl sm:text-2xl leading-snug">
            {currentQuestion.text}
          </h2>
          {!revealNow && (
            <span
              className="absolute top-3 right-4 font-display font-extrabold text-lg"
              style={{ color: timerColor }}
            >
              {Math.ceil(timeLeft)}s
            </span>
          )}
        </div>

        {/* Banner kết quả cá nhân sau khi hết giờ */}
        {revealNow && !isHost && (
          <div className="text-center mb-4">
            {myAnswer?.isCorrect ? (
              <span className="font-display font-extrabold text-2xl text-axis-yellow">
                ✓ Đúng! +{(myAnswer.gained ?? 0).toLocaleString("vi")} điểm
              </span>
            ) : (
              <span className="font-display font-extrabold text-2xl text-red-400">
                {myAnswer?.answerIndex == null ? "⏰ Hết giờ!" : "✗ Sai rồi!"}
              </span>
            )}
          </div>
        )}

        {/* Ô đáp án */}
        <div key={`ra-${room.current_index}`} className="quiz-fade-in grid sm:grid-cols-2 gap-3 mb-6">
          {currentQuestion.answers.map((ans, i) => {
            const tile = TILES[i];
            const chosen = myAnswer?.answerIndex === i;
            const isCorrect = revealNow && correctIndex === i;
            let extra = "";
            if (revealNow) {
              if (isCorrect) extra = "ring-4 ring-white scale-[1.02]";
              else if (chosen) extra = "opacity-60";
              else extra = "opacity-30";
            } else if (isHost) {
              extra = "cursor-default";
            } else if (submittedRef.current) {
              extra = chosen ? "ring-4 ring-white" : "opacity-40";
            } else {
              extra = "hover:scale-[1.02] active:scale-95";
            }
            return (
              <button
                key={i}
                disabled={isHost || revealNow || submittedRef.current}
                onClick={() => doSubmit(i)}
                className={`flex items-center gap-4 rounded-2xl px-5 py-5 sm:py-6 font-extrabold text-left text-base sm:text-lg transition ${extra}`}
                style={{ backgroundColor: tile.bg, color: tile.fg }}
              >
                <span className="text-2xl shrink-0">{tile.shape}</span>
                <span>{ans}</span>
                {revealNow && isCorrect && <span className="ml-auto text-2xl">✓</span>}
              </button>
            );
          })}
        </div>

        {/* Trạng thái người chơi khi chưa hết giờ */}
        {!isHost && !revealNow && submittedRef.current && (
          <p className="text-center text-white/60 font-bold">
            Đã chọn! Chờ các bạn khác & hết giờ...
          </p>
        )}

        {/* Bảng xếp hạng + điều khiển host khi hết giờ */}
        {revealNow && (
          <div>
            <Standings players={players} youNickname={membership?.nickname} compact />
            {isHost && (
              <div className="flex items-center gap-3 justify-center mt-6">
                <button
                  onClick={handleAdvance}
                  disabled={busy}
                  className="bg-axis-yellow text-axis-navy font-extrabold px-8 py-3 rounded-full hover:scale-105 transition disabled:opacity-40"
                >
                  {isLastQuestion ? "🏁 Kết thúc" : "Câu tiếp →"}
                </button>
              </div>
            )}
            {!isHost && (
              <p className="text-center text-white/50 mt-4 text-sm">Chờ chủ phòng chuyển câu...</p>
            )}
          </div>
        )}
      </div>
    );
  }

  // ---- Kết thúc ----
  if (room.status === "finished") {
    const podium = players.slice(0, 3);
    const myRank = membership
      ? players.findIndex((p) => p.nickname === membership.nickname) + 1
      : 0;
    return (
      <div className="text-center">
        <h2 className="font-display font-extrabold text-3xl mb-2">🏆 Kết thúc!</h2>
        <p className="text-white/60 mb-8">{room.topic_name}</p>

        {podium.length > 0 && (
          <div className="flex items-center justify-center gap-6 mb-8 text-center">
            {podium.map((p, i) => (
              <div key={p.id} className={i === 0 ? "order-2" : i === 1 ? "order-1" : "order-3"}>
                <div className="text-4xl mb-1">{["🥇", "🥈", "🥉"][i]}</div>
                <div className="font-extrabold">{p.nickname}</div>
                <div className="text-axis-yellow font-display font-extrabold">
                  {(p.score ?? 0).toLocaleString("vi")}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="max-w-md mx-auto text-left mb-8">
          <Standings players={players} youNickname={membership?.nickname} />
        </div>

        {myRank > 0 && (
          <p className="text-axis-yellow font-extrabold mb-6">
            Bạn xếp hạng #{myRank}/{players.length}
          </p>
        )}

        <div className="flex items-center gap-3 justify-center">
          {isHost && (
            <button
              onClick={handleLeave}
              className="bg-axis-yellow text-axis-navy font-extrabold px-6 py-2.5 rounded-full hover:scale-105 transition"
            >
              Tạo phòng mới
            </button>
          )}
          <button
            onClick={handleLeave}
            className="bg-white/10 font-bold px-6 py-2.5 rounded-full hover:bg-white/20 transition"
          >
            Về trang chọn phòng
          </button>
        </div>
      </div>
    );
  }

  // trạng thái chuyển tiếp (vd host vừa bấm nhưng chưa có câu)
  return (
    <div className="text-center py-16 text-white/60">
      <p>Đang tải phòng...</p>
      <button
        onClick={handleLeave}
        className="mt-4 bg-white/10 font-bold px-5 py-2 rounded-full hover:bg-white/20 transition"
      >
        Thoát
      </button>
    </div>
  );
}

function Standings({ players, youNickname, compact }) {
  const list = compact ? players.slice(0, 5) : players;
  return (
    <div>
      {!compact && <h3 className="font-display font-extrabold text-lg mb-3">Bảng xếp hạng</h3>}
      {compact && <h3 className="font-display font-extrabold text-base mb-3 text-center">Bảng xếp hạng</h3>}
      <ol className="space-y-2">
        {list.map((p, i) => {
          const you = p.nickname === youNickname;
          return (
            <li
              key={p.id}
              className={`flex items-center justify-between rounded-xl px-4 py-2.5 border ${
                you ? "bg-axis-yellow/15 border-axis-yellow/50" : "bg-white/5 border-white/10"
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="font-display font-extrabold text-axis-yellow w-7">#{i + 1}</span>
                <span className="font-bold">
                  {p.nickname}
                  {you && <span className="text-white/50 text-xs ml-1">(bạn)</span>}
                </span>
              </span>
              <span className="text-axis-yellow font-extrabold">
                {(p.score ?? 0).toLocaleString("vi")}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
