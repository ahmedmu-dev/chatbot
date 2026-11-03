import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ChatScreen } from '../ChatScreen';

const metrics = {
  frame: { x: 0, y: 0, width: 414, height: 896 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ChatScreen />
    </SafeAreaProvider>,
  );
}

describe('US-1 clean base shell', () => {
  it('AC-3: opens on the chat screen with the Parley header and the "Ask anything" placeholder', async () => {
    await renderScreen();
    expect(screen.getByText('Parley')).toBeOnTheScreen();
    expect(screen.getByLabelText('New chat')).toBeOnTheScreen();
    expect(screen.getByTestId('chat_empty_state')).toBeOnTheScreen();
    expect(screen.getByText('Ask anything')).toBeOnTheScreen();
  });
});
