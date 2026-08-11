import { MapEditor } from '@/components/editor/map-editor';

export default async function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MapEditor mapId={id} />;
}
