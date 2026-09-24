import {
  readFileSync,
} from "node:fs";


const SUPPORTED_NEUROTYPES_0_11 = new Set([
  "adhd",
  "autism",
  "dyslexia",
  "dyscalculia",
  "developmental-coordination-disorder",
  "tic-disorders",
]);


const catalog = JSON.parse(
  readFileSync("catalog.json", "utf8"),
);

const manifest = JSON.parse(
  readFileSync("manifest.json", "utf8"),
);


if (
  catalog.contentVersion !==
  manifest.contentVersion
) {
  throw new Error(
    "catalog.json and manifest.json contentVersion differ.",
  );
}


if (
  catalog.articles.length !==
  manifest.articles.length
) {
  throw new Error(
    "catalog.json and manifest.json article counts differ.",
  );
}


const manifestIds = new Set(
  manifest.articles.map(
    (article) => article.id,
  ),
);


for (const article of catalog.articles) {
  if (!manifestIds.has(article.id)) {
    throw new Error(
      `Catalog article is missing from manifest: ${article.id}`,
    );
  }

  if (
    !Array.isArray(article.neurotypes) ||
    article.neurotypes.length === 0
  ) {
    throw new Error(
      `Article has no neurotypes: ${article.id}`,
    );
  }

  for (const neurotype of article.neurotypes) {
    if (!SUPPORTED_NEUROTYPES_0_11.has(neurotype)) {
      throw new Error(
        `Remote catalog is not compatible with Android 0.11.0: ${article.id} uses ${neurotype}`,
      );
    }
  }
}


console.log(
  `Android 0.11.0 compatibility OK: ${catalog.articles.length} remote articles, contentVersion ${catalog.contentVersion}`,
);
