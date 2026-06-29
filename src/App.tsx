import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GlobalMap from "@/components/GlobalMap";
import Home from "@/pages/Home";
import Survey from "@/pages/Survey";
import Result from "@/pages/Result";
import Chat from "@/pages/Chat";
import Pitfalls from "@/pages/Pitfalls";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isChatPage = location.pathname === "/chat";
  const isResultPage = location.pathname === "/result";
  const isPitfallsPage = location.pathname === "/pitfalls";

  return (
    <div className={`flex flex-col ${isChatPage || isResultPage || isPitfallsPage ? "h-screen overflow-hidden" : "min-h-screen"}`}>
      {/* 全局地图基底（z-0） */}
      <GlobalMap />
      {/* 顶部导航（z-100） */}
      <Navbar />
      {/* 主内容（z-10） */}
      <main className="flex-1 min-h-0 relative z-10">{children}</main>
      {!isChatPage && !isResultPage && !isPitfallsPage && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Layout>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/survey" element={<Survey />} />
          <Route path="/result" element={<Result />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/pitfalls" element={<Pitfalls />} />
        </Routes>
      </Layout>
    </Router>
  );
}
