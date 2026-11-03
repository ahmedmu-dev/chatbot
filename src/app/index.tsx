import { useNavigation } from 'expo-router';
import type { DrawerNavigationProp } from 'expo-router/drawer';

import { ChatScreen } from '@/features/chat/ChatScreen';

export default function Index() {
  const navigation = useNavigation<DrawerNavigationProp<Record<string, undefined>>>();
  return <ChatScreen onOpenMenu={() => navigation.openDrawer()} />;
}
