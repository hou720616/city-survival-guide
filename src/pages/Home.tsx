import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Home as HomeIcon, FileSearch, Calculator } from "lucide-react";
import BubbleRise from "@/components/BubbleRise";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col justify-center">
      {/* ===== Hero 故事区 ===== */}
      <section className="relative overflow-hidden contour-decoration">
        <div className="absolute top-20 -right-20 w-96 h-96 contour-rings opacity-50 pointer-events-none" />
        <div className="absolute bottom-10 -left-20 w-72 h-72 contour-rings opacity-40 pointer-events-none" />

        <div className="container mx-auto px-6 py-20 md:py-28 relative">
          <div className="max-w-3xl mx-auto text-center">
            {/* 手写体标签 */}
            <p className="font-hand text-terracotta text-xl mb-4 animate-fade-in">
              你在这座城市的第一个朋友
            </p>

            <h1 className="font-serif text-5xl md:text-7xl font-bold text-espresso leading-tight mb-10 animate-fade-in-up">
              城市求生
              <span className="text-terracotta">指南</span>
            </h1>

            {/* 微型叙事 - 痛点共鸣 */}
            <div className="text-lg md:text-xl text-espresso-300 max-w-2xl mx-auto mb-6 leading-relaxed space-y-4 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              <p>
                你拖着行李箱站在出站口，手机地图上密密麻麻的标记，不知道该往哪走。
              </p>
              <p>
                你不知道租哪不会被坑、不知道押金能不能退、不知道办居住证要跑几个窗口、不知道第一个月工资到手前要花多少钱。
              </p>
              <p>
                如果那一刻，有一个人能告诉你——<span className="text-terracotta font-medium">住这，走这条路，先办这些，预算这么多</span>——会不会好很多？
              </p>
            </div>

            {/* 三大痛点标签 */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-10 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
              {[
                { icon: <HomeIcon className="w-4 h-4" />, text: "租房被坑" },
                { icon: <FileSearch className="w-4 h-4" />, text: "办证跑断腿" },
                { icon: <Calculator className="w-4 h-4" />, text: "预算算不清" },
              ].map((tag) => (
                <span
                  key={tag.text}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-espresso/5 text-espresso-300 text-sm"
                >
                  {tag.icon}
                  {tag.text}
                </span>
              ))}
            </div>

            {/* CTA */}
            <div className="animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
              <Link to="/survey" className="btn-primary text-lg !px-8 !py-4">
                <Sparkles className="w-5 h-5" />
                生成我的城市求生指南
                <ArrowRight className="w-5 h-5" />
              </Link>
              <p className="text-xs text-espresso-300/60 mt-3">
                回答几个问题，AI 帮你搞定一切
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 气泡升起动画 */}
      <BubbleRise />
    </div>
  );
}