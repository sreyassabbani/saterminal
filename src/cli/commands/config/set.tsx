import { option } from "pastel";
import { z } from "zod";
import { CommandAction } from "@/cli/components/command-action.tsx";
import { displayPath, preferencesPath } from "@/local-data/paths.ts";
import { loadPreferences, savePreferences } from "@/preferences/index.ts";

export const description = "Update local preferences";
export const options = z.object({
  minimumDays: z.number().int().nonnegative().optional().describe(option({ description: "Days before a question can be reviewed", valueDescription: "days" })),
  minimumAnswersAfter: z.number().int().nonnegative().optional().describe(option({ description: "Later answers required before review", valueDescription: "count" })),
  taxonomy: z.enum(["show", "hide"]).optional().describe(option({ description: "Show or hide taxonomy on answer results", valueDescription: "visibility" })),
});
type Options = z.infer<typeof options>;

export default function SetConfigCommand({ options }: { options: Options }) {
  return <CommandAction dependencies={[options.minimumDays, options.minimumAnswersAfter, options.taxonomy]} run={() => {
    if (options.minimumDays === undefined && options.minimumAnswersAfter === undefined && options.taxonomy === undefined) {
      throw new Error("provide --minimum-days, --minimum-answers-after, or --taxonomy");
    }
    const current = loadPreferences();
    const next = {
      ...current,
      review: {
        minimumDays: options.minimumDays ?? current.review.minimumDays,
        minimumAnswersAfter: options.minimumAnswersAfter ?? current.review.minimumAnswersAfter,
      },
      display: {
        showTaxonomy: options.taxonomy === undefined ? current.display.showTaxonomy : options.taxonomy === "show",
      },
    };
    savePreferences(next);
    return `Updated ${displayPath(preferencesPath)}\nreview: ${next.review.minimumDays} days · ${next.review.minimumAnswersAfter} later answers\nresult taxonomy: ${next.display.showTaxonomy ? "shown" : "hidden"}`;
  }} />;
}
