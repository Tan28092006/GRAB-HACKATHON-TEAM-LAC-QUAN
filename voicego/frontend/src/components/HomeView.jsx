/**
 * HomeView.jsx – Role selection screen.
 *
 * Two massive, high-contrast buttons for selecting Driver or Passenger mode.
 * Optimized for visually impaired users with large touch targets (min 80px),
 * high-contrast colors, and clear iconography.
 */
function HomeView({ onSelectDriver, onSelectPassenger }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-8">
      {/* ── Logo / App Title ─────────────────────────────────────────── */}
      <div className="text-center mb-4 animate-fade-in-up">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-grab-green/20 mb-4">
          <span className="text-4xl" role="img" aria-label="Xe hơi">
            🚕
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
          Grab<span className="text-grab-green">Assist</span>
        </h1>
        <p className="mt-2 text-base sm:text-lg text-gray-400 font-medium max-w-xs mx-auto">
          Hỗ trợ ghép cặp Tài xế – Hành khách dành cho người khiếm thị
        </p>
      </div>

      {/* ── Role Selection Buttons ───────────────────────────────────── */}
      <div className="w-full max-w-md flex flex-col gap-5">
        {/* Driver Button */}
        <button
          onClick={onSelectDriver}
          aria-label="Tôi là Tài xế – nhập mã PIN để xác minh hành khách"
          className="group relative w-full min-h-[96px] flex items-center gap-5 px-6 py-6
                     bg-grab-green hover:bg-grab-green-dark active:scale-[0.97]
                     rounded-2xl shadow-lg shadow-grab-green/20
                     transition-all duration-200 cursor-pointer
                     focus-visible:ring-4 focus-visible:ring-grab-yellow"
        >
          <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-white/20 shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 17h.01M16 17h.01M5.2 17H4a1 1 0 01-1-1v-3.38a2 2 0 01.15-.76l1.71-4.28A2 2 0 016.72 6h10.56a2 2 0 011.86 1.58l1.71 4.28a2 2 0 01.15.76V16a1 1 0 01-1 1h-1.2M7 13h10"
              />
            </svg>
          </div>
          <div className="text-left">
            <span className="block text-xl sm:text-2xl font-extrabold text-white">
              Tôi là Tài xế
            </span>
            <span className="block text-sm sm:text-base text-white/80 font-medium mt-0.5">
              Nhập mã PIN để xác minh hành khách
            </span>
          </div>
          {/* Arrow indicator */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6 ml-auto text-white/60 group-hover:text-white group-hover:translate-x-1 transition-all"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Passenger Button */}
        <button
          onClick={onSelectPassenger}
          aria-label="Tôi là Hành khách – xem mã PIN và đọc cho tài xế"
          className="group relative w-full min-h-[96px] flex items-center gap-5 px-6 py-6
                     bg-grab-yellow hover:bg-grab-yellow-light active:scale-[0.97]
                     rounded-2xl shadow-lg shadow-grab-yellow/20
                     transition-all duration-200 cursor-pointer
                     focus-visible:ring-4 focus-visible:ring-white"
        >
          <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-black/15 shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-8 h-8 text-gray-900"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          </div>
          <div className="text-left">
            <span className="block text-xl sm:text-2xl font-extrabold text-gray-900">
              Tôi là Hành khách
            </span>
            <span className="block text-sm sm:text-base text-gray-700 font-medium mt-0.5">
              Xem mã PIN và đọc cho tài xế
            </span>
          </div>
          {/* Arrow indicator */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6 ml-auto text-gray-600 group-hover:text-gray-900 group-hover:translate-x-1 transition-all"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* ── Footer hint ──────────────────────────────────────────────── */}
      <p className="text-xs text-gray-600 text-center mt-4 max-w-xs">
        Ứng dụng hỗ trợ giọng nói tiếng Việt, rung phản hồi và camera để xác minh tài xế an toàn.
      </p>
    </div>
  );
}

export default HomeView;
