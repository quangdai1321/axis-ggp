// Lưu các bộ quiz do người chơi tự tạo ngay trên trình duyệt (localStorage).
// Không cần đăng nhập hay Supabase — mỗi máy giữ bộ quiz của riêng mình.

const STORAGE_KEY = "axis_custom_quizzes";

export function loadCustomQuizzes() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function persist(list) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // localStorage đầy hoặc bị chặn — bỏ qua, không làm crash game
  }
  return list;
}

export function saveCustomQuiz(quiz) {
  const list = loadCustomQuizzes();
  return persist([quiz, ...list]);
}

export function deleteCustomQuiz(id) {
  const list = loadCustomQuizzes().filter((q) => q.id !== id);
  return persist(list);
}
