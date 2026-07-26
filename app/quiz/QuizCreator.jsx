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

function emptyQuestion() {
  return { text: "", answers: ["", "", "", ""], correct: 0 };
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
  function setCorrect(qi, ai) {
    setQuestions((qs) => qs.map((q, i) => (i === qi ? { ...q, correct: ai } : q)));
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
      if (!answers[q.correct]) return setError(`Câu ${i + 1}: đáp án đúng đang để trống.`);

      // chỉ giữ đáp án có nội dung, tính lại index đáp án đúng
      const keptAnswers = filledIdx.map((idx) => answers[idx]);
      const newCorrect = filledIdx.indexOf(q.correct);
      cleaned.push({ text, answers: keptAnswers, correct: newCorrect });
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
        <button
          onClick={onCancel}
          className="text-white/60 hover:text-white text-sm font-bold"
        >
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

            <p className="text-xs text-white/50 mb-2 font-bold">
              Nhập đáp án và bấm vòng tròn bên trái để chọn đáp án ĐÚNG (cần ≥ 2 đáp án):
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              {q.answers.map((ans, ai) => {
                const tile = TILES[ai];
                const isCorrect = q.correct === ai;
                return (
                  <div
                    key={ai}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2 border transition ${
                      isCorrect ? "border-axis-yellow bg-axis-yellow/10" : "border-white/10 bg-white/5"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setCorrect(qi, ai)}
                      title="Chọn làm đáp án đúng"
                      className={`w-5 h-5 rounded-full shrink-0 border-2 flex items-center justify-center ${
                        isCorrect ? "border-axis-yellow bg-axis-yellow" : "border-white/40"
                      }`}
                    >
                      {isCorrect && <span className="w-2 h-2 rounded-full bg-axis-navy" />}
                    </button>
                    <span
                      className="text-sm shrink-0"
                      style={{ color: tile.bg }}
                    >
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

      {error && (
        <p className="mt-4 text-red-400 font-bold text-sm text-center">{error}</p>
      )}

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
