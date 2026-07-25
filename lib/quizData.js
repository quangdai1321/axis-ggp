// Ngân hàng câu hỏi cho chế độ Quiz (kiểu quiz.com):
// mỗi chủ đề ~10 câu, mỗi câu 4 đáp án, `correct` là index của đáp án đúng
// trong mảng `answers` gốc (thứ tự đáp án sẽ được xáo lại khi chơi).

export const QUESTION_SECONDS = 20;

export const QUIZ_TOPICS = [
  {
    id: "doraemon",
    name: "Doraemon & Bảo bối",
    emoji: "🔔",
    color: "#1e9bf0",
    description: "Mèo máy, bảo bối thần kỳ và những người bạn.",
    questions: [
      {
        text: "Doraemon là mèo máy đến từ thế kỷ bao nhiêu?",
        answers: ["Thế kỷ 22", "Thế kỷ 21", "Thế kỷ 23", "Thế kỷ 25"],
        correct: 0,
      },
      {
        text: "Bảo bối nào giúp bay lên trời?",
        answers: ["Chong chóng tre", "Cánh cửa thần kỳ", "Đèn pin thu nhỏ", "Khăn trùm thời gian"],
        correct: 0,
      },
      {
        text: "Doraemon sợ con vật nào nhất?",
        answers: ["Chuột", "Chó", "Rắn", "Gián"],
        correct: 0,
      },
      {
        text: "Món ăn khoái khẩu của Doraemon là gì?",
        answers: ["Bánh rán Dorayaki", "Sushi", "Mì ramen", "Bánh gạo Mochi"],
        correct: 0,
      },
      {
        text: "Cánh cửa thần kỳ có công dụng gì?",
        answers: [
          "Đi tới bất kỳ nơi nào muốn",
          "Quay ngược thời gian",
          "Thu nhỏ đồ vật",
          "Dịch mọi ngôn ngữ",
        ],
        correct: 0,
      },
      {
        text: "Em gái của Doraemon tên là gì?",
        answers: ["Dorami", "Doramy", "Mimi", "Dora"],
        correct: 0,
      },
      {
        text: "Nobita bắn thứ gì giỏi nhất?",
        answers: ["Súng cao su / bắn súng", "Cung tên", "Phi tiêu", "Bi-a"],
        correct: 0,
      },
      {
        text: "Đèn pin thu nhỏ có tác dụng gì?",
        answers: ["Thu nhỏ mọi thứ bị chiếu vào", "Soi đường ban đêm", "Làm tan băng", "Phóng to đồ vật"],
        correct: 0,
      },
      {
        text: "Ai hay bắt nạt Nobita nhất?",
        answers: ["Jaian (Chaien)", "Suneo (Xêkô)", "Dekisugi", "Sensei"],
        correct: 0,
      },
      {
        text: "Bánh mì chuyển ngữ (bánh mì trí nhớ) dùng để làm gì?",
        answers: [
          "Ăn để thuộc lòng nội dung in trên bánh",
          "Nói được mọi thứ tiếng",
          "Ăn để chạy nhanh hơn",
          "Chữa bệnh đau bụng",
        ],
        correct: 0,
      },
    ],
  },
  {
    id: "axis",
    name: "AXIS: Gadget Grand Prix",
    emoji: "🏎️",
    color: "#ff6fa1",
    description: "Bạn hiểu giải đấu đua xe bảo bối đến đâu?",
    questions: [
      {
        text: "Một trận đua AXIS có tối đa bao nhiêu người chơi?",
        answers: ["50", "20", "100", "8"],
        correct: 0,
      },
      {
        text: "Người chơi nhặt gì trên đường đua để nhận bảo bối ngẫu nhiên?",
        answers: ["Miracle Bag (Túi thần kỳ)", "Item Box", "Rương báu", "Ngôi sao may mắn"],
        correct: 0,
      },
      {
        text: "Bảo bối nào trong AXIS giúp xe bay lên?",
        answers: ["Bamboo Copter", "Rocket Shoes", "Turbo Candy", "Time Warp"],
        correct: 0,
      },
      {
        text: "Rank cao nhất trong AXIS là gì?",
        answers: ["Axis Champion", "Legend", "Grand Master", "Diamond"],
        correct: 0,
      },
      {
        text: "Bảo bối cổ đại tạo ra không gian AXIS tên là gì?",
        answers: ["Axis Creator Box", "Track Seed", "Time Machine", "Dimension Cutter"],
        correct: 0,
      },
      {
        text: "Map nào có khủng long và núi lửa?",
        answers: ["Dinosaur Valley", "Nobita Town", "Cloud Kingdom", "Future Tokyo"],
        correct: 0,
      },
      {
        text: "Air Cannon (Không khí đại bác) là bảo bối loại gì?",
        answers: ["Tấn công", "Phòng thủ", "Tăng tốc", "Hồi phục"],
        correct: 0,
      },
      {
        text: "Time Cloak (Khăn trùm thời gian) có tác dụng gì?",
        answers: ["Miễn nhiễm sát thương", "Tăng tốc tối đa", "Đóng băng đối thủ", "Tàng hình vĩnh viễn"],
        correct: 0,
      },
      {
        text: "Phong cách đồ họa của AXIS là gì?",
        answers: ["Anime Cel Shading", "Pixel Art", "Tả thực (Realistic)", "Low-poly"],
        correct: 0,
      },
      {
        text: "AXIS cam kết KHÔNG bán thứ gì?",
        answers: ["Vật phẩm tăng sức mạnh (Pay-to-Win)", "Skin xe", "Battle Pass", "Emote"],
        correct: 0,
      },
    ],
  },
  {
    id: "general",
    name: "Kiến thức chung",
    emoji: "🌏",
    color: "#53e07a",
    description: "Địa lý, khoa học, toán nhanh — đủ cả.",
    questions: [
      {
        text: "Thủ đô của Việt Nam là thành phố nào?",
        answers: ["Hà Nội", "TP. Hồ Chí Minh", "Đà Nẵng", "Huế"],
        correct: 0,
      },
      {
        text: "Hành tinh nào gần Mặt Trời nhất?",
        answers: ["Sao Thủy", "Sao Kim", "Trái Đất", "Sao Hỏa"],
        correct: 0,
      },
      {
        text: "7 × 8 bằng bao nhiêu?",
        answers: ["56", "54", "63", "48"],
        correct: 0,
      },
      {
        text: "Đại dương nào lớn nhất thế giới?",
        answers: ["Thái Bình Dương", "Đại Tây Dương", "Ấn Độ Dương", "Bắc Băng Dương"],
        correct: 0,
      },
      {
        text: "Nước sôi ở bao nhiêu độ C (áp suất thường)?",
        answers: ["100°C", "90°C", "120°C", "80°C"],
        correct: 0,
      },
      {
        text: "Ai là tác giả bức tranh Mona Lisa?",
        answers: ["Leonardo da Vinci", "Picasso", "Van Gogh", "Michelangelo"],
        correct: 0,
      },
      {
        text: "Loài động vật lớn nhất hành tinh là gì?",
        answers: ["Cá voi xanh", "Voi châu Phi", "Khủng long bạo chúa", "Cá mập trắng"],
        correct: 0,
      },
      {
        text: "Ngôn ngữ lập trình nào chạy trực tiếp trong trình duyệt?",
        answers: ["JavaScript", "Python", "C++", "Java"],
        correct: 0,
      },
      {
        text: "Ngọn núi cao nhất thế giới là gì?",
        answers: ["Everest", "K2", "Phú Sĩ", "Fansipan"],
        correct: 0,
      },
      {
        text: "Cầu vồng có bao nhiêu màu?",
        answers: ["7", "5", "6", "9"],
        correct: 0,
      },
    ],
  },
];

export function getTopic(topicId) {
  return QUIZ_TOPICS.find((t) => t.id === topicId) ?? null;
}

// Xáo trộn thứ tự câu hỏi + thứ tự đáp án trong từng câu (Fisher–Yates),
// trả về danh sách câu hỏi sẵn sàng để chơi với index đáp án đúng mới.
export function buildQuizRun(topicId) {
  const topic = getTopic(topicId);
  if (!topic) return [];

  const shuffle = (arr) => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  return shuffle(topic.questions).map((q) => {
    const order = shuffle(q.answers.map((_, i) => i));
    return {
      text: q.text,
      answers: order.map((i) => q.answers[i]),
      correct: order.indexOf(q.correct),
    };
  });
}
