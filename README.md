# AXIS: Gadget Grand Prix — Web Pitch + Demo + Giải đấu

Trang giới thiệu (landing page) cho concept game **AXIS: Gadget Grand Prix**, gồm:

1. **Landing page** giới thiệu lore, gadget, map, mode, rank (tĩnh, không cần đăng nhập).
2. **Mini-demo lái xe 3D** chạy thẳng trong trình duyệt (Three.js) — trải nghiệm cảm
   giác lái + nhặt bảo bối, không cần tài khoản.
3. **Giải đấu (đua tự động có kịch bản)** — cần đăng nhập:
   - Người chơi vào **Sảnh chờ**, chọn 1 trong tối đa 50 xe có sẵn và đặt tên xe.
   - Admin bấm **Bắt đầu**, hệ thống tính kết quả (mỗi xe có tốc độ riêng + yếu tố
     may rủi bảo bối) rồi phát lại như một trận đua 3D, xếp hạng cập nhật dần khi
     xe cán đích.
   - **Bảng xếp hạng** lưu kết quả từng ván + tổng số lần về nhất của mỗi người.

Đây **không phải** bản dựng của game thật (game 3D multiplayer 50 người tự lái
cùng lúc cần Unreal/Unity + dedicated game server + đồng bộ vật lý realtime,
không chạy được trên Vercel/serverless). Vì vậy phần "giải đấu" dùng mô hình
**đua tự động có kịch bản**: server tính trước ai về nhất/nhì..., rồi trình
duyệt chỉ phát lại animation theo đúng thời gian đã tính — không cần hạ tầng
WebSocket đồng bộ vật lý phức tạp, vẫn nằm gọn trong free tier.

## Stack

