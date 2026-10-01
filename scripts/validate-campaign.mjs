import {
  existsSync,
  readFileSync,
} from "node:fs";

function isRecord(value) {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value);
}

function isText(value) {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= 240;
}

const campaignPath =
  process.argv[2] ?? "campaign.json";

if (!existsSync(campaignPath)) {
  console.log(
    "No seasonal campaign config; validation skipped.",
  );
  process.exit(0);
}

const campaign = JSON.parse(
  readFileSync(campaignPath, "utf8"),
);

if (
  !isRecord(campaign) ||
  campaign.schemaVersion !== 1 ||
  !isText(campaign.campaignId) ||
  !Number.isSafeInteger(campaign.version) ||
  campaign.version <= 0 ||
  typeof campaign.enabled !== "boolean" ||
  !isText(campaign.startsAt) ||
  !isText(campaign.endsAt) ||
  !isText(campaign.theme) ||
  !isText(campaign.title) ||
  !isText(campaign.subtitle) ||
  !isRecord(campaign.primaryAction) ||
  !isText(campaign.primaryAction.label) ||
  !isText(campaign.primaryAction.articleId) ||
  !isRecord(campaign.secondaryAction) ||
  !isText(campaign.secondaryAction.label) ||
  !isText(campaign.secondaryAction.route) ||
  !campaign.secondaryAction.route.startsWith("/") ||
  !Array.isArray(campaign.featuredArticles) ||
  campaign.featuredArticles.length === 0 ||
  campaign.featuredArticles.length > 12 ||
  !campaign.featuredArticles.every(isText)
) {
  throw new Error(
    "campaign.json does not match the client schema",
  );
}

const start =
  Date.parse(campaign.startsAt);
const end =
  Date.parse(campaign.endsAt);

if (
  !Number.isFinite(start) ||
  !Number.isFinite(end) ||
  end <= start
) {
  throw new Error(
    "campaign.json has an invalid date range",
  );
}

if (
  new Set(campaign.featuredArticles).size !==
  campaign.featuredArticles.length
) {
  throw new Error(
    "campaign.json has duplicate featured articles",
  );
}

const supportedThemes =
  new Set(["october-adhd"]);

if (!supportedThemes.has(campaign.theme)) {
  throw new Error(
    `Unsupported campaign theme: ${campaign.theme}`,
  );
}

if (existsSync("catalog.json")) {
  const catalog = JSON.parse(
    readFileSync("catalog.json", "utf8"),
  );

  const articleIds =
    new Set(
      (catalog.articles ?? []).map(
        (article) => article.id,
      ),
    );

  if (
    !articleIds.has(
      campaign.primaryAction.articleId,
    )
  ) {
    throw new Error(
      "campaign primary action references a missing article",
    );
  }

  for (
    const articleId of
    campaign.featuredArticles
  ) {
    if (!articleIds.has(articleId)) {
      throw new Error(
        `campaign references missing article: ${articleId}`,
      );
    }
  }
}

console.log(
  [
    "Campaign OK:",
    campaign.campaignId,
    `enabled=${campaign.enabled}`,
    `featured=${campaign.featuredArticles.length}`,
  ].join(" "),
);
