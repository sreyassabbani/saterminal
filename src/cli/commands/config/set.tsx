import { option } from "pastel";
import { z } from "zod";
import { displayPath, preferencesPath } from "../../../local-data/paths.ts";
import { loadPreferences, savePreferences } from "../../../preferences/index.ts";
import { CommandAction } from "../../components/command-action.tsx";

export const description = "Update local preferences";
export const options = z.object({
  minimumDays: z.number().int().nonnegative().optional().describe(option({ description: "Days before a question can be reviewed", valueDescription: "days" })),
  minimumAnswersAfter: z.number().int().nonnegative().optional().describe(option({ description: "Later answers required before review", valueDescription: "count" })),
});
type Options = z.infer<typeof options>;

export default function SetConfigCommand({ options }: { options: Options }) {
  return <CommandAction dependencies={[options.minimumDays, options.minimumAnswersAfter]} run={() => {
    if (options.minimumDays === undefined && options.minimumAnswersAfter === undefined) {
      throw new Error("provide --minimum-days, --minimum-answers-after, or both");
    }
    const current = loadPreferences();
    const next = {
      ...current,
      review: {
        minimumDays: options.minimumDays ?? current.review.minimumDays,
        minimumAnswersAfter: options.minimumAnswersAfter ?? current.review.minimumAnswersAfter,
      },
    };
    savePreferences(next);
    return `Updated ${displayPath(preferencesPath)}\nreview: ${next.review.minimumDays} days · ${next.review.minimumAnswersAfter} later answers`;
  }} />;
}
