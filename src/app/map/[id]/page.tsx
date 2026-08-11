import { MapEditor } from '@/components/editor/map-editor';
import { AuthGate } from '@/components/auth-gate';

export default async function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AuthGate>
      <MapEditor mapId={id} />
    </AuthGate>
  );
}
