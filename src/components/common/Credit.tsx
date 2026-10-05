/** The developer's signature: "made with مَحَبَّة (muhabbet)" under the studio and on the landing page. */
export function Credit({ className = '' }: { className?: string }) {
  return (
    <p className={className}>
      Yunus Emre Yılmaz tarafından{' '}
      <bdi dir="rtl" lang="ar" title="muhabbet (sevgi)" className="font-arabic text-[1.35em] leading-none text-[#8B1E2D]">مَحَبَّة</bdi>{' '}
      ile yapıldı
    </p>
  );
}
