import { useLocalSearchParams, useRouter } from 'expo-router';
import { SummaryDetailScreen } from '@/src/screens/SummaryScreen/SummaryDetailScreen';

export default function SummaryDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  if (!id) {
    return null;
  }

  return (
    <SummaryDetailScreen
      summaryId={id}
      onBack={() => router.back()}
    />
  );
}