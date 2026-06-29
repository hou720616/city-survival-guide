import { Compass, Heart } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-parchment-400/30 bg-parchment-dark/30">
      <div className="container mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-terracotta/80 flex items-center justify-center">
              <Compass className="w-4 h-4 text-white" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-serif font-bold text-espresso">
                城市求生指南
              </span>
              <span className="text-xs text-espresso-300">
                你在这座城市的第一个朋友
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6 text-sm text-espresso-300">
            <span>关于我们</span>
            <span>使用指南</span>
            <span>隐私政策</span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-espresso-300">
            <span>用</span>
            <Heart className="w-3 h-3 text-terracotta" fill="currentColor" />
            <span>制作 · 2026</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
