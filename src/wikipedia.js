const FALLBACK_DECOYS = [
  { url: "https://en.wikipedia.org/wiki/Cat", title: "Cat — Wikipedia" },
  { url: "https://en.wikipedia.org/wiki/Coffee", title: "Coffee — Wikipedia" },
  { url: "https://en.wikipedia.org/wiki/Photosynthesis",
    title: "Photosynthesis — Wikipedia" },
  { url: "https://en.wikipedia.org/wiki/History_of_the_Internet",
    title: "History of the Internet — Wikipedia" },
  { url: "https://news.ycombinator.com", title: "Hacker News" },
  { url: "https://www.bbc.com/news", title: "BBC News" },
];

export async function getDecoy() {
  try {
    const endpoint =
      "https://en.wikipedia.org/w/api.php" +
      "?action=query&format=json&list=random" +
      "&rnnamespace=0&rnlimit=1&origin=*";
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(endpoint, { signal: controller.signal });
    clearTimeout(timeoutId);
    const data = await response.json();
    const article = data.query.random[0];
    const secureTitle = encodeURIComponent(
      article.title.replace(/ /g, "_")
    );
    return {
      url: `https://en.wikipedia.org/wiki/${secureTitle}`,
      title: `${article.title} — Wikipedia`,
      source: "live",
    };
  } catch {
    const r = FALLBACK_DECOYS[
      Math.floor(Math.random() * FALLBACK_DECOYS.length)
    ];
    return { url: r.url, title: r.title, source: "fallback" };
  }
}
