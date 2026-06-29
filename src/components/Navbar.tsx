import { Link, useLocation } from "react-router-dom";
import { Compass } from "lucide-react";

export default function Navbar() {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "首页" },
    { path: "/survey", label: "生成方案" },
    { path: "/chat", label: "AI 顾问" },
    { path: "/pitfalls", label: "避坑指南" },
  ];

  return (
    <header className="sticky top-0 z-[100] bg-parchment-light/90 backdrop-blur-md border-b border-parchment-400/30">
      <nav className="container mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-9 h-9 rounded-full bg-terracotta flex items-center justify-center shadow-warm group-hover:rotate-12 transition-transform duration-300">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-serif font-bold text-lg text-espresso">
              城市求生指南
            </span>
            <span className="text-[10px] text-espresso-300 tracking-wider">
              CITY SURVIVAL GUIDE
            </span>
          </div>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                location.pathname === item.path
                  ? "bg-terracotta/10 text-terracotta"
                  : "text-espresso-300 hover:text-terracotta hover:bg-terracotta/5"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <Link to="/survey" className="btn-primary !px-5 !py-2 text-sm">
          开始使用
        </Link>
      </nav>
    </header>
  );
}
