import { Text, useInput } from "ink";
import { Screen } from "../components/chrome.tsx";

export function SetupScreen({ location, onAccept, onDecline }: { location: string; onAccept: () => void; onDecline: () => void }) {
  useInput((input, key) => {
    if (input === "y" || key.return) onAccept();
    else if (input === "n") onDecline();
  });
  return (
    <Screen title="setup" footer="y/enter allow · n decline · q quit" globalNavigation={false}>
      <Text bold>Keep your SAT progress locally?</Text>
      <Text color="gray">Questions, answers, focus, and history stay on this computer.</Text>
      <Text> </Text>
      <Text color="cyan">{location}</Text>
    </Screen>
  );
}
