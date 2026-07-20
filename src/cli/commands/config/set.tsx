import { z } from "zod";
import { CommandAction } from "@/cli/components/command-action.tsx";
import { displayPath, preferencesPath } from "@/local-data/paths.ts";
import { loadPreferences, resultDetailLevels, savePreferences } from "@/preferences/index.ts";

export const description = "Update local preferences";
export const options = z.object({
  minimumDays: z.number().int().nonnegative().optional(),
  minimumAnswersAfter: z.number().int().nonnegative().optional(),
  resultDetail: z.enum(resultDetailLevels).optional(),
});
type Options = z.infer<typeof options>;

export default function SetConfigCommand({ options }: { options: Options }) {
  return <CommandAction dependencies={[options.minimumDays, options.minimumAnswersAfter, options.resultDetail]} run={async () => {
    if (options.minimumDays === undefined && options.minimumAnswersAfter === undefined && options.resultDetail === undefined) {
      throw new Error("provide --minimum-days, --minimum-answers-after, or --result-detail");
    }
    const current = await loadPreferences();
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
    await savePreferences(next);
    return `Updated ${displayPath(preferencesPath)}\nreview: ${next.review.minimumDays} days · ${next.review.minimumAnswersAfter} later answers\nresult detail: ${next.display.resultDetail}`;
  }} />;
}
