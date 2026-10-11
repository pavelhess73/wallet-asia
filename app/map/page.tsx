'use client';

import dynamic from 'next/dynamic';

const MapView = dynamic(() => import('@/app/map/components/MapView'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#F8F6F4] flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E11D48]" />
    </div>
  ),
});

export default function MapPage() {
  return <MapView />;
}
