import { SatApp } from "../../tui/app.tsx";

export const description = "Practice missed and corrected questions";

export default function ReviewCommand() {
  return <SatApp mode="review" />;
}
