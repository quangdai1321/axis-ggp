"use client";

import { useState } from "react";

// 4 ô đáp án cùng màu/ký hiệu với lúc chơi để nhất quán
const TILES = [
  { shape: "▲", bg: "#e74c3c" },
  { shape: "◆", bg: "#1e9bf0" },
  { shape: "●", bg: "#ffcf3a" },
  { shape: "■", bg: "#53e07a" },
];

const EMOJIS = ["📝", "🎯", "🧠", "🎮", "🎵", "⚽", "🌟", "🍔", "🐱", "🚀", "📚", "🎬"];
const COLORS = ["#1e9bf0", "#ff6fa1", "#53e07a", "#ff9a3c", "#9b59b6", "#ffcf3a"];
const MAX_QUESTIONS = 20;

// multi=false: chọn đúng 1 đáp án đúng. multi=true: chọn nhiều đáp án đúng.
function emptyQuestion() {
  return { text: "", answers: ["", "", "", ""], multi: false, correctSet: [0] };
}

export default function QuizCreator({ onSave, onCancel }) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJIS[0]);
  const [questions, setQuestions] = useState([emptyQuestion()]);
  const [error, setError] = useState("");

  function updateQuestionText(qi, text) {
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, text } : q)));
  }
  function updateAnswer(qi, ai, value) {
    setQuestions((qs) =>
      qs.map((q, i) =>
        i === qi ? { ...q, answers: q.answers.map((a, j) => (j === ai ? value : a)) } : q
      )
    );
  }
  function setMulti(qi, multi) {
    setQuestions((qs) =>
      qs.map((q, i) => {
        if (i !== qi) return q;
        // đổi sang chọn-1 thì chỉ giữ 1 đáp án đúng đầu tiên
        const correctSet = multi ? q.correctSet : q.correctSet.slice(0, 1);
        return { ...q, multi, correctSet: correctSet.length ? correctSet : [0] };
      })
    );
  }
  function toggleCorrect(qi, ai) {
    setQuestions((qs) =>
      qs.map((q, i) => {
        if (i !== qi) return q;
        if (!q.multi) return { ...q, correctSet: [ai] };
        const has = q.correctSet.includes(ai);
        const correctSet = has ? q.correctSet.filter((x) => x !== ai) : [...q.correctSet, ai];
        return { ...q, correctSet };
      })
    );
  }
  function addQuestion() {
    setQuestions((qs) => (qs.length >= MAX_QUESTIONS ? qs : [...qs, emptyQuestion()]));
  }
  function removeQuestion(qi) {
    setQuestions((qs) => (qs.length <= 1 ? qs : qs.filter((_, i) => i !== qi)));
  }

  function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) return setError("Hãy đặt tên cho bộ quiz.");

    const cleaned = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const text = q.text.trim();
      if (!text) return setError(`Câu ${i + 1}: chưa nhập nội dung câu hỏi.`);

      const answers = q.answers.map((a) => a.trim());
      const filledIdx = answers.map((a, idx) => (a ? idx : -1)).filter((idx) => idx >= 0);
      if (filledIdx.length < 2) return setError(`Câu ${i + 1}: cần ít nhất 2 đáp án.`);

      const corrects = q.correctSet.filter((idx) => idx >= 0);
      if (corrects.some((idx) => !answers[idx])) {
        return setError(`Câu ${i + 1}: có đáp án đúng đang để trống.`);
      }
      if (q.multi) {
        if (corrects.length < 1) return setError(`Câu ${i + 1}: chọn ít nhất 1 đáp án đúng.`);
        if (corrects.length >= filledIdx.length)
          return setError(`Câu ${i + 1}: phải chừa ít nhất 1 đáp án sai.`);
      } else if (corrects.length !== 1) {
        return setError(`Câu ${i + 1}: chọn đúng 1 đáp án đúng.`);
      }

      const keptAnswers = filledIdx.map((idx) => answers[idx]);
      const remap = (idx) => filledIdx.indexOf(idx);
      if (q.multi) {
        cleaned.push({
          text,
          answers: keptAnswers,
          multi: true,
          correct: corrects.map(remap).sort((a, b) => a - b),
        });
      } else {
        cleaned.push({ text, answers: keptAnswers, correct: remap(corrects[0]) });
      }
    }

    onSave({
      id: `custom:${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: trimmedName,
      emoji,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      isCustom: true,
      createdAt: new Date().toISOString(),
      questions: cleaned,
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display font-extrabold text-2xl">✏️ Tạo bộ quiz của bạn</h2>
        <button onClick={onCancel} className="text-white/60 hover:text-white text-sm font-bold">
          ← Quay lại
        </button>
      </div>

      {/* Tên + biểu tượng */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
        <label className="block text-sm font-bold text-white/70 mb-2">Tên bộ quiz</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="VD: Đố vui gia đình cuối tuần"
          className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 mb-4 outline-none focus:border-axis-yellow"
        />
        <label className="block text-sm font-bold text-white/70 mb-2">Biểu tượng</label>
        <div className="flex flex-wrap gap-2">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={`w-10 h-10 rounded-xl text-xl transition ${
                emoji === e ? "bg-axis-yellow scale-110" : "bg-white/10 hover:bg-white/20"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Danh sách câu hỏi */}
      <div className="space-y-4">
        {questions.map((q, qi) => (
          <div key={qi} className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-display font-extrabold text-axis-yellow">Câu {qi + 1}</span>
              {questions.length > 1 && (
                <button
                  onClick={() => removeQuestion(qi)}
                  className="text-red-400 hover:text-red-300 text-sm font-bold"
                >
                  Xóa câu
                </button>
              )}
            </div>

            <input
              value={q.text}
              onChange={(e) => updateQuestionText(qi, e.target.value)}
              maxLength={200}
              placeholder="Nhập câu hỏi..."
              className="w-full bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 mb-3 outline-none focus:border-axis-yellow"
            />

            {/* Chọn loại câu hỏi */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-white/50 font-bold">Loại:</span>
              <div className="inline-flex bg-white/5 rounded-full p-0.5 border border-white/10">
                <button
                  type="button"
                  onClick={() => setMulti(qi, false)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                    !q.multi ? "bg-axis-yellow text-axis-navy" : "text-white/60 hover:text-white"
                  }`}
                >
                  1 đáp án đúng
                </button>
                <button
                  type="button"
                  onClick={() => setMulti(qi, true)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                    q.multi ? "bg-axis-yellow text-axis-navy" : "text-white/60 hover:text-white"
                  }`}
                >
                  Nhiều đáp án đúng
                </button>
              </div>
            </div>

            <p className="text-xs text-white/50 mb-2 font-bold">
              {q.multi
                ? "Tick tất cả ô ứng với đáp án ĐÚNG (cần ≥ 2 đáp án, chọn ≥ 1 đúng và chừa ≥ 1 sai):"
                : "Bấm vòng tròn bên trái để chọn 1 đáp án ĐÚNG (cần ≥ 2 đáp án):"}
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {q.answers.map((ans, ai) => {
                const tile = TILES[ai];
                const isCorrect = q.correctSet.includes(ai);
                return (
                  <div
                    key={ai}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 border transition ${
                      isCorrect ? "border-axis-yellow bg-axis-yellow/10" : "border-white/10 bg-white/5"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleCorrect(qi, ai)}
                      title="Chọn làm đáp án đúng"
                      className={`w-5 h-5 shrink-0 border-2 flex items-center justify-center ${
                        q.multi ? "rounded-md" : "rounded-full"
                      } ${isCorrect ? "border-axis-yellow bg-axis-yellow" : "border-white/40"}`}
                    >
                      {isCorrect && (
                        <span className="text-[11px] leading-none font-black text-axis-navy">✓</span>
                      )}
                    </button>
                    <span className="text-sm shrink-0" style={{ color: tile.bg }}>
                      {tile.shape}
                    </span>
                    <input
                      value={ans}
                      onChange={(e) => updateAnswer(qi, ai, e.target.value)}
                      maxLength={100}
                      placeholder={`Đáp án ${ai + 1}`}
                      className="w-full bg-transparent outline-none text-sm"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {questions.length < MAX_QUESTIONS && (
        <button
          onClick={addQuestion}
          className="mt-4 w-full border-2 border-dashed border-white/20 rounded-2xl py-3 font-bold text-white/60 hover:border-axis-yellow hover:text-axis-yellow transition"
        >
          + Thêm câu hỏi ({questions.length}/{MAX_QUESTIONS})
        </button>
      )}

      {error && <p className="mt-4 text-red-400 font-bold text-sm text-center">{error}</p>}

      <div className="flex items-center justify-center gap-3 mt-6">
        <button
          onClick={handleSave}
          className="bg-axis-yellow text-axis-navy font-extrabold px-8 py-2.5 rounded-full hover:scale-105 transition"
        >
          Lưu &amp; chơi thử
        </button>
        <button
          onClick={onCancel}
          className="bg-white/10 font-extrabold px-6 py-2.5 rounded-full hover:bg-white/20 transition"
        >
          Hủy
        </button>
      </div>

      <p className="text-center text-white/40 text-xs mt-4">
        Bộ quiz được lưu trên trình duyệt này. Điểm quiz tự tạo không tính vào bảng xếp hạng.
      </p>
    </div>
  );
}
