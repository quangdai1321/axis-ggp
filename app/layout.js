import "./globals.css";
import NavBar from "../components/NavBar";

export const metadata = {
  title: "AXIS: Gadget Grand Prix",
  description:
    "Đại Hội Đua Xe Bảo Bối — 3D arcade battle-royale racing lấy cảm hứng từ thế giới Doraemon. 50 người chơi, bảo bối thần kỳ, đường đua vô tận trong không gian AXIS.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><circle cx=%2250%22 cy=%2250%22 r=%2245%22 fill=%22%231e9bf0%22/><circle cx=%2250%22 cy=%2250%22 r=%2225%22 fill=%22%23ff6fa1%22/></svg>",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>
        <NavBar />
        {children}
      </body>
    </html>
  );
}
