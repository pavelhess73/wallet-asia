'use client';

import dynamic from 'next/dynamic';

// StatsView používá Intl.NumberFormat a datum formátování závislé na locale
// → ssr: false zabraňuje Hydration Error #441
const StatsView = dynamic(() => import('@/app/stats/components/StatsView'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#F8F6F4] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E11D48]" />
    </div>
  ),
});

export default function StatsPage() {
  return <StatsView />;
}