- [Next.js](https://nextjs.org) (App Router, Server Actions)
- Tailwind CSS
- [three.js](https://threejs.org) cho demo lái xe + phát lại trận đua (client-side)
- [Supabase](https://supabase.com) (free tier) — Postgres + Auth cho đăng nhập,
  chọn xe, và bảng xếp hạng

## 1. Tạo Supabase project (free)

1. Vào [supabase.com](https://supabase.com) → **New project** (chọn region gần
   bạn, đặt mật khẩu DB bất kỳ). Gói Free đủ dùng cho project này.
2. Vào **SQL Editor** → **New query** → dán toàn bộ nội dung file
   [`supabase/schema.sql`](supabase/schema.sql) → **Run**. Việc này tạo bảng
   `profiles`, `car_slots` (seed sẵn 50 xe), `race_sessions`, `race_entries` và
   các policy Row Level Security.
3. Vào **Project Settings → API**, copy **Project URL** và **anon public key**.
4. Tạo file `.env.local` ở thư mục gốc (copy từ `.env.example`):

   ```bash
   cp .env.example .env.local
   ```

   rồi điền `NEXT_PUBLIC_SUPABASE_URL` và `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

5. **Để test nhanh không cần cấu hình email**: vào **Authentication → Providers
   → Email**, tắt **Confirm email** — vậy đăng ký xong là đăng nhập được ngay,
   không cần chờ email xác nhận. (Muốn bật lại cho production thì route
   `/auth/confirm` trong code đã sẵn sàng xử lý link xác nhận kiểu
   `token_hash` + `type` theo chuẩn Supabase SSR.)

6. **Phong admin cho tài khoản của bạn**: đăng ký 1 tài khoản trong app trước,
   sau đó vào SQL Editor chạy:

   ```sql
   update public.profiles set is_admin = true where username = 'ten_ban_dat_luc_dang_ky';
   ```

   Chỉ tài khoản `is_admin = true` mới thấy nút **Bắt đầu đua** / **Ván mới**
   trong Sảnh chờ.

7. **(Tuỳ chọn) Bật đăng nhập bằng ví EVM**: vào **Authentication → Sign In /
   Providers → Web3** trong Supabase Dashboard, bật **Ethereum**. Không cần
   bước này nếu chỉ dùng đăng nhập email/mật khẩu.

## 1b. (Tuỳ chọn) WalletConnect cho đăng nhập bằng ví

Nút **MetaMask** hoạt động ngay không cần cấu hình gì (dùng thẳng ví trình
duyệt qua `window.ethereum`). Nút **WalletConnect** (quét QR bằng ví mobile)
cần 1 Project ID miễn phí:

1. Vào [cloud.reown.com](https://cloud.reown.com) (trước đây là WalletConnect
   Cloud) → đăng nhập → **Create Project**.
2. Copy **Project ID**, thêm vào `.env.local`:

   ```bash
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-project-id
   ```

Không có biến này thì nút WalletConnect sẽ tự disable, nút MetaMask vẫn dùng
được bình thường.

## 2. Chạy local

```bash
npm install
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000). Nếu chưa cấu hình `.env.local`,
landing page + demo lái xe vẫn chạy bình thường; các trang `/login`, `/lobby`,
`/race`, `/leaderboard` sẽ hiện thông báo "Chưa cấu hình Supabase".

## 3. Build production

```bash
npm run build
npm start
```

## 4. Deploy lên Vercel (free)

1. Đẩy project lên một GitHub repo.
2. Vào [vercel.com](https://vercel.com) → **Add New Project** → chọn repo.
3. Trong bước cấu hình, thêm 2 **Environment Variables** giống `.env.local`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Bấm **Deploy**. Vercel tự nhận diện Next.js, không cần cấu hình gì thêm.

Vào **Supabase → Authentication → URL Configuration**, thêm domain Vercel
(vd `https://ten-project.vercel.app`) vào **Redirect URLs** để đăng nhập/đăng
ký hoạt động đúng trên production.

Project chỉ dùng Postgres cho tài khoản/lịch sử ván đua (ghi rất thưa, mỗi
lần chọn xe / bắt đầu đua / cán đích), không ghi vị trí realtime liên tục —
nên nằm gọn trong **free tier của cả Vercel lẫn Supabase**.

## Cấu trúc

```
app/
  layout.js              # Root layout + NavBar
  page.js                # Landing page (lore, gadget, map, mode, rank...)
  login/
    page.js              # Trang đăng nhập/đăng ký
    LoginForm.jsx         # Form client (tabs đăng nhập/đăng ký)
    actions.js            # Server Actions: signUp, signIn, signOut
  lobby/
    page.js               # Sảnh chờ: lưới 50 xe, chọn xe, điều khiển admin
    actions.js            # Server Actions: claimCar, dropCar, startRace, newSession...
  race/
    page.js               # Trang phát lại trận đua
  leaderboard/
    page.js               # Bảng xếp hạng ván gần nhất + bảng vinh danh
  auth/confirm/route.js   # Xử lý link xác nhận email của Supabase
components/
  RaceDemo.jsx            # Mini-demo lái xe thủ công (Three.js)
  RaceReplay.jsx          # Phát lại trận đua tự động theo finish_time (Three.js)
  NavBar.jsx              # Thanh điều hướng + trạng thái đăng nhập
lib/supabase/
  client.js, server.js, middleware.js, config.js
middleware.js              # Refresh session Supabase trên mọi request
supabase/schema.sql         # Schema Postgres + seed 50 xe + RLS policies
GAME_DESIGN.md              # Tài liệu thiết kế game gốc
```

## Điều khiển demo lái xe (trang chủ)

- `↑ ↓ ← →` hoặc `W A S D`: lái xe
- `Space`: dùng bảo bối vừa nhặt được (Miracle Bag)
- Tông vào bot sẽ bị bật văng; văng quá xa khỏi đường đua sẽ tự đặt lại vị trí
  1 giây trước đó.

## Luồng giải đấu

1. Đăng nhập/đăng ký ở `/login`.
2. Vào `/lobby`, chọn 1 xe trống, đặt tên, bấm **Chọn xe này**.
3. Admin bấm **Bắt đầu đua** khi đã đủ người → server tính kết quả.
4. Mọi người vào `/race` xem phát lại trận đua + bảng xếp hạng trực tiếp.
5. Admin bấm **Chốt kết quả** sau khi đua xong → `/leaderboard` cập nhật.
6. Admin bấm **Ván mới** để mở lại sảnh chờ cho ván tiếp theo.
