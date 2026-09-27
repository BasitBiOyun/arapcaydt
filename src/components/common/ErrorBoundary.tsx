import React from 'react';

/**
 * Last line of defence: an unexpected render error shows a way forward instead
 * of a blank white page. Saved work is safe; unsaved edits come back from the
 * device backup (draft store) when the question is reopened.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[Studio] unexpected error', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#FAF9F5] p-6">
        <section className="bg-white rounded-xl border border-[#E5E4DC] p-8 max-w-md space-y-4 text-center">
          <h1 className="text-lg font-semibold text-[#1C1917]">Beklenmedik bir sorun oluştu</h1>
          <p className="text-sm text-[#55544F]">
            Kaydedilen çalışmalarınız güvende. Kaydedilmemiş son değişiklikler, soruyu yeniden açtığınızda bu cihazdan geri yüklenir.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="studio-primary" onClick={() => window.location.reload()}>Sayfayı yenile</button>
          </div>
        </section>
      </main>
    );
  }
}
