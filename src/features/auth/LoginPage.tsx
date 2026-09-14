import React, { useState } from 'react';
import { useAuth } from './AuthContext';
import { 
  LockKey, 
  EnvelopeSimple, 
  SignIn, 
  Sparkle, 
  WarningCircle,
  BookOpenText,
  CheckCircle
} from '@phosphor-icons/react';

export const LoginPage: React.FC = () => {
  const { login, quickDemoLogin } = useAuth();
  const [email, setEmail] = useState('yunusemreyilmaz93@gmail.com');
  const [password, setPassword] = useState('ydt2024');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(email, password);
    if (!result.success) {
      setError(result.error || 'Giriş başarısız oldu.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#FAF9F5] flex flex-col justify-center items-center p-4 select-none">
      {/* Container */}
      <div className="max-w-md w-full space-y-6">
        {/* Academic Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-[#8B1E2D] text-white text-2xl font-bold shadow-sm">
            ض
          </div>
          <h1 className="text-xl font-bold text-[#1C1917] tracking-tight">
            Arapça YDT Video Stüdyosu
          </h1>
          <p className="text-xs text-[#666560] max-w-xs mx-auto">
            Öğretmenler İçin Soru Analiz, ElevenLabs Seslendirme ve Video Prodüksiyon Portalı
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-[#FFFFFF] border border-[#D5D4CC] rounded p-6 shadow-sm space-y-4">
          <div className="border-b border-[#EFEFEA] pb-3">
            <h2 className="text-sm font-semibold text-[#1C1917]">Öğretmen Girişi</h2>
            <p className="text-[11px] text-[#787670]">
              YDT soru hazırlama paneline erişmek için bilgilerinizi giriniz.
            </p>
          </div>

          {error && (
            <div className="p-2.5 rounded bg-[#FDF2F2] border border-[#F8D7DA] text-xs text-[#8B1E2D] flex items-center gap-2">
              <WarningCircle size={16} weight="bold" className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-[#33322E] flex items-center gap-1.5">
                <EnvelopeSimple size={14} className="text-[#8B1E2D]" />
                <span>Kullanıcı Adı veya E-posta</span>
              </label>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@ogretmen.meb.gov.tr"
                className="w-full px-3 py-2 rounded border border-[#D5D4CC] bg-[#FAF9F5] focus:bg-white focus:border-[#8B1E2D] focus:ring-1 focus:ring-[#8B1E2D] outline-none transition-colors"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-[#33322E] flex items-center gap-1.5">
                <LockKey size={14} className="text-[#8B1E2D]" />
                <span>Şifre</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded border border-[#D5D4CC] bg-[#FAF9F5] focus:bg-white focus:border-[#8B1E2D] focus:ring-1 focus:ring-[#8B1E2D] outline-none transition-colors"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded bg-[#8B1E2D] hover:bg-[#721824] text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <SignIn size={16} weight="bold" />
              <span>{loading ? 'Giriş Yapılıyor...' : 'Sisteme Giriş Yap'}</span>
            </button>
          </form>

          {/* Quick Demo Login Shortcut */}
          <div className="pt-2 border-t border-[#EFEFEA]">
            <button
              type="button"
              onClick={quickDemoLogin}
              className="w-full py-2 px-3 rounded border border-[#DCDCD4] bg-[#FAF9F5] hover:bg-[#F0EFEB] text-[#44423D] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkle size={15} weight="bold" className="text-[#8B1E2D]" />
              <span>Hızlı Demo Öğretmen Girişi (Tek Tıkla)</span>
            </button>
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-[11px] text-[#787670] space-y-1">
          <div>Arapça Yabancı Dil Testi (YDT) • Soru Video Çözüm Motoru</div>
          <div>ElevenLabs Multilingual v2 Entegrasyonu</div>
        </div>
      </div>
    </div>
  );
};
