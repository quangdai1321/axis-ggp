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

// Để lỗi nổi lên (vd hết dung lượng khi quiz có nhiều ảnh) thay vì im lặng
// nuốt mất — người tạo cần biết bộ quiz chưa được lưu.
function persist(list) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
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
