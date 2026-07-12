import { option } from "pastel";
import { z } from "zod";
import { CommandAction } from "@/cli/components/command-action.tsx";
import { displayPath, preferencesPath } from "@/local-data/paths.ts";
import { loadPreferences, resultDetailLevels, savePreferences } from "@/preferences/index.ts";

export const description = "Update local preferences";
export const options = z.object({
  minimumDays: z.number().int().nonnegative().optional().describe(option({ description: "Days before a question can be reviewed", valueDescription: "days" })),
  minimumAnswersAfter: z.number().int().nonnegative().optional().describe(option({ description: "Later answers required before review", valueDescription: "count" })),
  resultDetail: z.enum(resultDetailLevels).optional().describe(option({ description: "Set answer-result detail", valueDescription: "level" })),
});
type Options = z.infer<typeof options>;

export default function SetConfigCommand({ options }: { options: Options }) {
  return <CommandAction dependencies={[options.minimumDays, options.minimumAnswersAfter, options.resultDetail]} run={() => {
    if (options.minimumDays === undefined && options.minimumAnswersAfter === undefined && options.resultDetail === undefined) {
      throw new Error("provide --minimum-days, --minimum-answers-after, or --result-detail");
    }
    const current = loadPreferences();
    const next = {
      ...current,
      review: {
        minimumDays: options.minimumDays ?? current.review.minimumDays,
        minimumAnswersAfter: options.minimumAnswersAfter ?? current.review.minimumAnswersAfter,
      },
      display: {
        resultDetail: options.resultDetail ?? current.display.resultDetail,
      },
    };
    savePreferences(next);
    return `Updated ${displayPath(preferencesPath)}\nreview: ${next.review.minimumDays} days · ${next.review.minimumAnswersAfter} later answers\nresult detail: ${next.display.resultDetail}`;
  }} />;
}
